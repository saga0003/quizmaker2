import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20260901062500_phase1_assignment_preview_warnings.sql', 'utf8');
const ui = fs.readFileSync('src/components/evidara/paper-assignment-center.tsx', 'utf8');
const workflow = fs.readFileSync('.github/workflows/phase1-release-gate.yml', 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('preview remains server-authoritative and exact', () => {
  assert.ok(migration.includes('create or replace function public.preview_paper_assignment_v19'));
  assert.ok(migration.includes("select * from scoped where status::text='active'"));
  assert.ok(migration.includes("'assigned_count',coalesce(v_count,0)"));
});
check('sample remains bounded independently of exact count', () => {
  assert.ok(migration.includes('where sample_rank<=10'));
  assert.ok(migration.includes("'sample',coalesce(v_sample,'[]'::jsonb)"));
});
check('inactive lifecycle states are counted as exclusions', () => {
  assert.ok(migration.includes("status::text='suspended'"));
  assert.ok(migration.includes("status::text='withdrawn'"));
  assert.ok(migration.includes("status::text='completed'"));
});
check('preview reports lifecycle eligibility warnings', () => {
  for (const code of ['suspended_students_excluded','withdrawn_students_excluded','completed_students_excluded']) assert.ok(migration.includes(`'code','${code}'`));
});
check('specific selected students without active access are blocking', () => {
  assert.ok(migration.includes("'code','selected_students_unavailable','severity','blocking'"));
});
check('empty audience result is blocking', () => {
  assert.ok(migration.includes("'code','no_eligible_students','severity','blocking'"));
});
check('licence state and capacity are explicit warnings', () => {
  assert.ok(migration.includes("'code','licence_unavailable','severity','blocking'"));
  assert.ok(migration.includes("'code','licence_at_capacity','severity','warning'"));
});
check('attempt-bearing paper warns that cohort is frozen', () => {
  assert.ok(migration.includes("'code','cohort_frozen','severity','blocking'"));
  assert.ok(migration.includes('exists(select 1 from public.exam_attempts where paper_id=p_paper_id)'));
});
check('UI models server warnings', () => {
  assert.ok(ui.includes("warnings?: Array<{ code: string; severity: 'warning' | 'blocking'; count?: number; message: string }>"));
});
check('UI renders eligibility warnings before assignment', () => {
  assert.ok(ui.includes('Eligibility warnings'));
  assert.ok(ui.includes('preview.warnings.map'));
});
check('blocking warnings disable audience materialization', () => {
  assert.ok(ui.includes("preview?.warnings?.some((warning) => warning.severity === 'blocking')"));
});
check('D4 regression is permanent in the release gate', () => {
  assert.ok(workflow.includes('D4 assignment-preview checks'));
  assert.ok(workflow.includes('node scripts/d4-assignment-preview-smoke.mjs'));
});

console.log(`D4 assignment preview smoke: ${checks.length}/${checks.length} checks passed`);
