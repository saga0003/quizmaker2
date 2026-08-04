import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isServerSupabaseConfigured,
} from "@/lib/server/supabaseServer";
import {
  isPlatformAdmin,
  isSchoolManager,
  isSchoolStaff,
} from "@/lib/roles";

const schoolManagerMemberRoles = new Set([
  "institute_owner",
  "institute_admin",
  "school_owner",
  "school_admin",
]);

const schoolStaffMemberRoles = new Set([
  ...schoolManagerMemberRoles,
  "teacher",
  "school_teacher",
  "reviewer",
  "invigilator",
]);

type Membership = {
  id: string;
  organization_id: string;
  student_id: string;
  academic_year: string;
  grade: number;
  section: string | null;
  board: string;
  tracks: string[] | null;
  status: "active" | "revoked" | "completed";
  promotion_locked: boolean;
  revoked_at: string | null;
  promoted_at: string | null;
  parent_name: string | null;
  parent_phone: string | null;
};

type Subscription = {
  plan_name: string;
  status: string;
  starts_at: string;
  ends_at: string;
  seat_limit: number;
  resource_access: "full" | "limited";
};

type Resource = {
  id: string;
  title: string;
  kind: "school_test" | "previous_year_board" | "entrance" | "olympiad" | "foundation";
  access_label: "free" | "complimentary" | "included" | "paid";
  subscription_required: boolean;
  board: string | null;
  grade_min: number;
  grade_max: number;
  required_track: string | null;
  subject: string | null;
  source_year: number | null;
  content_url: string | null;
  metadata: Record<string, unknown> | null;
};

function fail(error: unknown) {
  const value = error as { message?: string; status?: number; details?: unknown };
  return NextResponse.json(
    { error: value.message ?? "Unexpected Evidara cloud error.", details: value.details ?? null },
    { status: value.status ?? 500, headers: { "Cache-Control": "no-store" } },
  );
}

