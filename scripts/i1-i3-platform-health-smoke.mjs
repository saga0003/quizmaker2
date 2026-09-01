import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const api = read('src/app/api/admin/platform-health/route.ts');
const ui = read('src/components/evidara/admin-audit-health.tsx');
const overview = read('src/app/api/admin/platform-overview/route.ts');

const checks = [
  ['privileged platform health route authenticates', api.includes('authenticateRequest(request)') && api.includes('isPlatformAdmin(profile.role)')],
  ['health snapshot comes from PostgreSQL RPC', api.includes('.rpc("phase1_platform_health_snapshot")')],
  ['deployment health is exposed', api.includes('deployment: { status: "ready"')],
  ['database health and latency are exposed', api.includes('database: { status: "ready", latencyMs: databaseLatencyMs }')],
  ['R2 storage readiness is exposed', api.includes('storage: { status: isR2Configured ? "configured" : "degraded" }')],
  ['24h failure evidence is exposed', api.includes('failures24h') && api.includes('evidenceWindowHours: 24')],
  ['count strategy explicitly identifies PostgreSQL aggregation', api.includes('countStrategy: "postgres-aggregate-rpc"')],
  ['Audit & Health uses privileged endpoint', ui.includes("authFetchPlatformHealth") && ui.includes("'/api/admin/platform-health/'")],
  ['Audit & Health renders deployment database storage and failure evidence', ['Deployment','Database','Storage','24h failures','Failure evidence'].every((text) => ui.includes(text))],
  ['Audit & Health renders PostgreSQL usage snapshot', ui.includes('PostgreSQL usage snapshot') && ui.includes('countStrategy')],
  ['usage snapshot covers core Phase 1 entities', ['Users','Schools','Active students','Questions','Papers','Attempts','Responses','Active resources'].every((text) => ui.includes(text))],
  ['failure snapshot covers imports start save submit', ['Failed import rows','Failed test starts','Failed answer saves','Failed submissions'].every((text) => ui.includes(text))],
  ['platform overview exact counts use HEAD requests', overview.includes('select("id",{count:"exact",head:true})')],
  ['student licence usage does not download full membership rows', !overview.includes('.select("organization_id").in("organization_id",orgIds).eq("status","active")')],
  ['student licence usage is counted database-side per organization', overview.includes('student_school_memberships').includes ? false : true],
];

// Keep the final assertion explicit because the route is intentionally compact.
checks[checks.length - 1][1] = overview.includes('from("student_school_memberships").select("id",{count:"exact",head:true})');

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} I1-I3: ${name}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`I1-I3 platform health regression failed: ${failed}/${checks.length}`);
  process.exit(1);
}
console.log(`I1-I3 platform health regression passed: ${checks.length}/${checks.length}`);
