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

const subscriptionCenter = read('src/components/school/SubscriptionCenter.tsx');
const adminControl = read('src/components/evidara/admin-school-control.tsx');
const schoolRoute = read('src/app/api/admin/school-control/route.ts');
const licenceMigration = read('supabase/migrations/20260830172500_phase1_assignment_and_subscription_core.sql');
const resultMigration = read('supabase/migrations/20260830235800_phase1_result_release_security.sql');
const canonicalPlan = read('supabase/migrations/20260901150443_phase1_canonical_commercial_plan.sql');

check('G1 canonical plan is ₹199 times licensed students for annual period', /₹199 per licensed student for the annual licence period/i.test(subscriptionCenter) && /ANNUAL_RATE_PAISE\s*=\s*19900/.test(adminControl) && /annual_price_per_student_paise\s*=\s*19900/i.test(canonicalPlan));
check('G2 school view shows licensed students', /Licensed students/i.test(subscriptionCenter));
check('G2 school view shows active students', /Active students/i.test(subscriptionCenter));
check('G2 school view calculates available licences', /available\s*=\s*Math\.max\(0,\s*licensed\s*-\s*used\)/.test(subscriptionCenter));
check('G2 school view shows annual start/end dates', /Valid from/i.test(subscriptionCenter) && /Renewal date/i.test(subscriptionCenter));
check('G2 school view shows canonical rate', /₹199\s*\/\s*licensed student\s*\/\s*year/i.test(subscriptionCenter));
check('G3 Super Admin uses immutable canonical annual rate', /ANNUAL_RATE_PAISE\s*=\s*19900/.test(adminControl) && /annual_price_per_student_paise:\s*ANNUAL_RATE_PAISE/.test(adminControl) && /annual_price_per_student_paise:\s*19900/.test(schoolRoute));
check('G3 Super Admin displays annual amount from licensed quantity', /label="Annual licence amount"/.test(adminControl) && /Math\.max\(0,\s*Number\(subForm\.seat_limit\s*\|\|\s*0\)\)\s*\*\s*ANNUAL_RATE_PAISE/.test(adminControl));
check('G3 payment and invoice references are retained', /payment_reference/.test(adminControl) && /invoice_reference/.test(adminControl) && /payment_reference/.test(schoolRoute) && /invoice_reference/.test(schoolRoute));
check('G4 unlimited tests and no per-test charge are explicit', /Unlimited tests/i.test(subscriptionCenter) && /No per-test charge/i.test(subscriptionCenter));
check('G5 active, grace, expired and suspended states are server defined', /return 'active'/i.test(licenceMigration) && /return 'grace'/i.test(licenceMigration) && /return 'expired'/i.test(licenceMigration) && /return 'suspended'/i.test(licenceMigration));
check('G5 new activity is restricted to active or grace', /school_license_state_v19\(p_organization_id, current_date\) in \('active','grace'\)/i.test(licenceMigration));
check('G5 historical result reads remain independent of current licence state', /create or replace function public\.list_my_attempt_results/i.test(resultMigration) && !/school_can_run_new_activity_v19/i.test(resultMigration));
check('G6 manual payment record is supported', /Manual payment record/i.test(adminControl) && /payment_status/.test(adminControl) && /Amount paid \(paise\)/i.test(adminControl));
check('G6 activation remains admin controlled without checkout dependency', /Institution controlled by Evidara/i.test(subscriptionCenter) && /record payments manually/i.test(adminControl));

console.log(`\n${15 - failures.length}/15 Section G commercial-control checks passed.`);
if (failures.length) {
  console.error(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}