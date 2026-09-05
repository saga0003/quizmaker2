import fs from 'node:fs';
import assert from 'node:assert/strict';

const migration = fs.readFileSync('supabase/migrations/20260901065500_phase1_normalized_paper_access.sql', 'utf8');
const workflow = fs.readFileSync('.github/workflows/phase1-release-gate.yml', 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('institutional student access uses normalized assignment rows', () => {
  assert.ok(migration.includes('from public.paper_student_assignments assignment'));
  assert.ok(migration.includes("assignment.status = 'assigned'"));
});
check('assignment is tied to the same institutional paper', () => {
  assert.ok(migration.includes('assignment.organization_id = paper.organization_id'));
});
check('assignment is tied to the selected membership snapshot', () => {
  assert.ok(migration.includes('membership.id = assignment.membership_id'));
  assert.ok(migration.includes('membership.student_id = p_student_id'));
});
check('student membership must still be active', () => {
  assert.ok(migration.includes("membership.status::text = 'active'"));
});
check('legacy institution-wide membership fallback is absent', () => {
  assert.ok(!migration.includes('is_active_student_member'));
  assert.ok(!migration.includes("then exists("));
});
check('anonymous callers cannot probe assignment helper', () => {
  assert.ok(migration.includes('revoke all on function public.paper_assignment_allows_student_v19(uuid,uuid) from public, anon'));
});
check('question paper RLS uses normalized assignment helper for organization access', () => {
  assert.ok(migration.includes('public.paper_assignment_allows_student_v19(id,auth.uid())'));
  assert.ok(migration.includes("access_mode = 'organization'::public.paper_access_mode"));
});
check('public published papers retain public-student behavior', () => {
  assert.ok(migration.includes("access_mode = 'public'::public.paper_access_mode"));
});
check('D7 regression is permanent in release gate', () => {
  assert.ok(workflow.includes('D7 normalized paper-access checks'));
  assert.ok(workflow.includes('node scripts/d7-normalized-paper-access-smoke.mjs'));
});

console.log(`D7 normalized paper access smoke: ${checks.length}/${checks.length} checks passed`);
