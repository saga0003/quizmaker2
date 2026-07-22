import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = Boolean(supabaseUrl && supabasePublicKey);
  const serverReady = Boolean(configured && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const healthy = !configured || serverReady;

  return NextResponse.json(
    {
      healthy,
      release: "7.1.1",
      configured,
      serverReady,
      mode: !configured ? "interactive-demo" : serverReady ? "supabase" : "supabase-partial",
      deploymentTarget: "cloudflare-workers",
      qaRelease: true,
      interface: "v7-1-1-questions-final",
      modules: [
        "v7-interactive-interface",
        "supabase-auth",
        "question-bank",
        "question-import-preflight",
        "question-image-zip-import",
        "question-taxonomy-inline-create",
        "question-import-undo-redo",
        "question-error-navigation",
        "question-bulk-delete-audit",
        "cross-role-question-visibility",
        "protected-assessment-content",
        "imports",
        "paper-builder",
        "secure-exam",
        "analytics",
        "subscriptions",
        "promotion",
        "resources",
        "shared-benchmarks",
        "achievements",
        "verifiable-certificates",
        "razorpay-commerce",
        "percentage-vouchers",
        "offline-payment-records",
        "production-readiness-dashboard",
        "migration-24-diagnostics",
        "razorpay-test-mode-diagnostics",
        "protected-route-smoke-checks",
      ],
      issue: healthy ? null : "SUPABASE_SERVICE_ROLE_KEY is required for authenticated server operations and V7.1.1 launch diagnostics.",
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
