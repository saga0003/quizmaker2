import { NextResponse } from "next/server";
import {
  authenticateRequest,
  isServerSupabaseConfigured,
} from "@/lib/server/supabaseServer";
import {
  isPlatformAdmin,
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

const supportedTracks = new Set(["Foundation", "Boards", "Olympiad", "NEET", "JEE", "KCET"]);

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

type RosterStudent = {
  id: string;
  name: string;
  grade: number;
  section: string;
  sectionId?: string;
  board: string;
  academicYear: string;
  tracks: string[];
  status: "active" | "revoked" | "completed";
  invitationStatus: "active" | "invited" | "pending";
  promotionLocked: boolean;
  revokedAt?: string;
  promotedAt?: string;
  parentName?: string;
  parentPhone?: string;
};

type RosterSection = {
  id: string;
  academicYear: string;
  grade: number;
  name: string;
  code?: string;
};

type RosterPayload = {
  organizationId: string;
  manager: boolean;
  scope: "organization" | "assigned_sections";
  students: RosterStudent[];
  sections: RosterSection[];
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
  organization_id: string | null;
  resource_scope: "platform" | "organization";
};

function fail(error: unknown) {
  const value = error as { message?: string; status?: number; details?: unknown };
  return NextResponse.json(
    { error: value.message ?? "Unexpected Evidara cloud error.", details: value.details ?? null },
    { status: value.status ?? 500, headers: { "Cache-Control": "no-store" } },
  );
}

function databaseError(error: { message: string; code?: string | null }) {
  const status = error.code === "42501"
    ? 403
    : error.code === "P0002"
      ? 404
      : error.code === "23514" || error.code === "23505"
        ? 409
        : error.code === "22023"
          ? 400
          : 500;
  return Object.assign(new Error(error.message), { status });
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
      .order("created_at", { ascending: true })
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
      .order("updated_at", { ascending: false })
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

  if (!organizationId) throw Object.assign(new Error("No active school membership is linked to this account."), { status: 404 });

  const schoolStaff = platformAdmin || schoolStaffMemberRoles.has(memberRole ?? "");
  const manager = platformAdmin || schoolManagerMemberRoles.has(memberRole ?? "");

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
  const { admin, client, organizationId, schoolStaff, manager, user } = ctx;
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
  let rosterStudents: RosterStudent[] = [];
  let rosterSections: RosterSection[] = [];
  let rosterScope: "organization" | "assigned_sections" | "own" = "own";

  if (schoolStaff) {
    const { data: rosterData, error: rosterError } = await client.rpc(
      "list_school_student_lifecycle_v13",
      { p_organization_id: organizationId },
    );
    if (rosterError) {
      const missingMigration = /list_school_student_lifecycle_v13|does not exist|not found/i.test(rosterError.message);
      throw Object.assign(new Error(missingMigration
        ? "Apply the Phase 1 Increment 4 roster migration before using student lifecycle management."
        : rosterError.message), { status: rosterError.code === "42501" ? 403 : 500 });
    }
    const roster = (rosterData ?? {}) as Partial<RosterPayload>;
    rosterStudents = Array.isArray(roster.students) ? roster.students : [];
    rosterSections = Array.isArray(roster.sections) ? roster.sections : [];
    rosterScope = roster.scope === "assigned_sections" ? "assigned_sections" : "organization";
  } else {
    const { data: membershipData, error: membershipError } = await admin
      .from("student_school_memberships")
      .select("id,organization_id,student_id,academic_year,grade,section,board,tracks,status,promotion_locked,revoked_at,promoted_at,parent_name,parent_phone")
      .eq("organization_id", organizationId)
      .eq("student_id", user.id)
      .eq("status", "active")
      .order("academic_year", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(1);
    if (membershipError) throw new Error(membershipError.message);
    memberships = (membershipData ?? []) as Membership[];
    if (memberships.length === 0) {
      throw Object.assign(new Error("No active student membership is linked to this institution."), { status: 403 });
    }
  }

  const names = new Map<string, string>();
  const profileIds = [...new Set(memberships.map((membership) => membership.student_id))];
  if (profileIds.length) {
    const { data: profiles } = await admin.from("profiles").select("id,full_name").in("id", profileIds);
    for (const profile of profiles ?? []) names.set(profile.id, profile.full_name || "Student");
  }

  const { data: resourceData, error: resourceError } = await admin
    .from("academic_resources")
    .select("id,title,kind,access_label,subscription_required,board,grade_min,grade_max,required_track,subject,source_year,content_url,metadata,organization_id,resource_scope")
    .eq("is_active", true)
    .order("kind", { ascending: true })
    .order("source_year", { ascending: false });
  if (resourceError) throw new Error(resourceError.message);
  const allResources = ((resourceData ?? []) as Resource[]).filter((resource) => resource.resource_scope === "platform" || resource.organization_id === organizationId);
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
        board: school.board || rosterStudents[0]?.board || memberships[0]?.board || "Other",
        city: school.city,
        subscription: subscription ? {
          planName: subscription.plan_name,
          status: subscriptionStatus(subscription.status),
          startsAt: subscription.starts_at,
          endsAt: subscription.ends_at,
          seatLimit: subscription.seat_limit,
          resourceAccess: subscription.resource_access,
        } : {
          planName: "Founding Institution Plan",
          status: "expired",
          startsAt: today,
          endsAt: today,
          seatLimit: 0,
          resourceAccess: "limited",
        },
      },
      students: schoolStaff ? rosterStudents : memberships.map((membership) => ({
        id: membership.id,
        name: names.get(membership.student_id) || "Student",
        grade: membership.grade,
        section: membership.section || "",
        board: membership.board,
        academicYear: membership.academic_year,
        tracks: membership.tracks ?? [],
        status: membership.status,
        invitationStatus: "active" as const,
        promotionLocked: membership.promotion_locked,
        revokedAt: membership.revoked_at ?? undefined,
        promotedAt: membership.promoted_at ?? undefined,
        parentName: membership.parent_name || "",
        parentPhone: "",
      })),
      sections: rosterSections,
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
        scope: resource.resource_scope,
        organizationId: resource.organization_id || undefined,
      })),
    },
    rosterScope,
  };
}

