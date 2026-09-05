import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/server/supabaseServer";

const privilegedRoles = new Set([
  "super_admin",
  "evidara_admin",
  "admin",
  "platform_admin",
  "school_admin",
  "school_owner",
  "institute_admin",
  "institute_owner",
]);

function response(error: unknown) {
  const value = error as { message?: string; status?: number };
  return NextResponse.json(
    { error: value.message ?? "Credential security request failed." },
    { status: value.status ?? 500, headers: { "Cache-Control": "no-store" } },
  );
}

function passwordProblems(password: string, email: string) {
  const problems: string[] = [];
  if (password.length < 12) problems.push("Use at least 12 characters.");
  if (!/[A-Z]/.test(password)) problems.push("Add an uppercase letter.");
  if (!/[a-z]/.test(password)) problems.push("Add a lowercase letter.");
  if (!/\d/.test(password)) problems.push("Add a number.");
  if (!/[^A-Za-z0-9]/.test(password)) problems.push("Add a symbol.");
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 4 && password.toLowerCase().includes(local)) problems.push("Do not include your email name in the password.");
  if (/password|evidara|123456|qwerty/i.test(password)) problems.push("Choose a less predictable password.");
  return problems;
}

async function context(request: Request) {
  const auth = await authenticateRequest(request, { allowPrivilegedAal1: true });
  const { data: profile, error } = await auth.admin
    .from("profiles")
    .select("id,role,full_name")
    .eq("id", auth.user.id)
    .single();
  if (error || !profile) throw Object.assign(new Error(error?.message ?? "Evidara profile not found."), { status: 403 });
  return { ...auth, profile };
}

export async function GET(request: Request) {
  try {
    const ctx = await context(request);
    const { data: securityState, error } = await ctx.admin
      .from("credential_security_states")
      .select("must_change_password,temporary_issued_at,password_changed_at")
      .eq("user_id", ctx.user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const role = String(ctx.profile.role);
    return NextResponse.json({
      mustChangePassword: Boolean(securityState?.must_change_password),
      temporaryIssuedAt: securityState?.temporary_issued_at ?? null,
      passwordChangedAt: securityState?.password_changed_at ?? null,
      privileged: privilegedRoles.has(role),
      role,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return response(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await context(request);
    const body = await request.json() as { action?: string; password?: string };
    if (body.action !== "change_password") {
      throw Object.assign(new Error("Unsupported credential-security action."), { status: 400 });
    }

    const password = String(body.password ?? "");
    const problems = passwordProblems(password, ctx.user.email ?? "");
    if (problems.length) {
      throw Object.assign(new Error(problems.join(" ")), { status: 400 });
    }

    const { error: passwordError } = await ctx.admin.auth.admin.updateUserById(ctx.user.id, { password });
    if (passwordError) throw Object.assign(new Error(passwordError.message), { status: 400 });

    const now = new Date().toISOString();
    const { error: stateError } = await ctx.admin
      .from("credential_security_states")
      .upsert({
        user_id: ctx.user.id,
        must_change_password: false,
        password_changed_at: now,
        updated_by: ctx.user.id,
        updated_at: now,
      }, { onConflict: "user_id" });
    if (stateError) throw new Error(stateError.message);

    await ctx.admin.from("audit_logs").insert({
      actor_id: ctx.user.id,
      action: "account.password_setup_completed",
      entity_type: "profile",
      entity_id: ctx.user.id,
      metadata: { privileged: privilegedRoles.has(String(ctx.profile.role)) },
    });

    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return response(error);
  }
}
