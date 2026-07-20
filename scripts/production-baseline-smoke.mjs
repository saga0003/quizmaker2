import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const passes = [];
const cache = new Map();

function read(relativePath) {
  if (cache.has(relativePath)) return cache.get(relativePath);
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`${relativePath}: file is missing`);
    cache.set(relativePath, "");
    return "";
  }
  const content = fs.readFileSync(absolutePath, "utf8");
  cache.set(relativePath, content);
  return content;
}

function expect(label, condition, message) {
  if (condition) passes.push(label);
  else failures.push(`${label}: ${message}`);
}

function contains(relativePath, marker, label = marker) {
  expect(`${relativePath} contains ${label}`, read(relativePath).includes(marker), `missing marker ${JSON.stringify(marker)}`);
}

function containsOne(relativePath, markers, label) {
  const content = read(relativePath);
  expect(`${relativePath} contains ${label}`, markers.some((marker) => content.includes(marker)), `missing all accepted markers: ${markers.map(JSON.stringify).join(", ")}`);
}

function excludes(relativePath, marker, label = marker) {
  expect(`${relativePath} excludes ${label}`, !read(relativePath).toLowerCase().includes(marker.toLowerCase()), `unexpected marker ${JSON.stringify(marker)}`);
}

contains("supabase/18_achievement_certificate_operations.sql", "public.exam_attempts");
contains("supabase/18_achievement_certificate_operations.sql", "public.benchmark_contributions");
contains("supabase/17_achievement_badge_schema.sql", "visibility text not null default 'link_only'");
contains("supabase/17_achievement_badge_schema.sql", "revoke all on public.student_achievements from anon, authenticated");
contains("supabase/19_achievement_uuid_aggregate_compatibility.sql", "create aggregate public.max(uuid)");
contains("supabase/20_achievement_evidence_audit_hardening.sql", "achievement.evidence_re_evaluated");
contains("supabase/21_achievement_concurrency_hardening.sql", "pg_advisory_xact_lock");
contains("supabase/21_achievement_concurrency_hardening.sql", "achievement_award_lock_key");
contains("supabase/22_achievement_certificate_restore_hardening.sql", "A newer active certificate already exists");
contains("supabase/22_achievement_certificate_restore_hardening.sql", "Restore the linked achievement");
contains("supabase/23_achievement_benchmark_validity_hardening.sql", "achievement_exam_attempt_is_valid");
contains("supabase/23_achievement_benchmark_validity_hardening.sql", "contribution.is_valid = true");
contains("supabase/23_achievement_benchmark_validity_hardening.sql", "public.achievement_exam_attempt_is_valid(a.id, a.metadata)");
contains("supabase/24_voucher_offline_payment_hardening.sql", "discount_percent integer not null check (discount_percent between 1 and 100)");
contains("supabase/24_voucher_offline_payment_hardening.sql", "fulfill_voucher_order");
contains("supabase/24_voucher_offline_payment_hardening.sql", "check (discount_percent < 100 or allowed_email is not null or organization_id is not null)", "100% voucher account-or-school binding constraint");
contains("supabase/24_voucher_offline_payment_hardening.sql", "voucher_redemptions");
contains("supabase/functions/create-razorpay-order/index.ts", "APP_ORIGINS");
contains("supabase/functions/create-razorpay-order/index.ts", "evidara_order_id");
contains("supabase/functions/create-razorpay-order/index.ts", "free_access");
containsOne("supabase/functions/verify-razorpay-payment/index.ts", ["Payment signature verification failed", "payment signature verification failed"], "payment-signature rejection");
contains("src/app/admin/products/page.tsx", "AdminVoucherManager");
containsOne("src/components/commerce/ProductStore.tsx", ['name: "Evidara"', 'name:"Evidara"'], "Evidara checkout name");
contains("src/lib/server/supabaseServer.ts", "isServerSupabaseReady");
contains("src/app/api/health/route.ts", "supabase-partial");
contains("src/app/api/achievements/route.ts", "pageSize = 500");
contains("src/app/api/achievements/route.ts", "limit: 5000");
contains("src/app/api/achievements/route.ts", "chunks(achievementIds)");
contains("src/app/api/achievements/route.ts", "chunks(studentIds)");
contains("src/app/api/certificates/route.ts", "X-Robots-Tag");
contains("next.config.ts", "X-Robots-Tag");
contains("src/app/api/certificates/route.ts", "evidara-logo-light.png");
contains("next.config.ts", "outputFileTracingIncludes");
contains("src/app/api/certificates/route.ts", "#0E5A5A");
contains("src/app/api/certificates/route.ts", "#F2B84B");
contains("src/app/api/certificates/route.ts", "not a prediction, permanent label or guarantee");
contains("src/app/api/certificates/route.ts", "certificate_withdrawn");
contains("src/app/api/certificates/route.ts", "url.origin");
excludes("src/app/api/certificates/route.ts", "issued_at,status,revoked_at,revoked_reason", "private certificate field bundle");
excludes("src/app/api/certificates/route.ts", "#7456e8", "legacy purple");
excludes("src/components/achievements/Achievements.module.css", "#7456e8", "legacy purple");
excludes("src/app/api/certificates/route.ts", "#18b7a0", "legacy turquoise");
excludes("src/components/achievements/Achievements.module.css", "#18b7a0", "legacy turquoise");
contains("wrangler.jsonc", '"main": ".open-next/worker.js"');
contains("wrangler.jsonc", '"nodejs_compat"');
contains("README.md", "24_voucher_offline_payment_hardening.sql");

const packageJson = JSON.parse(read("package.json") || "{}");
expect("package.json version is 6.8.0", packageJson.version === "6.8.0", `received ${packageJson.version ?? "missing"}`);
contains("src/app/api/health/route.ts", 'release: "6.8.0"');
contains("src/app/api/config/route.ts", 'release: "6.8.0"');
contains("src/app/admin/readiness/page.tsx", '<ProtectedPage allowed="admin">');
contains("src/app/api/admin/readiness/route.ts", "fulfill_voucher_order");
contains("src/app/api/admin/readiness/route.ts", 'functions.invoke<RazorpayDiagnostic>("readiness-check"');
contains("supabase/functions/readiness-check/index.ts", 'startsWith("rzp_test_")');
contains("supabase/functions/readiness-check/index.ts", 'startsWith("rzp_live_")');
contains(".github/workflows/evidara-v6-8-qa.yml", "evidara-v6-8-production-qa");
excludes(".github/workflows/evidara-v6-8-qa.yml", "vercel", "Vercel integration");

const lines = [
  `Evidara V6.8 production baseline: ${passes.length} passed, ${failures.length} failed.`,
  ...passes.map((item) => `PASS ${item}`),
  ...failures.map((item) => `FAIL ${item}`),
];
console.log(lines.join("\n"));
if (failures.length) process.exit(1);
