import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260831050000_phase1_privileged_audit_coverage.sql', 'utf8');
const viewAs = fs.readFileSync('src/components/evidara/login-as-switcher.tsx', 'utf8');

const checks = [
  ['generic audit trigger function exists', migration.includes('audit_privileged_mutation_v20')],
  ['trigger function has fixed search_path', migration.includes("security definer\nset search_path = ''")],
  ['trigger function is not browser executable', migration.includes('revoke all on function public.audit_privileged_mutation_v20() from public, anon, authenticated')],
  ['institution changes are audited', migration.includes("('organizations','institution')")],
  ['subscription changes are audited', migration.includes("('school_subscriptions','subscription')")],
  ['account and membership changes are audited', migration.includes("('profiles','account')") && migration.includes("('organization_members','account_membership')")],
  ['credential state changes are audited', migration.includes("('credential_security_states','credential_state')")],
  ['question and option changes are audited', migration.includes("('questions','question')") && migration.includes("('question_options','question_option')")],
  ['paper and assignment changes are audited', migration.includes("('question_papers','paper')") && migration.includes("('paper_assignment_profiles','paper_assignment')")],
  ['protected resource changes are audited', migration.includes("('academic_resources','resource')")],
  ['privileged result changes are audited', migration.includes('phase1_audit_exam_attempt_result_v20')],
  ['student-owned attempt updates are excluded from privileged audit noise', migration.includes('actor = student_owner')],
  ['audit metadata avoids copying full old/new rows', migration.includes("'changed_columns'") && !migration.includes("'old_row', old_row") && !migration.includes("'new_row', new_row")],
  ['View As audit RPC validates Super Admin', migration.includes("actor_role <> 'super_admin'")],
  ['anonymous View As audit RPC access is revoked', migration.includes('revoke all on function public.audit_view_as_v20(text,text,uuid) from public, anon')],
  ['View As UI logs session start before switching', viewAs.includes("await auditViewAs('started', role)") && viewAs.indexOf("await auditViewAs('started', role)") < viewAs.indexOf('loginAs(role)')],
  ['View As UI records session exit', viewAs.includes("await auditViewAs('ended', role)")],
  ['View As remains explicitly read only', viewAs.includes('Read-only Super Admin preview')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (failed.length) {
  console.error(`A3 privileged audit smoke failed: ${failed.length}/${checks.length}`);
  process.exit(1);
}
console.log(`A3 privileged audit smoke passed: ${checks.length}/${checks.length}`);
