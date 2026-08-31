import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260831111000_phase1_teacher_subject_scope.sql', 'utf8');

const checks = [
  ['canonical scope helper exists', /create or replace function public\.is_evidara_teacher_for_scope/i],
  ['scope requires active teacher assignment', /teacher_section_assignments assignment[\s\S]*assignment\.is_active = true/i],
  ['scope requires active organization membership', /member\.organization_id = p_organization_id[\s\S]*member\.is_active = true/i],
  ['section scope is optional and explicit', /p_section_id is null or section_row\.id = p_section_id/i],
  ['subject scope is optional and explicit', /p_subject_id is null[\s\S]*subject_row\.id is not null/i],
  ['subject assignment supports exact name', /assignment\.subject_label\)\) = lower\(btrim\(subject_row\.name\)\)/i],
  ['subject assignment supports exact code', /assignment\.subject_label\)\) = lower\(btrim\(subject_row\.code\)\)/i],
  ['all-subject assignment remains explicit', /assignment\.subject_label\)\) = 'all subjects'/i],
  ['scope helper is not anonymous', /revoke all on function public\.is_evidara_teacher_for_scope\(uuid, uuid, uuid\) from public, anon/i],
  ['legacy section helper delegates to canonical scope', /is_evidara_teacher_for_scope\(p_organization_id, p_section_id, null\)/i],
  ['paper manager requires assignment for teachers', /is_evidara_teacher_for_scope\(p_organization_id, null, null\)/i],
  ['teacher question reads require subject scope', /questions_read_v14[\s\S]*is_evidara_teacher_for_scope\(organization_id, null, subject_id\)/i],
  ['teacher question inserts require subject scope', /questions_insert_v14[\s\S]*is_evidara_teacher_for_scope\(organization_id, null, subject_id\)/i],
  ['teacher question updates require subject scope', /questions_update_v14[\s\S]*is_evidara_teacher_for_scope\(organization_id, null, subject_id\)/i],
  ['approved assigned-subject collaboration is readable', /created_by = \(select auth\.uid\(\)\) or status::text = 'approved'/i],
  ['paper sections require assigned subject', /paper_sections_manage[\s\S]*is_evidara_teacher_for_scope\(p\.organization_id, null, paper_sections\.subject_id\)/i],
  ['paper questions resolve section or question subject', /coalesce\(ps\.subject_id, q\.subject_id\)/i],
  ['paper questions require assigned subject', /paper_questions_manage[\s\S]*is_evidara_teacher_for_scope\(p\.organization_id, null, coalesce\(ps\.subject_id, q\.subject_id\)\)/i],
  ['school managers retain full institution scope', /is_evidara_school_manager\(p\.organization_id\)/i],
  ['super admin retains platform override', /public\.is_super_admin\(\)/i],
];

let failed = 0;
for (const [label, pattern] of checks) {
  const ok = pattern.test(migration);
  console.log(`${ok ? 'PASS' : 'FAIL'} B6 — ${label}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`B6 teacher scope smoke failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`B6 teacher scope smoke passed: ${checks.length}/${checks.length}.`);
