import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260831111000_phase1_teacher_subject_scope.sql', 'utf8');
const analyticsMigration = fs.readFileSync('supabase/migrations/20260831112500_phase1_teacher_analytics_subject_scope.sql', 'utf8');

const checks = [
  ['canonical scope helper exists', migration, /create or replace function public\.is_evidara_teacher_for_scope/i],
  ['scope requires active teacher assignment', migration, /teacher_section_assignments assignment[\s\S]*assignment\.is_active = true/i],
  ['scope requires active organization membership', migration, /member\.organization_id = p_organization_id[\s\S]*member\.is_active = true/i],
  ['section scope is optional and explicit', migration, /p_section_id is null or section_row\.id = p_section_id/i],
  ['subject scope is optional and explicit', migration, /p_subject_id is null[\s\S]*subject_row\.id is not null/i],
  ['subject assignment supports exact name', migration, /assignment\.subject_label\)\) = lower\(btrim\(subject_row\.name\)\)/i],
  ['subject assignment supports exact code', migration, /assignment\.subject_label\)\) = lower\(btrim\(subject_row\.code\)\)/i],
  ['all-subject assignment remains explicit', migration, /assignment\.subject_label\)\) = 'all subjects'/i],
  ['scope helper is not anonymous', migration, /revoke all on function public\.is_evidara_teacher_for_scope\(uuid, uuid, uuid\) from public, anon/i],
  ['legacy section helper delegates to canonical scope', migration, /is_evidara_teacher_for_scope\(p_organization_id, p_section_id, null\)/i],
  ['paper manager requires assignment for teachers', migration, /is_evidara_teacher_for_scope\(p_organization_id, null, null\)/i],
  ['teacher question reads require subject scope', migration, /questions_read_v14[\s\S]*is_evidara_teacher_for_scope\(organization_id, null, subject_id\)/i],
  ['teacher question inserts require subject scope', migration, /questions_insert_v14[\s\S]*is_evidara_teacher_for_scope\(organization_id, null, subject_id\)/i],
  ['teacher question updates require subject scope', migration, /questions_update_v14[\s\S]*is_evidara_teacher_for_scope\(organization_id, null, subject_id\)/i],
  ['approved assigned-subject collaboration is readable', migration, /created_by = \(select auth\.uid\(\)\) or status::text = 'approved'/i],
  ['paper sections require assigned subject', migration, /paper_sections_manage[\s\S]*is_evidara_teacher_for_scope\(p\.organization_id, null, paper_sections\.subject_id\)/i],
  ['paper questions resolve section or question subject', migration, /coalesce\(ps\.subject_id, q\.subject_id\)/i],
  ['paper questions require assigned subject', migration, /paper_questions_manage[\s\S]*is_evidara_teacher_for_scope\(p\.organization_id, null, coalesce\(ps\.subject_id, q\.subject_id\)\)/i],
  ['school managers retain full institution scope', migration, /is_evidara_school_manager\(p\.organization_id\)/i],
  ['super admin retains platform override', migration, /public\.is_super_admin\(\)/i],
  ['teacher analytics section visibility uses canonical assignment scope', analyticsMigration, /is_evidara_teacher_for_scope\(section_row\.organization_id, section_row\.id, null\)/i],
  ['teacher analytics attempts require assigned paper subject', analyticsMigration, /paper\.subject_id is not null[\s\S]*is_evidara_teacher_for_scope\(student\.organization_id, student\.section_id, paper\.subject_id\)/i],
  ['teacher analytics response evidence requires assigned section subject', analyticsMigration, /paper_section\.subject_id is not null[\s\S]*is_evidara_teacher_for_scope\(attempt\.organization_id, attempt\.section_id, paper_section\.subject_id\)/i],
  ['teacher analytics keeps school admin section-wide view', analyticsMigration, /analytics_is_school_admin_v10\(student\.organization_id\)/i],
  ['teacher analytics keeps platform admin section-wide view', analyticsMigration, /analytics_is_platform_admin_v10\(\)/i],
  ['teacher analytics RPC is not anonymous', analyticsMigration, /revoke all on function public\.get_teacher_analytics_overview_v10\(uuid,date,date\) from public, anon/i],
];

let failed = 0;
for (const [label, source, pattern] of checks) {
  const ok = pattern.test(source);
  console.log(`${ok ? 'PASS' : 'FAIL'} B6 — ${label}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`B6 teacher scope smoke failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`B6 teacher scope smoke passed: ${checks.length}/${checks.length}.`);
