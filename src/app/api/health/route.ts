import { NextResponse } from "next/server";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = Boolean(supabaseUrl && supabasePublicKey);

  return NextResponse.json(
    {
      healthy: true,
      release: "4.0.1",
      mode: configured ? "supabase" : "interactive-demo",
      modules: [
        "question-bank",
        "imports",
        "paper-builder",
        "secure-exam",
        "analytics",
        "subscriptions",
        "promotion",
        "resources",
      ],
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
