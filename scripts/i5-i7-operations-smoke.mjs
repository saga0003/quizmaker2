import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const ops = read('src/app/api/ops/health/route.ts');
const storage = read('src/lib/server/publicQuestionAssetStorage.ts');
const monitor = read('.github/workflows/phase1-production-monitor.yml');
const runbook = read('PHASE1_OPERATIONS_RUNBOOK.md');
const indexes = read('supabase/migrations/20260901224500_phase1_hot_path_indexes.sql');

const checks = [
  ['public ops probe is sanitized and no-store', ops.includes('Cache-Control') && ops.includes('dependencies:') && !ops.includes('usage: snapshot')],
  ['ops probe checks database snapshot', ops.includes('phase1_platform_health_snapshot')],
  ['ops probe checks auth dependency', ops.includes('auth.admin.listUsers')],
  ['ops probe checks real Supabase storage dependency', ops.includes('probePublicQuestionAssetStorage') && storage.includes("PUBLIC_QUESTION_ASSET_BUCKET = 'question-assets'") && storage.includes(".list('', { limit: 1 })")],
  ['ops probe detects import/start/save/submit failures', ['imports','testStarts','answerSaves','submissions'].every((key) => ops.includes(key))],
  ['ops probe emits structured alert signal', ops.includes('EVIDARA_OPS_ALERT')],
  ['scheduled production monitor exists', monitor.includes("cron: '17 * * * *'") && monitor.includes('workflow_dispatch')],
  ['monitor probes canonical public application', monitor.includes('https://quizmaker2.vercel.app') && !monitor.includes('quizmaker2-saga0003s-projects.vercel.app')],
  ['monitor fails on unhealthy dependency/activity signal', monitor.includes('dependency unhealthy') && monitor.includes('failure signal active')],
  ['runbook covers monitoring and first response', runbook.includes('Monitoring and first response')],
  ['runbook covers database backup/PITR strategy', runbook.includes('Supabase database backup / PITR strategy') && runbook.includes('PITR')],
  ['runbook covers Supabase Storage recovery', runbook.includes('Supabase Storage recovery strategy') && runbook.includes('question-assets')],
  ['runbook covers Vercel rollback', runbook.includes('Vercel rollback') && runbook.includes('last known-good production deployment')],
  ['runbook keeps web and database rollback separate', runbook.includes('does not automatically roll back Supabase')],
  ['exam hot-path index is versioned', indexes.includes('exam_attempts_org_status_expiry_idx')],
  ['student hot-path index is versioned', indexes.includes('student_memberships_org_status_section_student_idx')],
  ['question hot-path index is versioned', indexes.includes('questions_org_status_taxonomy_updated_idx')],
  ['paper hot-path index is versioned', indexes.includes('question_papers_org_status_window_idx')],
  ['assignment hot-path index is versioned', indexes.includes('paper_assignments_org_student_status_idx')],
  ['all indexes are idempotent', (indexes.match(/create index if not exists/g) ?? []).length === 5],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} I5-I7: ${name}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`I5-I7 operations regression failed: ${failed}/${checks.length}`);
  process.exit(1);
}
console.log(`I5-I7 operations regression passed: ${checks.length}/${checks.length}`);