async function context(request: Request) {
  const auth = await authenticateRequest(request);
  const { data: profile, error } = await auth.admin
    .from("profiles")
    .select("id,full_name,role")
    .eq("id", auth.user.id)
    .single();
  if (error || !profile) throw Object.assign(new Error(error?.message ?? "Evidara profile not found."), { status: 403 });

  const requestedOrg = new URL(request.url).searchParams.get("organizationId");
  const platformAdmin = isPlatformAdmin(profile.role);
  let organizationId: string | null = null;
  let memberRole: string | null = null;

  if (platformAdmin && requestedOrg) {
    organizationId = requestedOrg;
    memberRole = profile.role;
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

  if (!organizationId && platformAdmin) {
    const { data: firstSchool } = await auth.admin
      .from("organizations")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    organizationId = firstSchool?.id ?? null;
    memberRole = profile.role;
  }

  if (!organizationId) throw Object.assign(new Error("No school is linked to this account yet."), { status: 404 });

  const effectiveMemberRole = memberRole ?? profile.role;
  const schoolStaff =
    platformAdmin ||
    isSchoolStaff(profile.role) ||
    schoolStaffMemberRoles.has(effectiveMemberRole);
  const manager =
    platformAdmin ||
    isSchoolManager(profile.role) ||
    schoolManagerMemberRoles.has(effectiveMemberRole);

  return { ...auth, profile, organizationId, schoolStaff, manager };
}

type CloudContext = Awaited<ReturnType<typeof context>>;

function subscriptionActive(subscription: Subscription | null) {
  if (!subscription || subscription.status !== "active") return false;
  const today = new Date().toISOString().slice(0, 10);
  return subscription.starts_at <= today && subscription.ends_at >= today;
}

function eligible(resource: Resource, membership: Membership, subscription: Subscription | null) {
  return membership.status === "active"
    && (!resource.subscription_required || subscriptionActive(subscription))
    && membership.grade >= resource.grade_min
    && membership.grade <= resource.grade_max
    && (!resource.board || resource.board.toLowerCase() === membership.board.toLowerCase())
    && (!resource.required_track || (membership.tracks ?? []).includes(resource.required_track));
}

function subscriptionStatus(status?: string) {
  return ["active", "trial", "expired", "suspended"].includes(status ?? "") ? status : "expired";
}

async function snapshot(ctx: CloudContext) {
  const { admin, organizationId, schoolStaff, manager, user } = ctx;
  const { data: school, error: schoolError } = await admin
    .from("organizations")
    .select("id,name,city,state,board")
    .eq("id", organizationId)
    .single();
  if (schoolError || !school) throw new Error(schoolError?.message ?? "School record not found.");

  const { data: subscriptionData } = await admin
    .from("school_subscriptions")
    .select("plan_name,status,starts_at,ends_at,seat_limit,resource_access")
    .eq("organization_id", organizationId)
    .order("ends_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const subscription = (subscriptionData ?? null) as Subscription | null;

  let memberships: Membership[] = [];
  let membershipQuery = admin
    .from("student_school_memberships")
    .select("id,organization_id,student_id,academic_year,grade,section,board,tracks,status,promotion_locked,revoked_at,promoted_at,parent_name,parent_phone")
    .eq("organization_id", organizationId)
    .order("grade", { ascending: true });
  if (!schoolStaff) membershipQuery = membershipQuery.eq("student_id", user.id).limit(1);
  const { data: membershipData, error: membershipError } = await membershipQuery;
  if (membershipError) throw new Error(membershipError.message);
  memberships = (membershipData ?? []) as Membership[];

  const names = new Map<string, string>();
  const profileIds = [...new Set(memberships.map((membership) => membership.student_id))];
  if (profileIds.length) {
    const { data: profiles } = await admin.from("profiles").select("id,full_name").in("id", profileIds);
    for (const profile of profiles ?? []) names.set(profile.id, profile.full_name || "Student");
  }

  const { data: resourceData, error: resourceError } = await admin
    .from("academic_resources")
    .select("id,title,kind,access_label,subscription_required,board,grade_min,grade_max,required_track,subject,source_year,content_url,metadata")
    .eq("is_active", true)
    .order("kind", { ascending: true })
    .order("source_year", { ascending: false });
  if (resourceError) throw new Error(resourceError.message);
  const allResources = (resourceData ?? []) as Resource[];
  const resources = schoolStaff
    ? allResources
    : allResources.filter((resource) => memberships[0] && eligible(resource, memberships[0], subscription));
  const today = new Date().toISOString().slice(0, 10);

  return {
    mode: "cloud",
    manager,
    schoolStaff,
    state: {
      school: {
        id: school.id,
        name: school.name,
        board: school.board || memberships[0]?.board || "Other",
        city: school.city,
        subscription: subscription ? {
          planName: subscription.plan_name,
          status: subscriptionStatus(subscription.status),
          startsAt: subscription.starts_at,
          endsAt: subscription.ends_at,
          seatLimit: subscription.seat_limit,
          resourceAccess: subscription.resource_access,
        } : {
          planName: "Evidara Annual School Access",
          status: "expired",
          startsAt: today,
          endsAt: today,
          seatLimit: 0,
          resourceAccess: "limited",
        },
      },
      students: memberships.map((membership) => ({
        id: membership.id,
        name: names.get(membership.student_id) || "Student",
        grade: membership.grade,
        section: membership.section || "",
        board: membership.board,
        academicYear: membership.academic_year,
        tracks: membership.tracks ?? [],
        status: membership.status,
        promotionLocked: membership.promotion_locked,
        revokedAt: membership.revoked_at ?? undefined,
        promotedAt: membership.promoted_at ?? undefined,
        parentName: membership.parent_name || "",
        parentPhone: schoolStaff ? membership.parent_phone || "" : "",
      })),
      resources: resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        kind: resource.kind,
        accessLabel: resource.access_label === "paid" ? "INCLUDED" : resource.access_label.toUpperCase(),
        board: resource.board || undefined,
        gradeMin: resource.grade_min,
        gradeMax: resource.grade_max,
        track: resource.required_track || undefined,
        year: resource.source_year || undefined,
        subject: resource.subject || "General",
        subscriptionRequired: resource.subscription_required,
        description: typeof resource.metadata?.description === "string"
          ? resource.metadata.description
          : "Evidara academic resource.",
        contentUrl: resource.content_url || undefined,
      })),
    },
  };
}

