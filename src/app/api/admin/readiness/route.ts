import { NextResponse } from "next/server";
import { canAccessWorkspace, protectedRouteSmokeCases } from "@/lib/accessControl";
import { overallReadiness, summarizeReadiness, type ReadinessCheck, type ReadinessReport } from "@/lib/readiness";
import {
  authenticateRequest,
  createRequestClient,
  isPublicSupabaseConfigured,
  isServerSupabaseReady,
} from "@/lib/server/supabaseServer";

const RELEASE = "6.8.0";
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

type DiagnosticError = { message?: string; code?: string; details?: string; hint?: string };
type RazorpayDiagnostic = {
  release?: string;
  test_mode?: boolean;
  live_mode_detected?: boolean;
  key_id_present?: boolean;
  key_secret_present?: boolean;
  webhook_secret_present?: boolean;
  app_origins_configured?: boolean;
  app_origins_count?: number;
  expected_origin_allowed?: boolean | null;
  credentials_valid?: boolean | null;
  api_message?: string | null;
};

function response(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function errorResponse(error: unknown, fallback = "Evidara readiness diagnostics failed.", status = 500) {
  const value = error as DiagnosticError;
  return response(
    {
      error: value.message || fallback,
      code: value.code || null,
      details: value.details || null,
      action: "Open the Super Admin readiness page, review the failed check, and correct only the named configuration item.",
    },
    status,
  );
}

function check(
  id: string,
  area: ReadinessCheck["area"],
  label: string,
  status: ReadinessCheck["status"],
  message: string,
  action?: string | null,
  details?: ReadinessCheck["details"],
): ReadinessCheck {
  return { id, area, label, status, message, action: action ?? null, details: details ?? null };
}

function report(
  mode: ReadinessReport["mode"],
  actor: ReadinessReport["actor"],
  checks: ReadinessCheck[],
): ReadinessReport {
  return {
    release: RELEASE,
    generatedAt: new Date().toISOString(),
    mode,
    overall: overallReadiness(checks),
    actor,
    summary: summarizeReadiness(checks),
    checks,
  };
}

function envChecks(): ReadinessCheck[] {
  const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const appUrlValid = /^https:\/\//i.test(appUrl) || /^http:\/\/localhost(?::\d+)?$/i.test(appUrl);
  const appUrlLocal = /^http:\/\/localhost/i.test(appUrl);

  return [
    check(
      "release-version",
      "release",
      "Release version",
      "pass",
      `Runtime identifies itself as Evidara ${RELEASE}.`,
      null,
      { release: RELEASE },
    ),
    check(
      "deployment-boundary",
      "release",
      "Deployment boundary",
      "pass",
      "The release remains configured for Cloudflare Workers and Supabase. No Vercel deployment integration is required or tested by this release.",
    ),
    check(
      "supabase-public-url",
      "configuration",
      "Supabase project URL",
      publicUrl ? "pass" : "fail",
      publicUrl ? "NEXT_PUBLIC_SUPABASE_URL is present." : "NEXT_PUBLIC_SUPABASE_URL is missing.",
      publicUrl ? null : "Add the Supabase project URL to the runtime environment.",
    ),
    check(
      "supabase-public-key",
      "configuration",
      "Supabase browser key",
      publicKey ? "pass" : "fail",
      publicKey ? "A publishable or legacy anon key is present." : "No Supabase publishable or anon key is configured.",
      publicKey ? null : "Add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Use the anon-key variable only for legacy projects.",
    ),
    check(
      "supabase-service-key",
      "configuration",
      "Supabase service-role key",
      process.env.SUPABASE_SERVICE_ROLE_KEY ? "pass" : "fail",
      process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "The server-only service-role key is present. Its value is never returned by this endpoint."
        : "SUPABASE_SERVICE_ROLE_KEY is missing, so authenticated server diagnostics and protected APIs must fail closed.",
      process.env.SUPABASE_SERVICE_ROLE_KEY ? null : "Add the service-role key as a server secret. Never expose it through NEXT_PUBLIC variables.",
    ),
    check(
      "canonical-app-url",
      "configuration",
      "Canonical application URL",
      !appUrl ? "fail" : !appUrlValid ? "fail" : appUrlLocal ? "warning" : "pass",
      !appUrl
        ? "NEXT_PUBLIC_APP_URL is missing."
        : !appUrlValid
          ? "NEXT_PUBLIC_APP_URL is not a valid HTTPS production URL or localhost development URL."
          : appUrlLocal
            ? "The application URL is set to localhost, which is valid only for local or Codespaces QA."
            : "The canonical application URL is configured with HTTPS.",
      !appUrl || !appUrlValid ? "Set NEXT_PUBLIC_APP_URL to the exact application origin without a trailing slash." : null,
      appUrl ? { origin: appUrl } : null,
    ),
  ];
}

async function publicIdentity(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) throw Object.assign(new Error("Super Admin sign-in is required to run production diagnostics."), { status: 401 });

  const client = createRequestClient(accessToken);
  const { data: userData, error: userError } = await client.auth.getUser(accessToken);
  if (userError || !userData.user) {
    throw Object.assign(new Error(userError?.message ?? "The Supabase session is invalid or expired."), { status: 401 });
  }

  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("id,role")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !profile) {
    throw Object.assign(new Error(profileError?.message ?? "The signed-in account has no Evidara profile."), { status: 403 });
  }
  if (profile.role !== "super_admin") {
    throw Object.assign(new Error("Super Admin access is required for system-readiness diagnostics."), { status: 403 });
  }

  return { accessToken, client, user: userData.user, role: profile.role as string };
}

