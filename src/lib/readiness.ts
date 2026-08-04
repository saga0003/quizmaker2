export type ReadinessStatus = "pass" | "warning" | "fail" | "info";
export type ReadinessArea = "configuration" | "supabase" | "migration" | "razorpay" | "access" | "release";

export type ReadinessCheck = {
  id: string;
  area: ReadinessArea;
  label: string;
  status: ReadinessStatus;
  message: string;
  action?: string | null;
  details?: Record<string, string | number | boolean | null> | null;
};

export type ReadinessReport = {
  release: string;
  generatedAt: string;
  mode: "interactive-demo" | "supabase" | "supabase-partial";
  overall: Exclude<ReadinessStatus, "info">;
  actor: { id: string | null; email: string | null; role: string | null };
  summary: { pass: number; warning: number; fail: number; info: number };
  checks: ReadinessCheck[];
};

export function summarizeReadiness(checks: ReadinessCheck[]): ReadinessReport["summary"] {
  return checks.reduce(
    (summary, check) => ({ ...summary, [check.status]: summary[check.status] + 1 }),
    { pass: 0, warning: 0, fail: 0, info: 0 },
  );
}

export function overallReadiness(checks: ReadinessCheck[]): ReadinessReport["overall"] {
  if (checks.some((check) => check.status === "fail")) return "fail";
  if (checks.some((check) => check.status === "warning")) return "warning";
  return "pass";
}
