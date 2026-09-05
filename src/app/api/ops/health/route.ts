import { NextResponse } from "next/server";
import { EVIDARA_RELEASE } from "@/lib/release";
import { isR2Configured } from "@/lib/server/r2";
import { createServiceClient, isServerSupabaseReady } from "@/lib/server/supabaseServer";

type HealthSnapshot = {
  failures24h?: Record<string, number>;
};

const FAILURE_THRESHOLD = 0;

export async function GET() {
  const checkedAt = new Date().toISOString();
  if (!isServerSupabaseReady) {
    return NextResponse.json(
      { ok: false, checkedAt, release: EVIDARA_RELEASE, dependencies: { database: false, auth: false, storage: isR2Configured } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const admin = createServiceClient();
    const [{ data: snapshotData, error: snapshotError }, authResult] = await Promise.all([
      admin.rpc("phase1_platform_health_snapshot"),
      admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
    ]);
    const snapshot = (snapshotData ?? {}) as HealthSnapshot;
    const failures = snapshot.failures24h ?? {};
    const failureTotal = Object.values(failures).reduce((sum, value) => sum + Number(value || 0), 0);
    const databaseOk = !snapshotError;
    const authOk = !authResult.error;
    const storageOk = isR2Configured;
    const activityOk = failureTotal <= FAILURE_THRESHOLD;
    const ok = databaseOk && authOk && storageOk && activityOk;

    if (!ok) {
      console.error("EVIDARA_OPS_ALERT", {
        checkedAt,
        databaseOk,
        authOk,
        storageOk,
        activityOk,
        failureCategories: Object.fromEntries(Object.entries(failures).filter(([, count]) => Number(count || 0) > 0)),
      });
    }

    return NextResponse.json(
      {
        ok,
        checkedAt,
        release: EVIDARA_RELEASE,
        dependencies: { database: databaseOk, auth: authOk, storage: storageOk },
        activity: {
          importFailures: Number(failures.imports ?? 0) > FAILURE_THRESHOLD,
          testStartFailures: Number(failures.testStarts ?? 0) > FAILURE_THRESHOLD,
          answerSaveFailures: Number(failures.answerSaves ?? 0) > FAILURE_THRESHOLD,
          submissionFailures: Number(failures.submissions ?? 0) > FAILURE_THRESHOLD,
        },
      },
      { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("EVIDARA_OPS_ALERT", { checkedAt, kind: "health-probe-exception", error });
    return NextResponse.json(
      { ok: false, checkedAt, release: EVIDARA_RELEASE, dependencies: { database: false, auth: false, storage: isR2Configured } },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