async function tableCheck(
  admin: Awaited<ReturnType<typeof authenticateRequest>>["admin"],
  id: string,
  area: ReadinessCheck["area"],
  label: string,
  table: string,
  columns: string,
  successMessage: string,
  action: string,
) {
  const { count, error } = await admin.from(table).select(columns, { count: "exact", head: true });
  if (error) {
    return check(id, area, label, "fail", error.message, action, { code: error.code ?? null });
  }
  return check(id, area, label, "pass", successMessage, null, { rowCount: count ?? 0 });
}

function accessChecks(): ReadinessCheck[] {
  return protectedRouteSmokeCases.map((item) => {
    const actual = canAccessWorkspace(item.role, item.workspace);
    const passed = actual === item.expected;
    return check(
      `route-${item.id}`,
      "access",
      `${item.role.replaceAll("_", " ")} → ${item.route}`,
      passed ? "pass" : "fail",
      passed
        ? `Protected-route contract returned ${actual ? "allow" : "deny"} as expected.`
        : `Protected-route contract returned ${actual ? "allow" : "deny"}; expected ${item.expected ? "allow" : "deny"}.`,
      passed ? null : "Correct src/lib/accessControl.ts and rerun the QA workflow before launch.",
    );
  });
}

export async function GET(request: Request) {
  try {
    const checks = envChecks();

    if (!isPublicSupabaseConfigured) {
      checks.push(
        check(
          "demo-mode",
          "supabase",
          "Cloud diagnostics",
          "warning",
          "Evidara is running in interactive demo mode. Database, authentication, migration and Razorpay checks were not executed.",
          "Add the Supabase public environment values, sign in as Super Admin, and run diagnostics again.",
        ),
        ...accessChecks(),
      );
      return response(report("interactive-demo", { id: null, email: null, role: null }, checks));
    }

    const identity = await publicIdentity(request);
    const actor = { id: identity.user.id, email: identity.user.email ?? null, role: identity.role };

    checks.push(
      check("auth-session", "supabase", "Authenticated Supabase session", "pass", "The access token resolves to an active Supabase user."),
      check("auth-role", "access", "Super Admin role", "pass", "The signed-in profile is authorised to view production diagnostics."),
      ...accessChecks(),
    );

    if (!isServerSupabaseReady) {
      checks.push(
        check(
          "server-diagnostics-skipped",
          "supabase",
          "Server diagnostics",
          "fail",
          "Database, Auth Admin, migration 24 and Razorpay checks were skipped because SUPABASE_SERVICE_ROLE_KEY is missing.",
          "Add the service-role key as a server-only secret and refresh this page.",
        ),
      );
      return response(report("supabase-partial", actor, checks));
    }

    const auth = await authenticateRequest(request);
    const { data: profile, error: profileError } = await auth.admin
      .from("profiles")
      .select("id,role")
      .eq("id", auth.user.id)
      .single();
    if (profileError || !profile || profile.role !== "super_admin") {
      return response({ error: "Super Admin access is required for system-readiness diagnostics." }, 403);
    }

    const [profiles, organizations, products, orders, vouchers, redemptions, migrationColumns] = await Promise.all([
      tableCheck(auth.admin, "db-profiles", "supabase", "Profiles table", "profiles", "id,role", "Profiles and role data are reachable with the service client.", "Apply the core profile migration and confirm the service-role key belongs to this project."),
      tableCheck(auth.admin, "db-organizations", "supabase", "Organizations table", "organizations", "id", "School organization data is reachable.", "Apply the organization migrations before launch."),
      tableCheck(auth.admin, "db-products", "supabase", "Products table", "products", "id,status", "The production catalogue schema is reachable.", "Apply the commerce migrations before launch."),
      tableCheck(auth.admin, "db-orders", "supabase", "Orders table", "orders", "id,status,currency", "The orders ledger is reachable.", "Apply the commerce migrations before launch."),
      tableCheck(auth.admin, "migration-24-vouchers", "migration", "Migration 24 voucher table", "voucher_codes", "id,discount_percent,purpose,active", "voucher_codes exists with the V6.7.1 hardening fields.", "Apply supabase/24_voucher_offline_payment_hardening.sql."),
      tableCheck(auth.admin, "migration-24-redemptions", "migration", "Migration 24 redemption ledger", "voucher_redemptions", "id,order_id,payment_source", "voucher_redemptions exists and is queryable.", "Apply supabase/24_voucher_offline_payment_hardening.sql."),
      tableCheck(auth.admin, "migration-24-order-columns", "migration", "Migration 24 order evidence", "orders", "id,voucher_id,payment_source,offline_reference,commerce_metadata", "orders contains voucher and payment-source evidence columns.", "Apply migration 24 and refresh the PostgREST schema cache."),
    ]);
    checks.push(profiles, organizations, products, orders, vouchers, redemptions, migrationColumns);

    const { data: authUsers, error: authAdminError } = await auth.admin.auth.admin.listUsers({ page: 1, perPage: 1 });
    checks.push(
      authAdminError
        ? check("auth-admin-api", "supabase", "Supabase Auth Admin API", "fail", authAdminError.message, "Confirm SUPABASE_SERVICE_ROLE_KEY belongs to the same Supabase project as NEXT_PUBLIC_SUPABASE_URL.")
        : check("auth-admin-api", "supabase", "Supabase Auth Admin API", "pass", "The service client can reach Supabase Auth Admin without exposing user details.", null, { sampledUsers: authUsers.users.length }),
    );

    const { error: rpcError } = await auth.admin.rpc("fulfill_voucher_order", { p_order_id: ZERO_UUID });
    if (!rpcError) {
      checks.push(check("migration-24-rpc", "migration", "Migration 24 fulfilment RPC", "warning", "The fulfilment probe returned without the expected not-found guard.", "Review fulfill_voucher_order before launch; a zero UUID should not match a real order."));
    } else if (rpcError.code === "PGRST202" || /could not find the function|schema cache/i.test(rpcError.message)) {
      checks.push(check("migration-24-rpc", "migration", "Migration 24 fulfilment RPC", "fail", rpcError.message, "Apply migration 24 and reload the Supabase PostgREST schema cache."));
    } else if (/order not found/i.test(rpcError.message)) {
      checks.push(check("migration-24-rpc", "migration", "Migration 24 fulfilment RPC", "pass", "fulfill_voucher_order exists and rejects a non-existent order before any mutation."));
    } else {
      checks.push(check("migration-24-rpc", "migration", "Migration 24 fulfilment RPC", "warning", rpcError.message, "Review the RPC error in Supabase logs. No order was modified by the zero-UUID probe.", { code: rpcError.code ?? null }));
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? null;
    const { data: razorpayData, error: razorpayError } = await identity.client.functions.invoke<RazorpayDiagnostic>("readiness-check", {
      body: { expected_app_origin: appUrl },
    });

    if (razorpayError || !razorpayData) {
      checks.push(
        check(
          "razorpay-edge-diagnostic",
          "razorpay",
          "Razorpay readiness Edge Function",
          "fail",
          razorpayError?.message ?? "The readiness-check Edge Function returned no diagnostic data.",
          "Deploy supabase/functions/readiness-check with JWT verification enabled, then configure Test Mode secrets and APP_ORIGINS.",
        ),
      );
    } else {
      checks.push(
        check(
          "razorpay-test-mode",
          "razorpay",
          "Razorpay Test Mode key",
          razorpayData.test_mode && !razorpayData.live_mode_detected ? "pass" : "fail",
          razorpayData.test_mode
            ? "RAZORPAY_KEY_ID is a Test Mode key. The key value is not exposed."
            : razorpayData.live_mode_detected
              ? "A Live Mode Razorpay key was detected. V6.8 production QA must be completed in Test Mode."
              : "RAZORPAY_KEY_ID is missing or does not match a Razorpay Test Mode key format.",
          razorpayData.test_mode ? null : "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Supabase Edge Function secrets using Test Mode credentials.",
        ),
        check(
          "razorpay-secret-pair",
          "razorpay",
          "Razorpay secret pair",
          razorpayData.key_id_present && razorpayData.key_secret_present ? "pass" : "fail",
          razorpayData.key_id_present && razorpayData.key_secret_present
            ? "Both Razorpay credential variables are present in the Edge Function environment."
            : "The Razorpay key ID and key secret are not both present.",
          razorpayData.key_id_present && razorpayData.key_secret_present ? null : "Add both secrets in Supabase Edge Function settings.",
        ),
        check(
          "razorpay-webhook-secret",
          "razorpay",
          "Razorpay webhook secret",
          razorpayData.webhook_secret_present ? "pass" : "fail",
          razorpayData.webhook_secret_present ? "RAZORPAY_WEBHOOK_SECRET is present." : "RAZORPAY_WEBHOOK_SECRET is missing.",
          razorpayData.webhook_secret_present ? null : "Create a Test Mode webhook secret and store the identical value in Supabase.",
        ),
        check(
          "razorpay-app-origins",
          "razorpay",
          "Payment origin allow-list",
          razorpayData.app_origins_configured && razorpayData.expected_origin_allowed !== false ? "pass" : "fail",
          !razorpayData.app_origins_configured
            ? "APP_ORIGINS is empty."
            : razorpayData.expected_origin_allowed === false
              ? "The canonical application origin is not included in APP_ORIGINS."
              : `APP_ORIGINS contains ${razorpayData.app_origins_count ?? 0} allowed origin(s).`,
          razorpayData.app_origins_configured && razorpayData.expected_origin_allowed !== false
            ? null
            : "Add the exact application origin without a trailing slash to APP_ORIGINS.",
        ),
        check(
          "razorpay-api-auth",
          "razorpay",
          "Razorpay API credential validation",
          razorpayData.credentials_valid === true ? "pass" : razorpayData.credentials_valid === null ? "warning" : "fail",
          razorpayData.api_message ?? "Razorpay credential validation did not return a message.",
          razorpayData.credentials_valid === true ? null : "Regenerate Test Mode keys if authentication fails, then update the Edge Function secrets together.",
        ),
      );
    }

    return response(report("supabase", actor, checks));
  } catch (error) {
    const status = Number((error as { status?: number }).status ?? 500);
    return errorResponse(error, "Evidara readiness diagnostics failed.", status);
  }
}
