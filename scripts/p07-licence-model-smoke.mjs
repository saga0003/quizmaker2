import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const check = (name, condition) => {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) failures.push(name);
};

const migration = read('supabase/migrations/20260830172500_phase1_assignment_and_subscription_core.sql');
const subscriptionCenter = read('src/components/school/SubscriptionCenter.tsx');
const schoolControl = read('src/app/api/admin/school-control/route.ts');

check('canonical annual licence state exists', /create or replace function public\.school_license_state_v19/i.test(migration));
check('licensed quantity is enforced on active student memberships', /create trigger student_membership_licence_guard_v19/i.test(migration) && /v_used\s*>=\s*v_limit/i.test(migration));
check('zero or missing licence cannot activate students', /No student licences are configured for this institution/i.test(migration));
check('licence guard serializes concurrent activations', /pg_advisory_xact_lock/i.test(migration));
check('school UI states ₹199 per licensed student per year', /₹199\s*\/\s*licensed student\s*\/\s*year/i.test(subscriptionCenter));
check('school UI explicitly shows Licensed students', /Licensed students/i.test(subscriptionCenter));
check('school UI explicitly shows Active students', /Active students/i.test(subscriptionCenter));
check('school UI reports remaining licence quantity', /available\s*=\s*Math\.max\(0,\s*licensed\s*-\s*used\)/i.test(subscriptionCenter) && /licence\$\{available === 1 \? "" : "s"\} available/i.test(subscriptionCenter));
check('school UI never promises unlimited students', !/Unlimited students|Unlimited on activation|No seat limits/i.test(subscriptionCenter));
check('unlimited applies only to tests', /Unlimited tests/i.test(subscriptionCenter) && /No per-test charge/i.test(subscriptionCenter));
check('Super Admin defaults to ₹199 in paise', /annual_price_per_student_paise:\s*Math\.max\(0, Number\(subscription\.annual_price_per_student_paise \|\| 19900\)\)/i.test(schoolControl));
check('Super Admin stores explicit seat_limit', /seat_limit:\s*Math\.max\(0, Number\(subscription\.seat_limit \|\| 0\)\)/i.test(schoolControl));

console.log(`\n${12 - failures.length}/12 P0.7 licence-model checks passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}
