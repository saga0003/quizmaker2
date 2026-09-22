import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/server/supabaseServer";
import { isPlatformAdmin } from "@/lib/roles";

const schoolManagerMemberRoles = new Set([
  "institute_owner",
  "institute_admin",
  "school_owner",
  "school_admin",
]);

const supportedTracks = new Set(["Foundation", "Boards", "Olympiad", "NEET", "JEE", "KCET"]);

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim() && error.message.trim() !== "{}") return error.message;
  if (typeof error === "string" && error.trim() && error.trim() !== "{}") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim() && message.trim() !== "{}") return message;
  }
  return fallback;
}

function fail(error: unknown) {
  const value = error as { status?: number; code?: string };
  const status = value?.status
    ?? (value?.code === "42501" ? 403
      : value?.code === "22023" ? 400
        : value?.code === "23505" || value?.code === "23514" ? 409
          : 500);
  return NextResponse.json(
    { error: errorMessage(error, "Student account could not be created. Please retry.") },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function generateTemporaryPassword() {
  return `Ev!${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}9`;
}

async function context(request: Request) {
  const auth = await authenticateRequest(request);
  const { data: profile, error: profileError } = await auth.admin
    .from("profiles")
    .select("id,role")
    .eq("id", auth.user.id)
    .single();
  if (profileError || !profile) {
    throw Object.assign(new Error(profileError?.message ?? "Evidara profile not found."), { status: 403 });
  }

  const requestedOrganizationId = request.headers.get("x-evidara-organization-id")?.trim() || null;
  const platformAdmin = isPlatformAdmin(profile.role);
  let organizationId: string | null = null;
  let memberRole: string | null = null;

  if (platformAdmin) {
    organizationId = requestedOrganizationId;
    if (!organizationId) {
      const { data: firstSchool } = await auth.admin
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      organizationId = firstSchool?.id ?? null;
    }
    memberRole = profile.role;
  } else {
    const { data: memberships, error: membershipError } = await auth.admin
      .from("organization_members")
      .select("organization_id,member_role")
      .eq("user_id", auth.user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (membershipError) throw new Error(membershipError.message);
    const activeMemberships = memberships ?? [];
    if (requestedOrganizationId) {
      const selected = activeMemberships.find((membership) => membership.organization_id === requestedOrganizationId);
      if (!selected) {
        throw Object.assign(new Error("The selected institution is not an active membership for this account."), { status: 403 });
      }
      organizationId = selected.organization_id;
      memberRole = selected.member_role;
    } else if (activeMemberships.length > 1) {
      throw Object.assign(new Error("Choose an active institution before adding a student."), { status: 409 });
    } else {
      organizationId = activeMemberships[0]?.organization_id ?? null;
      memberRole = activeMemberships[0]?.member_role ?? null;
    }
  }

  if (!organizationId) {
    throw Object.assign(new Error("No active school membership is linked to this account."), { status: 404 });
  }
  if (!platformAdmin && !schoolManagerMemberRoles.has(memberRole ?? "")) {
    throw Object.assign(new Error("School Admin permission is required."), { status: 403 });
  }

  return { ...auth, organizationId };
}

export async function POST(request: Request) {
  try {
    const ctx = await context(request);
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.fullName ?? "").trim();
    const academicYear = String(body.academicYear ?? "").trim();
    const grade = Number(body.grade);
    const section = String(body.section ?? "").trim();
    const board = String(body.board ?? "Other").trim();
    const tracks = Array.isArray(body.tracks) ? body.tracks.map(String) : [];
    const parentName = String(body.parentName ?? "").trim();
    const parentPhone = String(body.parentPhone ?? "").trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || fullName.length < 2 || !/^\d{4}-\d{2}$/.test(academicYear)) {
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

    const { data: existingUserId, error: lookupError } = await ctx.admin.rpc(
      "lookup_auth_user_by_email_v12",
      { p_email: email },
    );
    if (lookupError) throw Object.assign(new Error(lookupError.message), { code: lookupError.code });

    let studentUserId = typeof existingUserId === "string" ? existingUserId : "";
    let createdAccount = false;
    let temporaryPassword: string | null = null;

    if (!studentUserId) {
      temporaryPassword = generateTemporaryPassword();
      const { data: created, error: createError } = await ctx.admin.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, role: "student" },
      });
      if (createError || !created.user) {
        throw Object.assign(
          new Error(createError?.message ?? "Unable to create the student account."),
          { status: createError?.status ?? 500 },
        );
      }
      studentUserId = created.user.id;
      createdAccount = true;
    }

    if (createdAccount) {
      const { error: profileUpsertError } = await ctx.admin.from("profiles").upsert({
        id: studentUserId,
        full_name: fullName,
        role: "student",
        updated_at: new Date().toISOString(),
      });
      if (profileUpsertError) {
        await ctx.admin.auth.admin.deleteUser(studentUserId);
        throw new Error(`Student profile setup failed: ${profileUpsertError.message}`);
      }
    } else {
      const { data: existingProfile, error: existingProfileError } = await ctx.admin
        .from("profiles")
        .select("id,role")
        .eq("id", studentUserId)
        .maybeSingle();
      if (existingProfileError) throw new Error(existingProfileError.message);
      if (!existingProfile || existingProfile.role !== "student") {
        throw Object.assign(
          new Error("This email already belongs to a non-student Evidara account. Use a different student email."),
          { status: 409 },
        );
      }
      const { error: profileUpdateError } = await ctx.admin
        .from("profiles")
        .update({ full_name: fullName, updated_at: new Date().toISOString() })
        .eq("id", studentUserId);
      if (profileUpdateError) throw new Error(profileUpdateError.message);
    }

    const { data: membershipId, error: membershipError } = await ctx.client.rpc("add_school_student_membership_v13", {
      p_organization_id: ctx.organizationId,
      p_student_id: studentUserId,
      p_academic_year: academicYear,
      p_grade: grade,
      p_section: section,
      p_board: board,
      p_tracks: tracks,
      p_parent_name: parentName || null,
      p_parent_phone: parentPhone || null,
    });
    if (membershipError) {
      if (createdAccount) await ctx.admin.auth.admin.deleteUser(studentUserId);
      throw Object.assign(new Error(membershipError.message), { code: membershipError.code });
    }

    return NextResponse.json({
      ok: true,
      userId: studentUserId,
      membershipId,
      linkedExistingAccount: !createdAccount,
      temporaryPassword,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error);
  }
}
