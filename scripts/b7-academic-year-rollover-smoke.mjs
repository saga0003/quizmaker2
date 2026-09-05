import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260831114500_phase1_academic_year_rollover.sql', 'utf8');

const checks = [
  ['defines promote_school_student', /create or replace function public\.promote_school_student\(/i],
  ['locks source membership', /where id = p_membership_id\s+for update;/i],
  ['requires school-manager authorization', /is_school_manager\(v\.organization_id\)/i],
  ['validates academic-year format', /\^\[0-9\]\{4\}-\[0-9\]\{2\}\$/i],
  ['requires active unlocked source', /v\.status <> 'active' or v\.promotion_locked/i],
  ['honours permanent promotion blocks', /student_promotion_blocks/i],
  ['does not overwrite historical or locked target', /target\.status in \('withdrawn','completed','revoked'\).*promotion_locked = true/is],
  ['completes Grade 12 without synthetic next-year enrollment', /if v\.grade >= 12 then[\s\S]*event_type[\s\S]*'completed'/i],
  ['preserves prior membership as completed', /update public\.student_school_memberships\s+set status = 'completed'/i],
  ['creates a separate next-year membership', /insert into public\.student_school_memberships\([\s\S]*v_target_year,v_grade/is],
  ['records explicit rollover provenance', /rollover_from_membership_id/i],
  ['records promotion history event', /insert into public\.student_promotion_events/i],
  ['is retry-safe/idempotent', /Retry-safe:[\s\S]*v_existing_event/is],
  ['revokes anonymous execution', /revoke all on function public\.promote_school_student\(uuid,text\) from public, anon;/i],
  ['grants authenticated execution only after server-side authorization', /grant execute on function public\.promote_school_student\(uuid,text\) to authenticated;/i],
];

let failed = 0;
for (const [name, pattern] of checks) {
  const ok = pattern.test(migration);
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`B7 academic-year rollover smoke failed: ${failed}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`B7 academic-year rollover smoke passed: ${checks.length}/${checks.length}.`);
