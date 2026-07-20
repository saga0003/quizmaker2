import { NextResponse } from "next/server";
import { authenticateRequest, isPublicSupabaseConfigured, isServerSupabaseConfigured } from "@/lib/server/supabaseServer";
import { demoAchievementDefinitions, demoSchoolAchievements, demoStudentAchievements } from "@/lib/demoAchievements";
import type { AchievementDefinition, AchievementGovernanceRow, SchoolAchievementRow, StudentAchievement } from "@/lib/achievementClient";

const managerRoles = new Set(["institute_owner", "institute_admin", "teacher", "super_admin"]);

function response(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function fail(error: unknown) {
  const value = error as { message?: string; status?: number; details?: string };
  return response({ error: value.message ?? "Unexpected Evidara achievement error.", details: value.details ?? null }, value.status ?? 500);
}

function incompleteCloudResponse() {
  return response({ error: "Evidara cloud is partially configured. Add SUPABASE_SERVICE_ROLE_KEY before using achievements or certificates." }, 503);
}

async function achievementContext(request: Request) {
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
    const { data: membership } = await auth.admin
      .from("student_school_memberships")
      .select("organization_id")
      .eq("student_id", auth.user.id)
      .eq("status", "active")
      .order("academic_year", { ascending: false })
      .limit(1)
      .maybeSingle();
    organizationId = membership?.organization_id ?? null;
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

type Context = Awaited<ReturnType<typeof achievementContext>>;

type RawAchievement = {
  id: string;
  student_id: string;
  organization_id: string;
  definition_code: string;
  rule_version: string;
  source_type: string;
  source_id: string | null;
  evidence: Record<string, unknown>;
  status: "active" | "revoked";
  awarded_at: string;
  last_evaluated_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
};

async function loadDefinitions(ctx: Context) {
  const { data, error } = await ctx.admin
    .from("achievement_definitions")
    .select("code,title,description,category,tier,icon_key,rule_version,criteria,certificate_eligible,display_order")
    .eq("is_active", true)
    .order("display_order");
  if (error) throw error;
  return (data ?? []) as AchievementDefinition[];
}

async function loadAchievementRows(ctx: Context, options: { studentId?: string; organizationId?: string; limit?: number }) {
  let query = ctx.admin
    .from("student_achievements")
    .select("id,student_id,organization_id,definition_code,rule_version,source_type,source_id,evidence,status,awarded_at,last_evaluated_at,revoked_at,revoked_reason")
    .order("awarded_at", { ascending: false })
    .limit(options.limit ?? 500);
  if (options.studentId) query = query.eq("student_id", options.studentId);
  if (options.organizationId) query = query.eq("organization_id", options.organizationId);
  const { data, error } = await query;
  if (error) throw error;

  const achievements = (data ?? []) as RawAchievement[];
  const definitions = await loadDefinitions(ctx);
  const definitionMap = new Map(definitions.map((item) => [item.code, item]));
  const achievementIds = achievements.map((item) => item.id);
  const studentIds = [...new Set(achievements.map((item) => item.student_id))];

  const certificates = new Map<string, StudentAchievement["certificate"]>();
  if (achievementIds.length) {
    const { data: certificateRows, error: certificateError } = await ctx.admin
      .from("achievement_certificates")
      .select("id,achievement_id,certificate_number,verification_code,status,issued_at,revoked_at,revoked_reason")
      .in("achievement_id", achievementIds)
      .order("issued_at", { ascending: false });
    if (certificateError) throw certificateError;
    for (const item of certificateRows ?? []) {
      if (!certificates.has(item.achievement_id) || item.status === "active") certificates.set(item.achievement_id, item);
    }
  }

  const profiles = new Map<string, string>();
  if (studentIds.length) {
    const { data: profileRows, error: profileError } = await ctx.admin
      .from("profiles")
      .select("id,full_name,username")
      .in("id", studentIds);
    if (profileError) throw profileError;
    for (const item of profileRows ?? []) {
      profiles.set(item.id, item.full_name || item.username || "Evidara Learner");
    }
  }

  return achievements.flatMap((item) => {
    const definition = definitionMap.get(item.definition_code);
    if (!definition) return [];
    return [{
      ...item,
      definition,
      certificate: certificates.get(item.id) ?? null,
      student_name: profiles.get(item.student_id) ?? "Evidara Learner",
      student_email: null,
    }];
  }) as SchoolAchievementRow[];
}

async function governanceRows(ctx: Context) {
  const definitions = await loadDefinitions(ctx);
  const rows: AchievementGovernanceRow[] = [];
  for (const definition of definitions) {
    const [active, revoked, certificates] = await Promise.all([
      ctx.admin.from("student_achievements").select("id", { count: "exact", head: true }).eq("definition_code", definition.code).eq("status", "active"),
      ctx.admin.from("student_achievements").select("id", { count: "exact", head: true }).eq("definition_code", definition.code).eq("status", "revoked"),
      ctx.admin.from("achievement_certificates").select("id,student_achievements!inner(definition_code)", { count: "exact", head: true }).eq("status", "active").eq("student_achievements.definition_code", definition.code),
    ]);
    if (active.error) throw active.error;
    if (revoked.error) throw revoked.error;
    if (certificates.error) throw certificates.error;
    rows.push({ ...definition, active_awards: active.count ?? 0, revoked_awards: revoked.count ?? 0, active_certificates: certificates.count ?? 0 });
  }
  return rows;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope") ?? "student";

    if (!isPublicSupabaseConfigured) {
      if (scope === "school") {
        return response({
          mode: "demo",
          rows: demoSchoolAchievements,
          definitions: demoAchievementDefinitions,
          summary: {
            active_awards: demoSchoolAchievements.filter((item) => item.status === "active").length,
            certificate_count: demoSchoolAchievements.filter((item) => item.certificate?.status === "active").length,
            students_recognised: new Set(demoSchoolAchievements.map((item) => item.student_id)).size,
          },
        });
      }
      if (scope === "admin") {
        return response({
          mode: "demo",
          rows: demoAchievementDefinitions.map((item, index) => ({ ...item, active_awards: 18 + index * 7, revoked_awards: index % 3, active_certificates: item.certificate_eligible ? 6 + index * 2 : 0 })),
        });
      }
      return response({ mode: "demo", rows: demoStudentAchievements, definitions: demoAchievementDefinitions });
    }
    if (!isServerSupabaseConfigured) return incompleteCloudResponse();

    const ctx = await achievementContext(request);

    if (scope === "admin") {
      if (ctx.role !== "super_admin") return response({ error: "Super Admin access required." }, 403);
      return response({ mode: "cloud", rows: await governanceRows(ctx) });
    }

    if (scope === "school") {
      if (!ctx.manager) return response({ error: "School staff access required." }, 403);
      const rows = await loadAchievementRows(ctx, { organizationId: ctx.organizationId, limit: 750 });
      return response({
        mode: "cloud",
        rows,
        definitions: await loadDefinitions(ctx),
        summary: {
          active_awards: rows.filter((item) => item.status === "active").length,
          certificate_count: rows.filter((item) => item.certificate?.status === "active").length,
          students_recognised: new Set(rows.filter((item) => item.status === "active").map((item) => item.student_id)).size,
        },
      });
    }

    const { error: evaluationError } = await ctx.client.rpc("evaluate_student_achievements", {
      p_student_id: ctx.user.id,
      p_organization_id: ctx.organizationId,
      p_source_type: "aggregate_refresh",
    });
    if (evaluationError) throw evaluationError;
    const rows = await loadAchievementRows(ctx, { studentId: ctx.user.id, organizationId: ctx.organizationId, limit: 100 });
    return response({ mode: "cloud", rows, definitions: await loadDefinitions(ctx) });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action ?? "evaluate");

    if (!isPublicSupabaseConfigured) {
      if (action === "issue_certificate") return response({ mode: "demo", certificate: demoStudentAchievements[1].certificate });
      return response({ mode: "demo", message: "Demo achievement action completed." });
    }
    if (!isServerSupabaseConfigured) return incompleteCloudResponse();

    const ctx = await achievementContext(request);

    if (action === "evaluate") {
      const studentId = String(body.studentId ?? ctx.user.id);
      if (studentId !== ctx.user.id && !ctx.manager) return response({ error: "You can evaluate only your own achievements." }, 403);
      const { data, error } = await ctx.client.rpc("evaluate_student_achievements", {
        p_student_id: studentId,
        p_organization_id: ctx.organizationId,
        p_source_type: "aggregate_refresh",
      });
      if (error) throw error;
      return response({ mode: "cloud", rulesEvaluated: data });
    }

    if (action === "backfill") {
      if (!ctx.manager) return response({ error: "School staff access required." }, 403);
      const { data, error } = await ctx.client.rpc("backfill_organization_achievements", { p_organization_id: ctx.organizationId });
      if (error) throw error;
      return response({ mode: "cloud", studentsEvaluated: data });
    }

    if (action === "issue_certificate") {
      const achievementId = String(body.achievementId ?? "");
      if (!achievementId) return response({ error: "Achievement ID is required." }, 400);
      const { data: certificateId, error } = await ctx.client.rpc("issue_achievement_certificate", { p_achievement_id: achievementId });
      if (error) throw error;
      const { data: certificate, error: certificateError } = await ctx.admin
        .from("achievement_certificates")
        .select("id,achievement_id,certificate_number,verification_code,status,issued_at,revoked_at,revoked_reason")
        .eq("id", certificateId)
        .single();
      if (certificateError) throw certificateError;
      return response({ mode: "cloud", certificate }, 201);
    }

    if (action === "revoke_achievement" || action === "restore_achievement") {
      if (!ctx.manager) return response({ error: "School staff access required." }, 403);
      const achievementId = String(body.achievementId ?? "");
      const { error } = await ctx.client.rpc("set_student_achievement_status", {
        p_achievement_id: achievementId,
        p_status: action === "restore_achievement" ? "active" : "revoked",
        p_reason: String(body.reason ?? "") || null,
      });
      if (error) throw error;
      return response({ mode: "cloud", achievementId, status: action === "restore_achievement" ? "active" : "revoked" });
    }

    if (action === "revoke_certificate" || action === "restore_certificate") {
      const certificateId = String(body.certificateId ?? "");
      const { error } = await ctx.client.rpc("set_achievement_certificate_status", {
        p_certificate_id: certificateId,
        p_status: action === "restore_certificate" ? "active" : "revoked",
        p_reason: String(body.reason ?? "") || null,
      });
      if (error) throw error;
      return response({ mode: "cloud", certificateId, status: action === "restore_certificate" ? "active" : "revoked" });
    }

    return response({ error: "Unsupported achievement action." }, 400);
  } catch (error) {
    return fail(error);
  }
}
