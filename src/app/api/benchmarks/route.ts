import { NextResponse } from "next/server";
import { benchmarkPublications } from "@/lib/evidaraBenchmarks";
import { authenticateRequest, isServerSupabaseConfigured } from "@/lib/server/supabaseServer";

const managerRoles = new Set(["institute_owner", "institute_admin", "teacher", "super_admin"]);
const publicationFields = "id,paper_id,publisher_organization_id,title,paper_version,version_fingerprint,grade_label,preparation_track,access_code,status,privacy_minimum,privacy_minimum_schools,small_cell_minimum,max_violation_count,opens_at,closes_at,published_at,closed_at,created_at";

type PublicationRow = {
  id: string;
  paper_id: string;
  publisher_organization_id: string;
  title: string;
  paper_version: string;
  version_fingerprint: string;
  grade_label: string | null;
  preparation_track: string | null;
  access_code: string;
  status: string;
  privacy_minimum: number;
  privacy_minimum_schools: number;
  small_cell_minimum: number;
  max_violation_count: number;
  opens_at: string | null;
  closes_at: string | null;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
};

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function fail(error: unknown) {
  const value = error as { message?: string; status?: number; details?: string };
  return response({ error: value.message ?? "Unexpected Evidara benchmark error.", details: value.details ?? null }, value.status ?? 500);
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
      .eq("status", "active")
      .order("academic_year", { ascending: false })
      .limit(1)
      .maybeSingle();
    organizationId = studentMembership?.organization_id ?? null;
  }

  if (!organizationId && profile.role === "super_admin") {
    const { data: firstOrganization } = await auth.admin
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    organizationId = firstOrganization?.id ?? null;
    memberRole = "super_admin";
  }

  if (!organizationId) throw Object.assign(new Error("No school is linked to this account."), { status: 404 });
  const manager = profile.role === "super_admin" || managerRoles.has(memberRole ?? profile.role);
  return { ...auth, organizationId, manager, role: profile.role as string };
}

type BenchmarkContext = Awaited<ReturnType<typeof benchmarkContext>>;

async function participantPublicationIds(ctx: BenchmarkContext) {
  if (ctx.role === "super_admin") return null;
  if (ctx.manager) {
    const { data, error } = await ctx.admin
      .from("benchmark_contributions")
      .select("publication_id")
      .eq("organization_id", ctx.organizationId);
    if (error) throw error;
    return [...new Set((data ?? []).map((item) => item.publication_id as string))];
  }
  const { data, error } = await ctx.admin
    .from("benchmark_contributions")
    .select("publication_id")
    .eq("student_id", ctx.user.id);
  if (error) throw error;
  return [...new Set((data ?? []).map((item) => item.publication_id as string))];
}

