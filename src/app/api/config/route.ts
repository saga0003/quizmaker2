import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = Boolean(supabaseUrl && supabasePublicKey);
  const serverReady = Boolean(configured && process.env.SUPABASE_SERVICE_ROLE_KEY);

  return NextResponse.json(
    {
      release: "6.7.0",
      configured,
      serverReady,
      mode: !configured ? "interactive-demo" : serverReady ? "supabase" : "supabase-partial",
      subscriptionModel: "annual-school",
      publicKeyType: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        ? "publishable"
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? "anon"
          : null,
      modules: ["shared-benchmarks", "achievements", "verifiable-certificates"],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
