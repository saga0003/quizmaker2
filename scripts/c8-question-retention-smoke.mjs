import fs from 'node:fs';

const retentionPath = 'supabase/migrations/20260831154100_phase1_question_retention_policy.sql';
const indexPath = 'supabase/migrations/20260831154200_phase1_question_retention_lookup_index.sql';
const workflowPath = '.github/workflows/phase1-release-gate.yml';
const collaborationPath = 'supabase/migrations/20260831145400_phase1_question_collaboration_scope.sql';

const retention = fs.readFileSync(retentionPath, 'utf8');
const indexSql = fs.readFileSync(indexPath, 'utf8');
const workflow = fs.readFileSync(workflowPath, 'utf8');
const collaboration = fs.existsSync(collaborationPath) ? fs.readFileSync(collaborationPath, 'utf8') : '';

const checks = [
  ['retention trigger function exists', /function public\.enforce_question_retention_policy_v1\(\)/i.test(retention)],
  ['retention function is security definer', /security definer/i.test(retention)],
  ['retention function pins search path', /set search_path\s*=\s*public, auth/i.test(retention)],
  ['archive transition is explicit', /new\.status\s*=\s*'archived'::public\.question_status/i.test(retention)],
  ['platform archive requires Super Admin', /ROLE_SUPER_ADMIN/.test(retention) && /Only Super Admin may archive platform questions/.test(retention)],
  ['institution archive requires school manager', /is_evidara_school_manager\(old\.organization_id, v_uid\)/.test(retention) && /Only School Admin may archive institution questions/.test(retention)],
  ['ordinary question reviewer is not archive authority', !/is_question_reviewer_v1/.test(retention)],
  ['permanent delete limited to draft or rejected', /old\.status not in \('draft'::public\.question_status, 'rejected'::public\.question_status\)/i.test(retention)],
  ['used-in-paper deletion is blocked', /from public\.paper_questions pq[\s\S]*pq\.question_id = old\.id/i.test(retention)],
  ['delete errors direct archive instead', /archive retained questions instead/i.test(retention) && /archive them instead/i.test(retention)],
  ['trigger covers status updates and deletes', /before update of status or delete on public\.questions/i.test(retention)],
  ['browser roles cannot execute trigger helper', /revoke all on function public\.enforce_question_retention_policy_v1\(\) from public, anon, authenticated/i.test(retention)],
  ['paper-question retention lookup is indexed', /create index if not exists paper_questions_question_id_idx[\s\S]*public\.paper_questions\(question_id\)/i.test(indexSql)],
  ['C7 collaboration migration remains present', collaboration.length > 0],
  ['release gate executes C8 regression', /node scripts\/c8-question-retention-smoke\.mjs/.test(workflow)],
];

let failed = 0;
for (const [name, ok] of checks) {
  if (ok) console.log(`PASS ${name}`);
  else {
    failed += 1;
    console.error(`FAIL ${name}`);
  }
}

if (failed) {
  console.error(`\nC8 retention smoke failed: ${failed}/${checks.length} checks failed.`);
  process.exit(1);
}
console.log(`\nC8 retention smoke passed: ${checks.length}/${checks.length} checks.`);
