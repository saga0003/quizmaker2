import { NextResponse } from "next/server";
import { benchmarkPublications } from "@/lib/evidaraBenchmarks";
import { authenticateRequest, isServerSupabaseConfigured } from "@/lib/server/supabaseServer";

const managerRoles = new Set(["institute_owner", "institute_admin", "teacher", "super_admin"]);

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function fail(error: unknown) {
  const value = error as { message?: string; status?: number };
  return response({ error: value.message ?? "Unexpected Evidara benchmark error." }, value.status ?? 500);
}

async function benchmarkContext(request: Request) {
  const auth = await authenticateRequest(request);
  const { data: profile, error: profileError } = await auth.admin
    .from("profiles")
    .select("id,role")
    .eq("id", auth.user.id)
    .single();
  if (profileError || !profile) throw Object.assign(new Error("Evidara profile not found."), { status: 403 });

  const requestedOrg = new URL(request.url).searchParams.get("organizationId");
  let organizationId: string | null = null;
  let memberRole: string | null = null;

  if (profile.role === "super_admin" && requestedOrg) {
    organizationId = requestedOrg;
    memberRole = "super_admin";
  } else {
    const { data: member } = await auth.admin
      .from("organization_members")
      .select("organization_id,member_role")
      .eq("user_id", auth.user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    organizationId = member?.organization_id ?? null;
    memberRole = member?.member_role ?? null;
  }

  if (!organizationId) {
    const { data: studentMembership } = await auth.admin
      .from("student_school_memberships")
      .select("organization_id")
      .eq("student_id", auth.user.id)
      .order("academic_year", { ascending: false })
      .limit(1)
      .maybeSingle();
    organizationId = studentMembership?.organization_id ?? null;
  }

  if (!organizationId) throw Object.assign(new Error("No school is linked to this account."), { status: 404 });
  const manager = profile.role === "super_admin" || managerRoles.has(memberRole ?? profile.role);
  return { ...auth, organizationId, manager, role: profile.role };
}

export async function GET(request: Request) {
  try {
    if (!isServerSupabaseConfigured) {
      return response({ mode: "demo", publications: benchmarkPublications });
    }

    const ctx = await benchmarkContext(request);
    const publicationId = new URL(request.url).searchParams.get("publicationId");

    if (publicationId) {
      const { data, error } = await ctx.admin.rpc("get_private_benchmark_summary", {
        p_publication_id: publicationId,
        p_requesting_organization_id: ctx.organizationId,
      });
      if (error) throw error;
      return response({ mode: "cloud", summary: data });
    }

    let query = ctx.admin
      .from("benchmark_publications")
      .select("id,title,paper_version,version_fingerprint,grade_label,preparation_track,access_code,status,privacy_minimum,small_cell_minimum,opens_at,closes_at,created_at")
      .order("created_at", { ascending: false });
    if (!ctx.manager) query = query.in("status", ["published", "closed"]);
    const { data, error } = await query;
    if (error) throw error;

    return response({ mode: "cloud", publications: data ?? [], manager: ctx.manager });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    if (!isServerSupabaseConfigured) {
      return response({ error: "Cloud benchmark publishing requires Supabase configuration." }, 503);
    }

    const ctx = await benchmarkContext(request);
    if (!ctx.manager) return response({ error: "Only authorised school staff can publish a shared benchmark." }, 403);

    const body = await request.json() as {
      assessmentId?: string;
      title?: string;
      paperVersion?: string;
      versionFingerprint?: string;
      gradeLabel?: string;
      preparationTrack?: string;
      accessCode?: string;
      opensAt?: string | null;
      closesAt?: string | null;
    };

    if (!body.assessmentId || !body.title || !body.paperVersion || !body.versionFingerprint || !body.accessCode) {
      return response({ error: "Assessment, title, exact version, fingerprint and access code are required." }, 400);
    }

    const { data, error } = await ctx.admin
      .from("benchmark_publications")
      .insert({
        assessment_id: body.assessmentId,
        publisher_organization_id: ctx.organizationId,
        title: body.title.trim(),
        paper_version: body.paperVersion.trim(),
        version_fingerprint: body.versionFingerprint.trim(),
        grade_label: body.gradeLabel?.trim() || null,
        preparation_track: body.preparationTrack?.trim() || null,
        access_code: body.accessCode.trim().toUpperCase(),
        status: "draft",
        privacy_minimum: 20,
        small_cell_minimum: 10,
        opens_at: body.opensAt || null,
        closes_at: body.closesAt || null,
        created_by: ctx.user.id,
      })
      .select("id,title,paper_version,version_fingerprint,access_code,status")
      .single();
    if (error) throw error;

    await ctx.admin.from("benchmark_audit_events").insert({
      publication_id: data.id,
      actor_id: ctx.user.id,
      event_type: "benchmark_publication_created",
      details: { organization_id: ctx.organizationId },
    });

    return response({ mode: "cloud", publication: data }, 201);
  } catch (error) {
    return fail(error);
  }
}
