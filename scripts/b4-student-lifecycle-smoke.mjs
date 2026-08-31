import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260831103000_phase1_student_lifecycle_states.sql', 'utf8');
const model = fs.readFileSync('src/lib/schoolPlatform.ts', 'utf8');
const ui = fs.readFileSync('src/components/school/StudentLifecycleManager.tsx', 'utf8');

const checks = [
  ['canonical model exposes active withdrawn completed suspended', /StudentLifecycleStatus\s*=\s*"active"\s*\|\s*"withdrawn"\s*\|\s*"completed"\s*\|\s*"suspended"/],
  ['database adds withdrawn state', /add value if not exists 'withdrawn'/i],
  ['database adds suspended state', /add value if not exists 'suspended'/i],
  ['transition RPC accepts only four canonical states', /v_target not in \('active', 'withdrawn', 'completed', 'suspended'\)/i],
  ['transition RPC is manager authorized', /is_evidara_school_manager\(v\.organization_id\)/i],
  ['transition writes audit event', /school\.student\.lifecycle_changed/i],
  ['terminal withdrawn state cannot be silently reactivated', /Withdrawn or completed memberships are historical records and cannot be reactivated/i],
  ['temporary suspended state can reactivate', /v_previous = 'suspended' and v_target = 'active'/i],
  ['delete guard checks exam attempts', /before delete[\s\S]*guard_student_membership_delete_after_attempt_v14/i],
  ['delete guard scopes evidence by student and organization', /attempt\.student_id = old\.student_id[\s\S]*attempt\.organization_id = old\.organization_id/i],
  ['delete guard explains lifecycle alternative', /cannot be deleted\. Use a lifecycle status instead/i],
  ['legacy revoke wrapper remains backward compatible', /return public\.revoke_school_student\(p_membership_id/i],
  ['new UI uses explicit lifecycle transition marker', /__evidara_lifecycle__:/],
  ['student UI exposes Withdraw', />Withdraw</],
  ['student UI exposes Suspend', />Suspend</],
  ['student UI exposes Complete', />Complete</],
  ['student UI exposes Reactivate for suspended membership', />Reactivate</],
  ['student UI labels the four canonical lifecycle filters', /value="withdrawn">Withdrawn<[\s\S]*value="completed">Completed<[\s\S]*value="suspended">Suspended</],
  ['student UI warns removal is only for records without attempts', /only available before the student has assessment attempts/i],
];

let failed = 0;
for (const [label, pattern] of checks) {
  const source = label.startsWith('canonical model') ? model : label.startsWith('student UI') || label.startsWith('new UI') ? ui : migration;
  const ok = pattern.test(source);
  console.log(`${ok ? 'PASS' : 'FAIL'} B4 — ${label}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`B4 student lifecycle smoke failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`B4 student lifecycle smoke passed: ${checks.length}/${checks.length}.`);
