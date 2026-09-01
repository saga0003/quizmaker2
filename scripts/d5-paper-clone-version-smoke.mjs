import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20260901064000_phase1_paper_clone_version.sql', 'utf8');
const ui = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');
const workflow = fs.readFileSync('.github/workflows/phase1-release-gate.yml', 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('clone is a server-side transactional RPC', () => {
  assert.ok(migration.includes('create or replace function public.clone_paper_as_new_version_v1'));
  assert.ok(migration.includes('security definer'));
});
check('clone requires paper-builder authorization', () => {
  assert.ok(migration.includes('public.can_manage_v8_papers(v_source.organization_id)'));
});
check('clone requires an attempt-bearing source paper', () => {
  assert.ok(migration.includes('from public.exam_attempts where paper_id=p_source_paper_id'));
  assert.ok(migration.includes('if v_attempt_count < 1'));
});
check('concurrent version numbering is serialized', () => {
  assert.ok(migration.includes('pg_advisory_xact_lock'));
  assert.ok(migration.includes("'{version_lineage,version_number}'"));
});
check('new paper is a fresh draft without publication identity', () => {
  assert.ok(migration.includes("v_source.exam_type,'draft'"));
  assert.ok(/coalesce\(v_source\.settings,'\{\}'::jsonb\)\s*-\s*'assignment'\s*-\s*'assigned_student_count'\s*-\s*'demo_batch_id'/.test(migration));
  assert.ok(migration.includes('null,null,null,v_source.attempt_limit'));
  assert.ok(migration.includes('null,v_source.access_label'));
});
check('version lineage records source root and version number', () => {
  for (const field of ['root_paper_id','source_paper_id','version_number','cloned_at','cloned_by']) assert.ok(migration.includes(`'${field}'`));
});
check('sections are cloned with fresh identifiers', () => {
  assert.ok(migration.includes('v_new_section_id := gen_random_uuid()'));
  assert.ok(migration.includes('insert into public.paper_sections'));
});
check('paper questions retain frozen question snapshots', () => {
  assert.ok(migration.includes('insert into public.paper_questions'));
  assert.ok(migration.includes('pq.question_snapshot'));
});
check('assignment rows are deliberately not copied', () => {
  assert.ok(!migration.includes('insert into public.paper_student_assignments'));
  assert.ok(!migration.includes('insert into public.paper_assignment_profiles'));
});
check('clone action is audited', () => {
  assert.ok(migration.includes("'paper.version.cloned'"));
});
check('browser privileges deny anonymous clone execution', () => {
  assert.ok(migration.includes('revoke all on function public.clone_paper_as_new_version_v1(uuid,text) from public, anon'));
  assert.ok(migration.includes('grant execute on function public.clone_paper_as_new_version_v1(uuid,text) to authenticated, service_role'));
});
check('paper UI exposes clone-as-new-version action', () => {
  assert.ok(ui.includes('clone_paper_as_new_version_v1'));
  assert.ok(ui.includes('Clone as new version'));
});
check('D5 regression is permanent in release gate', () => {
  assert.ok(workflow.includes('D5 paper version-clone checks'));
  assert.ok(workflow.includes('node scripts/d5-paper-clone-version-smoke.mjs'));
});

console.log(`D5 paper clone/version smoke: ${checks.length}/${checks.length} checks passed`);
