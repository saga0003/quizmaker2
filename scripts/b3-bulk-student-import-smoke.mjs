import fs from 'node:fs';

const ui = fs.readFileSync('src/components/evidara/bulk-account-import.tsx', 'utf8');
const route = fs.readFileSync('src/app/api/access-control/route.ts', 'utf8');

const checks = [
  ['student-specific import UI', /Bulk student import/],
  ['student action is dedicated', /action:\s*'bulkImportStudents'/],
  ['required mapping includes name email grade and academic year', /\['fullName'.*true\][\s\S]*\['email'.*true\][\s\S]*\['grade'.*true\][\s\S]*\['academicYear'.*true\]/],
  ['client validates proper email shape', /\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$/],
  ['client validates grade 1 through 12', /Number\.isInteger\(grade\)[\s\S]*grade < 1[\s\S]*grade > 12/],
  ['client validates academic year shape', /Academic year must look like 2026 or 2026-27/],
  ['client refuses more than 1000 rows instead of truncating', /will not silently truncate a student roster/],
  ['validation blocks upload while rows are invalid', /invalidCount === 0/],
  ['failed-row export is explicit', /evidara-student-import-failures\.csv/],
  ['failed export includes source row number and error', /failureKeys = \['rowNumber'[\s\S]*'error'\]/],
  ['successful credentials remain separately exportable', /evidara-student-import-credentials\.csv/],
  ['server rejects more than 1000 rows', /Student imports are limited to 1,000 rows per file/],
  ['server forces student semantics', /action === 'bulkImportStudents'[\s\S]*role:\s*'student'/],
  ['server validates full name', /Student name is required/],
  ['server validates email', /A valid email is required/],
  ['server validates grade range', /Grade must be an integer from 1 to 12/],
  ['server validates academic year', /Academic year must look like 2026 or 2026-27/],
  ['server rejects duplicate emails in same file', /Duplicate email in this CSV/],
  ['server preserves source row number in results', /rowNumber/],
  ['server deletes newly-created auth account if profile setup fails', /profileError[\s\S]*deleteUser\(userId\)/],
  ['server deletes newly-created auth account if membership creation fails', /membershipError[\s\S]*deleteUser\(userId\)/],
  ['server reports only created or failed outcomes for student import', /status:\s*'failed'[\s\S]*status:\s*'created'/],
];

let failed = 0;
for (const [label, pattern] of checks) {
  const source = label.startsWith('server') ? route : ui;
  const ok = pattern.test(source);
  console.log(`${ok ? 'PASS' : 'FAIL'} B3 — ${label}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`B3 bulk student import smoke failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`B3 bulk student import smoke passed: ${checks.length}/${checks.length}.`);
