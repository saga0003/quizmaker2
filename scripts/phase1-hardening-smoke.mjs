import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const checks = [];

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function check(name, condition, details = '') {
  checks.push({ name, ok: Boolean(condition), details });
  if (!condition) failures.push(name);
}

const eligibilityMigration = read('supabase/migrations/20260830171000_phase1_real_student_test_access.sql');
const responseAudit = read('src/components/analytics-v12/question-response-audit.tsx');
const subscriptionCenter = read('src/components/school/SubscriptionCenter.tsx');
const releaseChecklist = read('PHASE1_RELEASE_CHECKLIST.md');
const releaseWorkflow = read('.github/workflows/phase1-release-gate.yml');

check('real student helper exists', /create or replace function public\.is_active_student_member/i.test(eligibilityMigration));
check('student helper reads student_school_memberships', /from public\.student_school_memberships/i.test(eligibilityMigration));
check('student helper requires active membership', /membership\.status\s*=\s*'active'/i.test(eligibilityMigration));
check('available paper listing accepts active student membership', /create or replace function public\.list_available_papers[\s\S]*is_active_student_member/i.test(eligibilityMigration));
check('private-code lookup accepts active student membership', /create or replace function public\.find_paper_by_code[\s\S]*is_active_student_member/i.test(eligibilityMigration));
check('exam start accepts active student membership', /create or replace function public\.start_exam_attempt[\s\S]*is_active_student_member/i.test(eligibilityMigration));
check('staff is_org_member helper is not redefined', !/create or replace function public\.is_org_member/i.test(eligibilityMigration));
check('student membership helper is not directly browser-executable', /revoke all on function public\.is_active_student_member\(uuid, uuid\) from authenticated/i.test(eligibilityMigration));
check('question evidence code no longer uses PromiseLike.finally', !/\.finally\s*\(/.test(responseAudit));
check('school licence UI states ₹199 per licensed student', /₹199\s*\/\s*licensed student\s*\/\s*year/i.test(subscriptionCenter));
check('school licence UI does not promise unlimited students', !/Unlimited students|Unlimited on activation|No seat limits/i.test(subscriptionCenter));
check('school licence UI shows licensed and active quantities', /Licensed students/i.test(subscriptionCenter) && /Active students/i.test(subscriptionCenter));
check('release checklist contains all P0 items', Array.from({ length: 12 }, (_, index) => `P0.${index + 1}`).every((item) => releaseChecklist.includes(item)));
check('release workflow runs hardening checks', /phase1-hardening-smoke\.mjs/.test(releaseWorkflow));
check('release workflow runs final QA suite', /npm run qa:final/.test(releaseWorkflow));

for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'}  ${item.name}${item.details ? ` — ${item.details}` : ''}`);
}
console.log(`\n${checks.length - failures.length}/${checks.length} hardening checks passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
