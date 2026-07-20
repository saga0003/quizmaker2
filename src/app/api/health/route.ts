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
      release: "6.7.0",
      configured,
      serverReady,
      mode: !configured ? "interactive-demo" : serverReady ? "supabase" : "supabase-partial",
      modules: [
        "question-bank",
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
      ],
      issue: healthy ? null : "SUPABASE_SERVICE_ROLE_KEY is required for authenticated server operations.",
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
