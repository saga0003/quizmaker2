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
      release: "8.0.0-dev",
      configured,
      serverReady,
      mode: !configured ? "interactive-demo" : serverReady ? "supabase" : "supabase-partial",
      deploymentTarget: "development-only",
      qaRelease: false,
      interface: "v8-paper-builder-development",
      deploymentEnabled: false,
      modules: [
        "v7-final-question-bank",
        "supabase-auth",
        "paper-programme-catalogue",
        "paper-definition-drafts",
        "paper-draft-autosave",
        "paper-sections",
        "server-paged-question-selection",
        "paper-question-arrangement",
        "paper-marking-rules",
        "paper-shuffle-rules",
        "paper-question-reuse-rules",
        "paper-preview",
        "paper-validation",
        "paper-review-submission",
        "paper-draft-duplication",
        "paper-version-foundation",
        "paper-template-foundation",
        "paper-review-foundation",
        "paper-audit-history",
      ],
      excludedFromV8Papers: [
        "products",
        "pricing",
        "payments",
        "bundles",
        "student-entitlements",
        "agent-codes",
        "test-delivery",
        "results",
        "analytics",
      ],
      issue: healthy
        ? null
        : "SUPABASE_SERVICE_ROLE_KEY is required for authenticated server operations in the V8 Papers development environment.",
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
