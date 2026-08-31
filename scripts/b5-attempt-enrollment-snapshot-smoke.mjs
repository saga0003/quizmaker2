import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260831105500_phase1_attempt_enrollment_snapshot.sql', 'utf8');

const checks = [
  ['attempt table receives enrollment snapshot', /alter table public\.exam_attempts[\s\S]*add column if not exists enrollment_snapshot jsonb/i],
  ['snapshot is captured before attempt insert', /create trigger exam_attempt_capture_enrollment_snapshot_v15[\s\S]*before insert on public\.exam_attempts/i],
  ['snapshot requires active institution membership', /membership\.organization_id = new\.organization_id[\s\S]*membership\.student_id = new\.student_id[\s\S]*membership\.status::text = 'active'/i],
  ['missing active enrollment fails closed', /An active institution enrollment is required before starting this test/i],
  ['institution id is frozen', /'organizationId', v_membership\.organization_id/i],
  ['membership id is frozen', /'membershipId', v_membership\.id/i],
  ['academic year is frozen', /'academicYear', v_membership\.academic_year/i],
  ['grade is frozen', /'grade', v_membership\.grade/i],
  ['section id is frozen', /'sectionId', v_membership\.section_id/i],
  ['section label is frozen', /'section', v_membership\.section/i],
  ['board is frozen', /'board', v_membership\.board/i],
  ['programme track context is frozen', /'programmes', coalesce\(to_jsonb\(v_membership\.tracks\)/i],
  ['snapshot has explicit schema version', /'version', 1/i],
  ['snapshot records capture time', /'capturedAt', now\(\)/i],
  ['public platform attempts remain supported', /if new\.organization_id is null then[\s\S]*return new/i],
  ['snapshot is immutable on update', /old\.enrollment_snapshot is distinct from new\.enrollment_snapshot/i],
  ['immutable violation is explicit', /Exam attempt enrollment snapshots are immutable historical evidence/i],
  ['snapshot protector runs before update', /create trigger exam_attempt_protect_enrollment_snapshot_v15[\s\S]*before update on public\.exam_attempts/i],
  ['trigger helpers are not browser executable', /revoke all on function public\.capture_exam_attempt_enrollment_snapshot_v15\(\)[\s\S]*from public, anon, authenticated[\s\S]*revoke all on function public\.protect_exam_attempt_enrollment_snapshot_v15\(\)[\s\S]*from public, anon, authenticated/i],
];

let failed = 0;
for (const [label, pattern] of checks) {
  const ok = pattern.test(migration);
  console.log(`${ok ? 'PASS' : 'FAIL'} B5 — ${label}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`B5 attempt enrollment snapshot smoke failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`B5 attempt enrollment snapshot smoke passed: ${checks.length}/${checks.length}.`);
