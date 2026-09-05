import { NextResponse } from "next/server";
import { EVIDARA_DEPLOYMENT_TARGET, EVIDARA_RELEASE } from "@/lib/release";
import { isPlatformAdmin } from "@/lib/roles";
import { isR2Configured } from "@/lib/server/r2";
import { authenticateRequest, isServerSupabaseConfigured } from "@/lib/server/supabaseServer";

type HealthSnapshot = {
  generatedAt?: string;
  usage?: Record<string, number>;
  failures24h?: Record<string, number>;
};

export async function GET(request: Request) {
  if (!isServerSupabaseConfigured) {
    return NextResponse.json(
      { error: "Server cloud environment is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const auth = await authenticateRequest(request);
    const { data: profile, error: profileError } = await auth.admin
      .from("profiles")
      .select("role")
      .eq("id", auth.user.id)
      .single();

    if (profileError || !profile || !isPlatformAdmin(profile.role)) {
      return NextResponse.json(
        { error: "Platform administrator permission is required." },
        { status: 403, headers: { "Cache-Control": "no-store" } },
      );
    }

    const startedAt = Date.now();
    const { data, error } = await auth.admin.rpc("phase1_platform_health_snapshot");
    const databaseLatencyMs = Date.now() - startedAt;
    if (error) {
      return NextResponse.json(
        {
          error: "Database health snapshot is unavailable.",
          deployment: { status: "ready", target: EVIDARA_DEPLOYMENT_TARGET, release: EVIDARA_RELEASE },
          database: { status: "degraded", latencyMs: databaseLatencyMs },
          storage: { status: isR2Configured ? "configured" : "degraded" },
        },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const snapshot = (data ?? {}) as HealthSnapshot;
    const failures = snapshot.failures24h ?? {};
    const failureTotal = Object.values(failures).reduce((sum, value) => sum + Number(value || 0), 0);

    return NextResponse.json(
      {
        generatedAt: snapshot.generatedAt ?? new Date().toISOString(),
        healthy: isR2Configured && failureTotal === 0,
        deployment: { status: "ready", target: EVIDARA_DEPLOYMENT_TARGET, release: EVIDARA_RELEASE },
        database: { status: "ready", latencyMs: databaseLatencyMs },
        storage: { status: isR2Configured ? "configured" : "degraded" },
        usage: snapshot.usage ?? {},
        failures24h: failures,
        evidenceWindowHours: 24,
        countStrategy: "postgres-aggregate-rpc",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = Number((error as { status?: number })?.status ?? 500);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load platform health." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