async function mutate(request: Request, ctx: CloudContext) {
  if (!ctx.manager) throw Object.assign(new Error("School Admin permission is required."), { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");
  const { client, admin, organizationId } = ctx;

  if (action === "promote") {
    const { error } = await client.rpc("promote_school_student", {
      p_membership_id: body.membershipId,
      p_target_academic_year: body.targetAcademicYear,
    });
    if (error) throw new Error(error.message);
  } else if (action === "revoke") {
    const { error } = await client.rpc("revoke_school_student", {
      p_membership_id: body.membershipId,
      p_reason: body.reason || null,
    });
    if (error) throw new Error(error.message);
  } else if (action === "promoteAll") {
    const { error } = await client.rpc("promote_all_school_students", {
      p_organization_id: organizationId,
      p_from_academic_year: body.fromAcademicYear,
      p_target_academic_year: body.targetAcademicYear,
    });
    if (error) throw new Error(error.message);
  } else if (action === "revokeAll") {
    const { error } = await client.rpc("revoke_all_school_students", {
      p_organization_id: organizationId,
      p_academic_year: body.academicYear,
      p_reason: body.reason || null,
    });
    if (error) throw new Error(error.message);
  } else if (action === "updateTracks") {
    const tracks = Array.isArray(body.tracks) ? body.tracks.map(String) : [];
    const { error } = await admin
      .from("student_school_memberships")
      .update({ tracks, updated_at: new Date().toISOString() })
      .eq("id", body.membershipId)
      .eq("organization_id", organizationId)
      .eq("status", "active");
    if (error) throw new Error(error.message);
  } else if (action === "inviteStudent") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.fullName ?? "").trim();
    const academicYear = String(body.academicYear ?? "").trim();
    if (!email.includes("@") || fullName.length < 2 || !academicYear) {
      throw Object.assign(new Error("A valid student email, name and academic year are required."), { status: 400 });
    }

    const { data: listed, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw new Error(listError.message);
    let studentUser = listed.users.find((candidate) => candidate.email?.toLowerCase() === email);
    if (!studentUser) {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName, role: "student" },
        redirectTo: `${new URL(request.url).origin}/auth/callback/`,
      });
      if (inviteError || !invited.user) throw new Error(inviteError?.message ?? "Student invitation failed.");
      studentUser = invited.user;
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: studentUser.id,
      full_name: fullName,
      role: "student",
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw new Error(profileError.message);

    const { data: block } = await admin
      .from("student_promotion_blocks")
      .select("student_id")
      .eq("organization_id", organizationId)
      .eq("student_id", studentUser.id)
      .maybeSingle();
    if (block) throw Object.assign(new Error("This student was revoked and cannot be re-added to this school."), { status: 409 });

    const { data: existing } = await admin
      .from("student_school_memberships")
      .select("status,promotion_locked")
      .eq("organization_id", organizationId)
      .eq("student_id", studentUser.id)
      .eq("academic_year", academicYear)
      .maybeSingle();
    if (existing?.status === "revoked" || existing?.promotion_locked) {
      throw Object.assign(new Error("The student record is revoked or promotion-locked."), { status: 409 });
    }

    const { error: membershipError } = await admin
      .from("student_school_memberships")
      .upsert({
        organization_id: organizationId,
        student_id: studentUser.id,
        academic_year: academicYear,
        grade: Number(body.grade),
        section: String(body.section ?? ""),
        board: String(body.board ?? "Other"),
        tracks: Array.isArray(body.tracks) ? body.tracks.map(String) : [],
        status: "active",
        promotion_locked: false,
        parent_name: String(body.parentName ?? ""),
        parent_phone: String(body.parentPhone ?? ""),
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id,student_id,academic_year" });
    if (membershipError) throw new Error(membershipError.message);
  } else {
    throw Object.assign(new Error("Unknown school-platform action."), { status: 400 });
  }

  return snapshot(ctx);
}

export async function GET(request: Request) {
  if (!isServerSupabaseConfigured) {
    return NextResponse.json(
      { mode: "demo", configured: false, error: "Cloud environment is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    return NextResponse.json(await snapshot(await context(request)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  if (!isServerSupabaseConfigured) {
    return NextResponse.json(
      { mode: "demo", configured: false, error: "Cloud environment is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const ctx = await context(request);
    return NextResponse.json(await mutate(request, ctx), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}
