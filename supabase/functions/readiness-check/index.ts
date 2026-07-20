import { createClient } from "npm:@supabase/supabase-js@2";

function configuredOrigins() {
  return (Deno.env.get("APP_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function corsHeaders(req: Request) {
  const origin = (req.headers.get("origin") ?? "").replace(/\/$/, "");
  const origins = configuredOrigins();
  const permitted = origins.length === 0 || !origin || origins.includes(origin);
  return {
    "Access-Control-Allow-Origin": permitted ? (origin || "*") : origins[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function requestOriginAllowed(req: Request) {
  const origin = (req.headers.get("origin") ?? "").replace(/\/$/, "");
  const origins = configuredOrigins();
  return origins.length === 0 || !origin || origins.includes(origin);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed." }, 405);
  if (!requestOriginAllowed(req)) return json(req, { error: "This application origin is not allowed." }, 403);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json(req, { error: "Supabase Edge Function environment is incomplete." }, 500);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    const accessToken = authorization.replace(/^Bearer\s+/i, "");
    if (!accessToken) return json(req, { error: "Super Admin sign-in is required." }, 401);

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
    if (authError || !authData.user) {
      return json(req, { error: authError?.message ?? "The Supabase session is invalid or expired." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .maybeSingle();
    if (profileError || profile?.role !== "super_admin") {
      return json(req, { error: "Super Admin access is required for payment diagnostics." }, 403);
    }

    const body = await req.json().catch(() => ({})) as { expected_app_origin?: string | null };
    const expectedOrigin = (body.expected_app_origin ?? "").trim().replace(/\/$/, "");
    const origins = configuredOrigins();
    const keyId = Deno.env.get("RAZORPAY_KEY_ID") ?? "";
    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET") ?? "";
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
    const testMode = keyId.startsWith("rzp_test_");
    const liveModeDetected = keyId.startsWith("rzp_live_");

    let credentialsValid: boolean | null = null;
    let apiMessage = "Razorpay API validation was not run because the Test Mode credential pair is incomplete.";

    if (liveModeDetected) {
      apiMessage = "Live Mode key detected. Credential validation was intentionally skipped during V6.8 production QA.";
    } else if (testMode && keySecret) {
      try {
        const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders?count=1", {
          method: "GET",
          headers: { Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}` },
        });
        credentialsValid = razorpayResponse.ok;
        apiMessage = razorpayResponse.ok
          ? "Razorpay accepted the configured Test Mode credential pair."
          : razorpayResponse.status === 401
            ? "Razorpay rejected the Test Mode credential pair."
            : `Razorpay API returned HTTP ${razorpayResponse.status}.`;
      } catch {
        credentialsValid = null;
        apiMessage = "The Edge Function could not reach the Razorpay API. Retry before launch and review Supabase function logs if it persists.";
      }
    }

    return json(req, {
      release: "6.8.0",
      test_mode: testMode,
      live_mode_detected: liveModeDetected,
      key_id_present: Boolean(keyId),
      key_secret_present: Boolean(keySecret),
      webhook_secret_present: Boolean(webhookSecret),
      app_origins_configured: origins.length > 0,
      app_origins_count: origins.length,
      expected_origin_allowed: expectedOrigin ? origins.includes(expectedOrigin) : null,
      credentials_valid: credentialsValid,
      api_message: apiMessage,
    });
  } catch (error) {
    const value = error as { message?: string };
    return json(req, { error: value.message ?? "Unexpected payment-readiness diagnostic error." }, 500);
  }
});
