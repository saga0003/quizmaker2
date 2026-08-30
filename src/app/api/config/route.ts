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

  return NextResponse.json(
    {
      release: EVIDARA_RELEASE,
      configured,
      serverReady,
      mode: !configured ? "interactive-demo" : serverReady ? "supabase" : "supabase-partial",
      subscriptionModel: "annual-institution-unlimited-tests-students",
      deploymentTarget: EVIDARA_DEPLOYMENT_TARGET,
      qaRelease: true,
      interface: EVIDARA_INTERFACE,
      publicKeyType: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        ? "publishable"
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? "anon"
          : null,
      modules: EVIDARA_ACTIVE_MODULES,
      retiredModules: EVIDARA_RETIRED_MODULES,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