async function mutate(request: Request, ctx: CloudContext) {
  if (!ctx.manager) throw Object.assign(new Error("School Admin permission is required."), { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "");
  const { client, admin, organizationId } = ctx;

  if (action === "studentDetails") {
    const membershipId = String(body.membershipId ?? "");
    const { data: membership, error: membershipError } = await admin
      .from("student_school_memberships")
      .select("id,student_id,academic_year,grade,section,board,tracks,status,promotion_locked,parent_name,parent_phone,metadata")
      .eq("id", membershipId)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (membershipError || !membership) throw Object.assign(new Error("Student membership not found in this institution."), { status: 404 });
    const { data: profile } = await admin.from("profiles").select("id,full_name,phone").eq("id", membership.student_id).maybeSingle();
    const { data: authUser } = await admin.auth.admin.getUserById(membership.student_id);
    return {
      studentDetail: {
        membershipId: membership.id,
        studentId: membership.student_id,
        fullName: profile?.full_name || "Student",
        email: authUser?.user?.email || "",
        phone: profile?.phone || "",
        rollNumber: typeof membership.metadata?.roll_number === "string" ? membership.metadata.roll_number : "",
        academicYear: membership.academic_year,
        grade: membership.grade,
        section: membership.section || "",
        board: membership.board,
        tracks: membership.tracks || [],
        status: membership.status,
        promotionLocked: membership.promotion_locked,
        parentName: membership.parent_name || "",
        parentPhone: membership.parent_phone || "",
        notes: typeof membership.metadata?.notes === "string" ? membership.metadata.notes : "",
      },
    };
  } else if (action === "updateStudent") {
    const membershipId = String(body.membershipId ?? "");
    const { data: membership, error: membershipError } = await admin.from("student_school_memberships")
      .select("id,student_id,status,promotion_locked,metadata").eq("id", membershipId).eq("organization_id", organizationId).maybeSingle();
    if (membershipError || !membership) throw Object.assign(new Error("Student membership not found in this institution."), { status: 404 });
    const fullName = String(body.fullName ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const academicYear = String(body.academicYear ?? "").trim();
    const grade = Number(body.grade);
    const section = String(body.section ?? "").trim();
    const tracks = Array.isArray(body.tracks) ? body.tracks.map(String) : [];
    if (fullName.length < 2) throw Object.assign(new Error("Student name is required."), { status: 400 });
    if (!email.includes("@")) throw Object.assign(new Error("A valid student email is required."), { status: 400 });
    if (!/^\d{4}-\d{2}$/.test(academicYear)) throw Object.assign(new Error("Academic year must look like 2027-28."), { status: 400 });
    if (!Number.isInteger(grade) || grade < 8 || grade > 12) throw Object.assign(new Error("Grade must be between 8 and 12."), { status: 400 });
    if (tracks.some((track) => !supportedTracks.has(track))) throw Object.assign(new Error("One or more eligibility tracks are unsupported."), { status: 400 });
    const metadata = { ...(membership.metadata || {}), roll_number: String(body.rollNumber ?? "").trim(), notes: String(body.notes ?? "").trim() };
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(membership.student_id, { email });
    if (authUpdateError) throw Object.assign(new Error(authUpdateError.message), { status: 400 });
    const { error: profileError } = await admin.from("profiles").update({ full_name: fullName, phone: phone || null }).eq("id", membership.student_id);
    if (profileError) throw databaseError(profileError);
    const { error: updateError } = await admin.from("student_school_memberships").update({
      academic_year: academicYear, grade, section: section || null, tracks,
      parent_name: String(body.parentName ?? "").trim() || null,
      parent_phone: String(body.parentPhone ?? "").trim() || null,
      metadata, updated_at: new Date().toISOString(),
    }).eq("id", membershipId).eq("organization_id", organizationId);
    if (updateError) throw databaseError(updateError);
    await admin.from("audit_logs").insert({ actor_id: ctx.user.id, organization_id: organizationId, action: "school.student.updated", entity_type: "student_membership", entity_id: membershipId, metadata: { grade, academicYear } });
  } else if (action === "setStudentPassword" || action === "resetStudentPassword") {
    const membershipId = String(body.membershipId ?? "");
    const { data: membership } = await admin.from("student_school_memberships").select("student_id").eq("id", membershipId).eq("organization_id", organizationId).maybeSingle();
    if (!membership) throw Object.assign(new Error("Student membership not found in this institution."), { status: 404 });
    const generated = `Ev!${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}9`;
    const password = action === "resetStudentPassword" ? generated : String(body.password ?? "");
    if (password.length < 8) throw Object.assign(new Error("Password must contain at least 8 characters."), { status: 400 });
    const { error: passwordError } = await admin.auth.admin.updateUserById(membership.student_id, { password });
    if (passwordError) throw Object.assign(new Error(passwordError.message), { status: 400 });
    await admin.from("audit_logs").insert({ actor_id: ctx.user.id, organization_id: organizationId, action: action === "resetStudentPassword" ? "school.student.password_reset" : "school.student.password_set", entity_type: "student_membership", entity_id: membershipId, metadata: {} });
    if (action === "resetStudentPassword") return { temporaryPassword: password };
  } else if (action === "removeStudent") {
    const membershipId = String(body.membershipId ?? "");
    const { data: membership } = await admin.from("student_school_memberships").select("id").eq("id", membershipId).eq("organization_id", organizationId).maybeSingle();
    if (!membership) throw Object.assign(new Error("Student membership not found in this institution."), { status: 404 });
    const { error: deleteError } = await admin.from("student_school_memberships").delete().eq("id", membershipId).eq("organization_id", organizationId);
    if (deleteError) throw databaseError(deleteError);
    await admin.from("audit_logs").insert({ actor_id: ctx.user.id, organization_id: organizationId, action: "school.student.removed", entity_type: "student_membership", entity_id: membershipId, metadata: {} });
  } else if (action === "promote") {
    const { error } = await client.rpc("school_roster_promote_student_v13", {
      p_membership_id: body.membershipId,
      p_target_academic_year: body.targetAcademicYear,
    });
    if (error) throw databaseError(error);
  } else if (action === "revoke") {
    const { error } = await client.rpc("school_roster_revoke_student_v13", {
      p_membership_id: body.membershipId,
      p_reason: body.reason || null,
    });
    if (error) throw databaseError(error);
  } else if (action === "promoteAll") {
    const { error } = await client.rpc("school_roster_promote_all_v13", {
      p_organization_id: organizationId,
      p_from_academic_year: body.fromAcademicYear,
      p_target_academic_year: body.targetAcademicYear,
    });
    if (error) throw databaseError(error);
  } else if (action === "revokeAll") {
    const { error } = await client.rpc("school_roster_revoke_all_v13", {
      p_organization_id: organizationId,
      p_academic_year: body.academicYear,
      p_reason: body.reason || null,
    });
    if (error) throw databaseError(error);
  } else if (action === "updateTracks") {
    const tracks = Array.isArray(body.tracks) ? body.tracks.map(String) : [];
    if (tracks.some((track) => !supportedTracks.has(track))) {
      throw Object.assign(new Error("One or more eligibility tracks are unsupported."), { status: 400 });
    }
    const { error } = await client.rpc("update_school_student_tracks_v13", {
      p_membership_id: body.membershipId,
      p_tracks: tracks,
    });
    if (error) throw databaseError(error);
  } else if (action === "inviteStudent") {
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.fullName ?? "").trim();
    const academicYear = String(body.academicYear ?? "").trim();
    const grade = Number(body.grade);
    const section = String(body.section ?? "").trim();
    const board = String(body.board ?? "Other").trim();
    const tracks = Array.isArray(body.tracks) ? body.tracks.map(String) : [];
    if (!email.includes("@") || fullName.length < 2 || !/^\d{4}-\d{2}$/.test(academicYear)) {
      throw Object.assign(new Error("A valid student email, name and academic year are required."), { status: 400 });
    }
    if (!Number.isInteger(grade) || grade < 8 || grade > 12) {
      throw Object.assign(new Error("Grade must be between 8 and 12."), { status: 400 });
    }
    if (section.length > 80 || board.length < 2 || board.length > 80) {
      throw Object.assign(new Error("Check the section and board values."), { status: 400 });
    }
    if (tracks.some((track) => !supportedTracks.has(track))) {
      throw Object.assign(new Error("One or more eligibility tracks are unsupported."), { status: 400 });
    }

    const { data: existingUserId, error: lookupError } = await admin.rpc(
      "lookup_auth_user_by_email_v12",
      { p_email: email },
    );
    if (lookupError) {
      const missingMigration = /lookup_auth_user_by_email_v12|does not exist|not found/i.test(lookupError.message);
      throw new Error(missingMigration
        ? "Apply Supabase migration 44 before inviting students."
        : lookupError.message);
    }

    let studentUserId = typeof existingUserId === "string" ? existingUserId : "";
    if (!studentUserId) {
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
        data: { full_name: fullName, role: "student" },
        redirectTo: `${new URL(request.url).origin}/auth/callback/`,
      });
      if (inviteError || !invited.user) throw new Error(inviteError?.message ?? "Student invitation failed.");
      studentUserId = invited.user.id;
    }

    const { error: membershipError } = await client.rpc("add_school_student_membership_v13", {
      p_organization_id: organizationId,
      p_student_id: studentUserId,
      p_academic_year: academicYear,
      p_grade: grade,
      p_section: section,
      p_board: board,
      p_tracks: tracks,
      p_parent_name: String(body.parentName ?? "").trim() || null,
      p_parent_phone: String(body.parentPhone ?? "").trim() || null,
    });
    if (membershipError) throw databaseError(membershipError);

    const { error: profileError } = await admin.from("profiles").upsert({
      id: studentUserId,
      full_name: fullName,
      updated_at: new Date().toISOString(),
    });
    if (profileError) throw new Error(profileError.message);
  } else if (action === "createResource") {
    const title = String(body.title ?? "").trim();
    const subject = String(body.subject ?? "General").trim();
    const contentUrl = String(body.contentUrl ?? "").trim();
    const kind = String(body.kind ?? "school_test");
    const gradeMin = Number(body.gradeMin ?? 8);
    const gradeMax = Number(body.gradeMax ?? 12);
    if (title.length < 3 || !/^https?:\/\//i.test(contentUrl)) throw Object.assign(new Error("A title and valid http(s) resource URL are required."), { status: 400 });
    if (!Number.isInteger(gradeMin) || !Number.isInteger(gradeMax) || gradeMin < 8 || gradeMax > 12 || gradeMin > gradeMax) throw Object.assign(new Error("Resource grades must be between 8 and 12."), { status: 400 });
    const allowedKinds = new Set(["school_test","previous_year_board","entrance","olympiad","foundation"]);
    if (!allowedKinds.has(kind)) throw Object.assign(new Error("Unsupported resource type."), { status: 400 });
    const { error } = await admin.from("academic_resources").insert({ title, subject, content_url: contentUrl, kind, grade_min: gradeMin, grade_max: gradeMax, access_label: "included", subscription_required: true, is_active: true, resource_scope: "organization", organization_id: organizationId, created_by: ctx.user.id, metadata: { description: String(body.description ?? "").trim() } });
    if (error) throw databaseError(error);
  } else if (action === "deleteResource") {
    const resourceId = String(body.resourceId ?? "");
    const { data: resource, error: lookupError } = await admin.from("academic_resources").select("id,organization_id,resource_scope").eq("id", resourceId).maybeSingle();
    if (lookupError) throw databaseError(lookupError);
    if (!resource || resource.resource_scope !== "organization" || resource.organization_id !== organizationId) throw Object.assign(new Error("Only resources owned by this institution can be removed."), { status: 403 });
    const { error } = await admin.from("academic_resources").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", resourceId).eq("organization_id", organizationId);
    if (error) throw databaseError(error);
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
