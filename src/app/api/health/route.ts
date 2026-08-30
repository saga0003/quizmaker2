import { NextResponse } from "next/server";
import {
  EVIDARA_ACTIVE_MODULES,
  EVIDARA_DEPLOYMENT_TARGET,
  EVIDARA_INTERFACE,
  EVIDARA_RELEASE,
  EVIDARA_RETIRED_MODULES,
} from "@/lib/release";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const configured = Boolean(supabaseUrl && supabasePublicKey);
  const serverSecret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serverReady = Boolean(configured && serverSecret);
  const healthy = !configured || serverReady;

  return NextResponse.json(
    {
      healthy,
      release: EVIDARA_RELEASE,
      configured,
      serverReady,
      mode: !configured ? "interactive-demo" : serverReady ? "supabase" : "supabase-partial",
      deploymentTarget: EVIDARA_DEPLOYMENT_TARGET,
      qaRelease: true,
      interface: EVIDARA_INTERFACE,
      modules: EVIDARA_ACTIVE_MODULES,
      retiredModules: EVIDARA_RETIRED_MODULES,
      issue: healthy
        ? null
        : `SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) is required for authenticated server operations and Evidara ${EVIDARA_RELEASE} launch diagnostics.`,
    },
    {
      status: healthy ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