async function listVisiblePublications(ctx: BenchmarkContext) {
  const participated = await participantPublicationIds(ctx);
  let query = ctx.admin
    .from("benchmark_publications")
    .select(publicationFields)
    .order("created_at", { ascending: false });

  if (ctx.role !== "super_admin") {
    if (ctx.manager) {
      query = participated?.length
        ? query.or(`publisher_organization_id.eq.${ctx.organizationId},id.in.(${participated.join(",")})`)
        : query.eq("publisher_organization_id", ctx.organizationId);
    } else {
      if (!participated?.length) return [] as PublicationRow[];
      query = query.in("id", participated).in("status", ["published", "closed"]);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as PublicationRow[]).map((item) => {
    const canManage = ctx.role === "super_admin" || item.publisher_organization_id === ctx.organizationId;
    return {
      ...item,
      access_code: canManage ? item.access_code : null,
      can_manage: canManage,
    };
  });
}

async function publicationAccess(ctx: BenchmarkContext, publicationId: string) {
  const { data: publication, error } = await ctx.admin
    .from("benchmark_publications")
    .select("id,publisher_organization_id")
    .eq("id", publicationId)
    .single();
  if (error || !publication) throw Object.assign(new Error("Benchmark publication not found."), { status: 404 });

  const canManage = ctx.role === "super_admin" || publication.publisher_organization_id === ctx.organizationId;
  if (canManage) return { canManage: true };

  const { data: contribution } = await ctx.admin
    .from("benchmark_contributions")
    .select("id")
    .eq("publication_id", publicationId)
    .eq("organization_id", ctx.organizationId)
    .limit(1)
    .maybeSingle();
  if (!contribution) throw Object.assign(new Error("This school has no benchmark participation record."), { status: 403 });
  return { canManage: false };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (!isServerSupabaseConfigured) {
      return response({ mode: "demo", publications: benchmarkPublications, manager: true });
    }

    const ctx = await benchmarkContext(request);
    const publicationId = url.searchParams.get("publicationId");
    const mine = url.searchParams.get("mine") === "true";
    const includePapers = url.searchParams.get("includePapers") === "true";
    const includeCohort = url.searchParams.get("includeCohort") === "true";

    if (publicationId && mine) {
      const { data, error } = await ctx.admin.rpc("get_student_benchmark_result", {
        p_publication_id: publicationId,
        p_student_id: ctx.user.id,
        p_organization_id: ctx.organizationId,
      });
      if (error) throw error;
      return response({ mode: "cloud", result: data });
    }

    if (publicationId) {
      if (!ctx.manager) return response({ error: "Student accounts can request only their own benchmark result." }, 403);
      const access = await publicationAccess(ctx, publicationId);
      const { data: summary, error: summaryError } = await ctx.admin.rpc("get_private_benchmark_summary", {
        p_publication_id: publicationId,
        p_requesting_organization_id: ctx.organizationId,
      });
      if (summaryError) throw summaryError;

      let cohort: unknown[] = [];
      if (includeCohort) {
        const { data: attempts, error: attemptError } = await ctx.admin
          .from("exam_attempts")
          .select("id,student_id,score,maximum_marks,percentage,status,submitted_at,violation_count")
          .eq("organization_id", ctx.organizationId)
          .eq("status", "submitted")
          .contains("metadata", { benchmark_publication_id: publicationId })
          .order("submitted_at", { ascending: false });
        if (attemptError) throw attemptError;

        const attemptIds = (attempts ?? []).map((item) => item.id as string);
        const studentIds = [...new Set((attempts ?? []).map((item) => item.student_id as string))];
        const names = new Map<string, string>();
        const validation = new Map<string, { contribution_id: string; is_valid: boolean; exclusion_reason: string | null }>();

        if (studentIds.length) {
          const { data: profiles } = await ctx.admin.from("profiles").select("id,full_name").in("id", studentIds);
          for (const profile of profiles ?? []) names.set(profile.id, profile.full_name || "Student");
        }
        if (attemptIds.length) {
          const { data: contributions, error: contributionError } = await ctx.admin
            .from("benchmark_contributions")
            .select("id,attempt_id,is_valid,exclusion_reason")
            .eq("publication_id", publicationId)
            .eq("organization_id", ctx.organizationId)
            .in("attempt_id", attemptIds);
          if (contributionError) throw contributionError;
          for (const item of contributions ?? []) {
            validation.set(item.attempt_id, {
              contribution_id: item.id,
              is_valid: item.is_valid,
              exclusion_reason: item.exclusion_reason,
            });
          }
        }

        cohort = (attempts ?? []).map((attempt) => ({
          ...attempt,
          student_name: names.get(attempt.student_id) || "Student",
          contribution_id: validation.get(attempt.id)?.contribution_id ?? null,
          is_valid: validation.get(attempt.id)?.is_valid ?? false,
          exclusion_reason: validation.get(attempt.id)?.exclusion_reason ?? "contribution_pending",
        }));
      }

      return response({ mode: "cloud", summary, cohort, canManage: access.canManage });
    }

    const publications = await listVisiblePublications(ctx);
    let papers: unknown[] = [];
    if (includePapers && ctx.manager) {
      const { data: paperData, error: paperError } = await ctx.admin
        .from("question_papers")
        .select("id,title,exam_type,duration_minutes,total_marks,total_questions,status,updated_at")
        .eq("organization_id", ctx.organizationId)
        .eq("status", "published")
        .order("updated_at", { ascending: false });
      if (paperError) throw paperError;
      papers = paperData ?? [];
    }

    return response({ mode: "cloud", publications, papers, manager: ctx.manager });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "create");

    if (!isServerSupabaseConfigured) {
      if (action === "join") return response({ mode: "demo", attemptId: "demo-benchmark-attempt", publicationId: benchmarkPublications[0].id });
      return response({ mode: "demo", message: "Demo benchmark action completed locally." }, 200);
    }

    const ctx = await benchmarkContext(request);

    if (action === "join") {
      const accessCode = String(body.accessCode ?? "").trim();
      if (!accessCode) return response({ error: "Benchmark access code is required." }, 400);
      const { data, error } = await ctx.client.rpc("start_benchmark_attempt", { p_access_code: accessCode });
      if (error) throw error;
      return response({ mode: "cloud", ...data as Record<string, unknown> }, 201);
    }

    if (!ctx.manager) return response({ error: "Only authorised school staff can manage shared benchmarks." }, 403);

    if (action === "create") {
      const paperId = String(body.paperId ?? "");
      const title = String(body.title ?? "");
      const paperVersion = String(body.paperVersion ?? "");
      const accessCode = String(body.accessCode ?? "");
      if (!paperId || !title || !paperVersion || !accessCode) {
        return response({ error: "Paper, title, exact version and access code are required." }, 400);
      }
      const { data: publicationId, error } = await ctx.client.rpc("create_benchmark_publication", {
        p_paper_id: paperId,
        p_title: title,
        p_paper_version: paperVersion,
        p_access_code: accessCode,
        p_grade_label: String(body.gradeLabel ?? "") || null,
        p_preparation_track: String(body.preparationTrack ?? "") || null,
        p_opens_at: body.opensAt || null,
        p_closes_at: body.closesAt || null,
      });
      if (error) throw error;
      return response({ mode: "cloud", publicationId }, 201);
    }

    if (["publish", "close", "cancel"].includes(action)) {
      const publicationId = String(body.publicationId ?? "");
      if (!publicationId) return response({ error: "Benchmark publication ID is required." }, 400);
      const status = action === "publish" ? "published" : action === "close" ? "closed" : "cancelled";
      const { error } = await ctx.client.rpc("set_benchmark_publication_status", {
        p_publication_id: publicationId,
        p_status: status,
      });
      if (error) throw error;
      return response({ mode: "cloud", publicationId, status });
    }

    if (action === "backfill") {
      const publicationId = String(body.publicationId ?? "");
      const { data: added, error } = await ctx.client.rpc("backfill_benchmark_contributions", {
        p_publication_id: publicationId,
      });
      if (error) throw error;
      return response({ mode: "cloud", publicationId, contributionsAdded: added });
    }

    if (action === "invalidate" || action === "restore") {
      const contributionId = String(body.contributionId ?? "");
      if (!contributionId) return response({ error: "Benchmark contribution ID is required." }, 400);
      const { data: contribution, error: lookupError } = await ctx.admin
        .from("benchmark_contributions")
        .select("id,organization_id")
        .eq("id", contributionId)
        .single();
      if (lookupError || !contribution) return response({ error: "Benchmark contribution not found." }, 404);
      if (ctx.role !== "super_admin" && contribution.organization_id !== ctx.organizationId) {
        return response({ error: "A school can review only its own student contributions." }, 403);
      }
      const { error } = await ctx.client.rpc("set_benchmark_contribution_validity", {
        p_contribution_id: contributionId,
        p_is_valid: action === "restore",
        p_reason: String(body.reason ?? "") || null,
      });
      if (error) throw error;
      return response({ mode: "cloud", contributionId, isValid: action === "restore" });
    }

    return response({ error: "Unsupported benchmark action." }, 400);
  } catch (error) {
    return fail(error);
  }
}
