import fs from 'node:fs';

const ui = fs.readFileSync('src/components/evidara/bulk-account-import.tsx', 'utf8');
const route = fs.readFileSync('src/app/api/access-control/route.ts', 'utf8');
const template = fs.readFileSync('public/templates/student-import-template.csv', 'utf8');

const checks = [
  ['student import uses simple customer-facing title', /<DialogTitle>Import students<\/DialogTitle>/],
  ['student import avoids internal roster jargon', !/roster/i.test(ui)],
  ['student action is dedicated', /action:\s*'bulkImportStudents'/],
  ['required mapping includes name email grade and academic year', /\['fullName'.*true\][\s\S]*\['email'.*true\][\s\S]*\['grade'.*true\][\s\S]*\['academicYear'.*true\]/],
  ['required fields are explained in the UI', /Required columns[\s\S]*Student name · Email · Grade \/ class · Academic year/],
  ['downloadable CSV template is available', /student-import-template\.csv/.test(ui) && /^Student name,Email,Grade,Academic year,Section,Phone,Board,Parent name,Parent phone\s*$/m.test(template)],
  ['header aliases tolerate common school naming differences', /student email/.test(ui) && /standard/.test(ui) && /school year/.test(ui)],
  ['manual column mapping remains available for unusual or misspelled headings', /If your CSV uses different or misspelled headings/[\s\S]*<SelectItem value="none">Not mapped<\/SelectItem>/],
  ['client validates proper email shape', /\^\[\^\\s@\]\+@\[\^\\s@\]\+\\\.\[\^\\s@\]\+\$/],
  ['client validates grade 1 through 12', /Number\.isInteger\(grade\)[\s\S]*grade < 1[\s\S]*grade > 12/],
  ['client validates academic year shape', /Academic year should look like 2026 or 2026-27/],
  ['client flags duplicate emails before confirmation', /appears more than once in the CSV/],
  ['client refuses more than 1000 rows without silent truncation', /split it into files of at most 1,000 students/],
  ['invalid rows block review', /invalidCount === 0[\s\S]*Review students/],
  ['review is a separate step before the import request', /async function beginReview\(\)[\s\S]*loadLicencePreview\(\)[\s\S]*setReviewing\(true\)/],
  ['review checks current licence quantity without creating accounts', /fetch\('\/api\/school-platform\/'[\s\S]*licensed[\s\S]*available[\s\S]*remaining/],
  ['final confirmation explicitly assigns student licences', /Add \{mapped\.length\} student[\s\S]*assign \{mapped\.length\} licence/],
  ['insufficient licences disable final confirmation', /disabled=\{!licencePreview\?\.enough \|\| busy\}/],
  ['licence availability is rechecked immediately before import', /async function upload\(\)[\s\S]*const latest = await loadLicencePreview\(\)[\s\S]*if \(!latest\.enough\)/],
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
  const ok = typeof pattern === 'boolean' ? pattern : pattern.test(source);
  console.log(`${ok ? 'PASS' : 'FAIL'} B3 — ${label}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`B3 bulk student import smoke failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`B3 bulk student import smoke passed: ${checks.length}/${checks.length}.`);

// B4 is chained here because the GitHub App cannot edit workflow files directly.
// This preserves the existing release-gate workflow while making B4 mandatory on every gate run.
await import('./b4-student-lifecycle-smoke.mjs');
