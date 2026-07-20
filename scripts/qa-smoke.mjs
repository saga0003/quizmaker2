import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const passes = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: file is missing`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function expect(label, condition, failureMessage) {
  if (condition) passes.push(label);
  else failures.push(`${label}: ${failureMessage}`);
}

const packageJson = JSON.parse(read("package.json") || "{}");
expect("package version", packageJson.version === "6.8.0", `expected 6.8.0, received ${packageJson.version ?? "missing"}`);
expect("QA command", packageJson.scripts?.qa === "npm run lint && npm run typecheck && npm run qa:smoke && npm run build", "package.json must run lint, typecheck, smoke checks and build");
expect("check alias", packageJson.scripts?.check === "npm run qa", "npm run check must use the V6.8 QA gate");

const packageLock = JSON.parse(read("package-lock.json") || "{}");
expect("lockfile release version", packageLock.version === "6.8.0", `expected root lockfile version 6.8.0, received ${packageLock.version ?? "missing"}`);
expect(
  "lockfile workspace version",
  packageLock.packages?.[""]?.version === "6.8.0",
  `expected workspace lockfile version 6.8.0, received ${packageLock.packages?.[""]?.version ?? "missing"}`,
);

const migration24 = read("supabase/24_voucher_offline_payment_hardening.sql");
for (const marker of ["create table if not exists public.voucher_codes", "create table if not exists public.voucher_redemptions", "create or replace function public.fulfill_voucher_order", "payment_source"]) {
  expect(`migration 24 marker: ${marker}`, migration24.includes(marker), "required migration 24 capability is missing");
}

const accessControl = read("src/lib/accessControl.ts");
expect("shared admin guard", accessControl.includes('workspace === "admin"') && accessControl.includes('role === "super_admin"'), "Super Admin access contract is missing");
expect("protected-route matrix", accessControl.includes("protectedRouteSmokeCases") && accessControl.includes("admin-student"), "role smoke matrix is incomplete");

const protectedPage = read("src/components/ProtectedPage.tsx");
expect("client guard uses shared contract", protectedPage.includes("canAccessWorkspace") && protectedPage.includes("workspaceHome"), "ProtectedPage must consume the shared access-control contract");

const readinessPage = read("src/app/admin/readiness/page.tsx");
expect("readiness page protected", readinessPage.includes('<ProtectedPage allowed="admin">'), "readiness page must be Super Admin protected");

const readinessApi = read("src/app/api/admin/readiness/route.ts");
expect("readiness API authenticates", readinessApi.includes("authenticateRequest") && readinessApi.includes("publicIdentity"), "readiness API must validate the Supabase session");
expect("readiness API enforces Super Admin", readinessApi.includes('profile.role !== "super_admin"'), "readiness API must reject non-Super Admin roles");
expect("migration 24 runtime probe", readinessApi.includes("fulfill_voucher_order") && readinessApi.includes("voucher_redemptions"), "migration 24 runtime diagnostics are incomplete");
expect("Razorpay diagnostic invocation", readinessApi.includes('functions.invoke<RazorpayDiagnostic>("readiness-check"'), "Razorpay readiness Edge Function is not invoked");

const edgeDiagnostic = read("supabase/functions/readiness-check/index.ts");
expect("Razorpay Test Mode detection", edgeDiagnostic.includes('startsWith("rzp_test_")'), "Test Mode key detection is missing");
expect("Live Mode QA stop", edgeDiagnostic.includes('startsWith("rzp_live_")') && edgeDiagnostic.includes("intentionally skipped"), "Live Mode must be detected and skipped during QA");
expect("Razorpay credential probe", edgeDiagnostic.includes("https://api.razorpay.com/v1/orders?count=1"), "safe Test Mode API validation is missing");
expect("secret values not returned", !edgeDiagnostic.includes("key_id: keyId") && !edgeDiagnostic.includes("key_secret: keySecret") && !edgeDiagnostic.includes("webhook_secret: webhookSecret"), "diagnostics must never return secret values");

const healthRoute = read("src/app/api/health/route.ts");
const configRoute = read("src/app/api/config/route.ts");
expect("health release metadata", healthRoute.includes('release: "6.8.0"'), "/api/health is not on V6.8.0");
expect("config release metadata", configRoute.includes('release: "6.8.0"'), "/api/config is not on V6.8.0");

const workflow = read(".github/workflows/evidara-v6-8-qa.yml");
expect("branch-only QA trigger", workflow.includes("evidara-v6-8-production-qa"), "workflow must target the V6.8 QA branch");
expect("workflow runs npm ci", workflow.includes("npm ci"), "workflow must use reproducible dependency installation");
for (const command of ["npm run lint", "npm run typecheck", "npm run qa:smoke", "npm run build"]) {
  expect(`workflow stage: ${command}`, workflow.includes(command), `workflow must run ${command}`);
}
for (const forbidden of ["vercel", "wrangler deploy", "supabase functions deploy", "npm run cf:deploy"]) {
  expect(`workflow has no deployment command: ${forbidden}`, !workflow.toLowerCase().includes(forbidden), "QA workflow must not deploy anything");
}

const codespaces = read("docs/V6_8_CODESPACES_QA.md");
expect("Codespaces checklist", codespaces.includes("Razorpay Test Mode") && codespaces.includes("migration 24") && codespaces.includes("Protected-route"), "Codespaces checklist is incomplete");

if (failures.length > 0) {
  console.error("\nEvidara V6.8 smoke checks failed:\n");
  for (const failure of failures) console.error(`- ${failure}`);
  console.error(`\n${passes.length} checks passed; ${failures.length} failed.\n`);
  process.exit(1);
}

console.log(`Evidara V6.8 smoke checks passed (${passes.length} checks).`);
for (const item of passes) console.log(`✓ ${item}`);
