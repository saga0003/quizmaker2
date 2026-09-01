import fs from 'node:fs';
import assert from 'node:assert/strict';

const migrationPath = 'supabase/migrations/20260901142000_phase1_raw_response_evidence_scope.sql';
assert.ok(fs.existsSync(migrationPath), 'F10 migration must exist');
const sql = fs.readFileSync(migrationPath, 'utf8');
const checks = [
  ['attempt RLS is enabled', /alter table public\.exam_attempts enable row level security/i.test(sql)],
  ['response RLS is enabled', /alter table public\.exam_responses enable row level security/i.test(sql)],
  ['anonymous attempt access is revoked', /revoke all on table public\.exam_attempts from anon/i.test(sql)],
  ['anonymous response access is revoked', /revoke all on table public\.exam_responses from anon/i.test(sql)],
  ['authenticated attempt browser DML is revoked', /revoke insert, update, delete, truncate, references, trigger on table public\.exam_attempts from authenticated/i.test(sql)],
  ['authenticated response browser DML is revoked', /revoke insert, update, delete, truncate, references, trigger on table public\.exam_responses from authenticated/i.test(sql)],
  ['authenticated attempt read is retained', /grant select on table public\.exam_attempts to authenticated/i.test(sql)],
  ['authenticated response read is retained', /grant select on table public\.exam_responses to authenticated/i.test(sql)],
  ['student can read own attempt', /student_id\s*=\s*auth\.uid\(\)/i.test(sql)],
  ['student can read own response through attempt', /a\.student_id\s*=\s*auth\.uid\(\)/i.test(sql)],
  ['school manager remains authorized', /is_evidara_school_manager\(p\.organization_id\)/i.test(sql)],
  ['broad paper-manager shortcut is removed from evidence policies', !/is_paper_manager\s*\(/i.test(sql)],
  ['teacher attempt scope uses frozen enrollment section', /enrollment_snapshot\s*->>\s*'section_id'/i.test(sql)],
  ['teacher attempt scope requires a paper subject', /from public\.paper_sections ps[\s\S]*ps\.subject_id is not null[\s\S]*is_evidara_teacher_for_scope/i.test(sql)],
  ['response scope binds the exact paper question', /pq\.id\s*=\s*exam_responses\.paper_question_id/i.test(sql)],
  ['response scope binds paper question to paper section', /join public\.paper_sections ps on ps\.id\s*=\s*pq\.section_id/i.test(sql)],
  ['teacher response read requires exact frozen section and subject', /is_evidara_teacher_for_scope\([\s\S]*enrollment_snapshot\s*->>\s*'section_id'[\s\S]*ps\.subject_id/i.test(sql)],
  ['raw evidence is documented as canonical and browser read-only', /Canonical raw learner response evidence/i.test(sql) && /Browser DML is prohibited/i.test(sql)],
  ['answer writes are documented through the authenticated save RPC', /save_exam_response/i.test(sql)],
];

for (const [name, ok] of checks) {
  assert.ok(ok, `F10 raw response evidence check failed: ${name}`);
  console.log(`PASS: ${name}`);
}
console.log(`F10 raw response evidence checks passed: ${checks.length}/${checks.length}`);
