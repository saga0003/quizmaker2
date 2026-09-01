import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20260901070000_phase1_paper_publish_readiness.sql', 'utf8');
const workflow = fs.readFileSync('.github/workflows/phase1-release-gate.yml', 'utf8');
const builderUi = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('readiness contract is server-authoritative', () => {
  assert.ok(migration.includes('create or replace function public.paper_publish_readiness_internal_v1'));
  assert.ok(migration.includes('create or replace function public.get_paper_publish_readiness_v1'));
});
check('approved question state is verified at publish time', () => {
  assert.ok(migration.includes("q.status::text <> 'approved'"));
  assert.ok(migration.includes("'code','approved_questions'"));
});
check('duration is part of readiness', () => {
  assert.ok(migration.includes('v_paper.duration_minutes > 0'));
  assert.ok(migration.includes("'code','duration'"));
});
check('marks are positive and internally consistent', () => {
  assert.ok(migration.includes('pq.marks <= 0'));
  assert.ok(migration.includes('pq.negative_marks < 0'));
  assert.ok(migration.includes('pq.negative_marks > pq.marks'));
  assert.ok(migration.includes('v_paper.total_marks = v_mark_sum'));
  assert.ok(migration.includes('v_paper.total_questions = v_question_count'));
});
check('institution audience must be materialized and non-empty', () => {
  assert.ok(migration.includes("status='assigned'"));
  assert.ok(migration.includes('v_assignment_count > 0'));
  assert.ok(migration.includes('v_assignment_count = v_profile_count'));
  assert.ok(migration.includes("'code','audience'"));
});
check('public platform papers do not invent an institution cohort', () => {
  assert.ok(migration.includes('if v_paper.organization_id is null then'));
  assert.ok(migration.includes('Platform/public paper does not require an institution assignment cohort.'));
});
check('schedule is valid or explicitly open forever', () => {
  assert.ok(migration.includes('v_paper.open_forever'));
  assert.ok(migration.includes('v_paper.available_from is not null'));
  assert.ok(migration.includes('v_paper.available_until > v_paper.available_from'));
  assert.ok(migration.includes("'code','schedule'"));
});
check('result-release policy is explicitly validated', () => {
  for (const mode of ['hidden','score_only','score_and_answers','in_depth_analytics','after_close']) assert.ok(migration.includes(`'${mode}'`));
  assert.ok(migration.includes("'code','result_policy'"));
});
check('publish enforcement is deferred until paper rows are fully materialized', () => {
  assert.ok(migration.includes('create constraint trigger trg_phase1_paper_publish_readiness'));
  assert.ok(migration.includes('deferrable initially deferred'));
  assert.ok(migration.includes("when (new.status::text='published')"));
});
check('failed publish reports checklist dimensions instead of silently mutating status', () => {
  assert.ok(migration.includes("Paper is not ready to publish. Fix:"));
  assert.ok(migration.includes("using errcode='23514'"));
});
check('browser can request checklist only through authorized endpoint', () => {
  assert.ok(migration.includes("not public.can_manage_v8_papers(v_org)"));
  assert.ok(migration.includes('grant execute on function public.get_paper_publish_readiness_v1(uuid) to authenticated, service_role'));
  assert.ok(migration.includes('revoke all on function public.get_paper_publish_readiness_v1(uuid) from public, anon'));
});
check('internal and trigger helpers are not browser executable', () => {
  assert.ok(migration.includes('revoke all on function public.paper_publish_readiness_internal_v1(uuid) from public, anon, authenticated'));
  assert.ok(migration.includes('revoke all on function public.enforce_paper_publish_readiness_v1() from public, anon, authenticated'));
});
check('readiness response is structured for a visible publish checklist', () => {
  assert.ok(migration.includes("'ready',v_ready"));
  assert.ok(migration.includes("'checks',v_checks"));
  for (const label of ['Approved questions','Duration','Marks','Audience','Schedule','Result policy']) assert.ok(migration.includes(`'label','${label}'`));
});
check('Preview & Publish renders the six server-authoritative readiness dimensions', () => {
  assert.ok(builderUi.includes("supabase.rpc('get_paper_publish_readiness_v1'"));
  for (const label of ['Approved questions','Duration','Marks','Audience','Schedule','Result policy']) assert.ok(builderUi.includes(label));
  assert.ok(builderUi.includes('Run release check'));
});
check('publish remains locked until the current paper fingerprint has a passing release check', () => {
  assert.ok(builderUi.includes('releaseCheckCurrent'));
  assert.ok(builderUi.includes('readinessFingerprint === publishFingerprint'));
  assert.ok(builderUi.includes('disabled={saving || readinessLoading || !releaseCheckCurrent}'));
  assert.ok(builderUi.includes('publishCheckedPaper'));
});
check('D6 publish-readiness regression is permanent in release gate', () => {
  assert.ok(workflow.includes('D6 publish-readiness checks'));
  assert.ok(workflow.includes('node scripts/d6-paper-publish-readiness-smoke.mjs'));
});

console.log(`D6 paper publish readiness smoke: ${checks.length}/${checks.length} checks passed`);