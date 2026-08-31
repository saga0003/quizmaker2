import fs from 'node:fs';

const ui = fs.readFileSync('src/components/evidara/admin-school-control.tsx', 'utf8');
const onboardingRoute = fs.readFileSync('src/app/api/admin/institution-onboarding/route.ts', 'utf8');

const checks = [
  ['guided onboarding exposes four named steps', /const onboardingSteps = \['Institution', 'First admin', 'Licence', 'Review'\]/],
  ['register action is presented as onboarding', /Onboard institution/],
  ['wizard starts at institution details', /wizardStep === 0[\s\S]*Institution details/],
  ['institution step requires core identity/location fields', /wizardStep === 0[\s\S]*schoolForm\.name[\s\S]*schoolForm\.city[\s\S]*schoolForm\.state/],
  ['wizard has explicit first School Admin step', /wizardStep === 1[\s\S]*First School Admin/],
  ['first admin is required before continuing', /wizardStep === 1[\s\S]*firstAdminUserId\.trim\(\)/],
  ['wizard has annual licence step', /wizardStep === 2[\s\S]*Annual licence/],
  ['licence step validates positive seat count', /Number\(subForm\.seat_limit \|\| 0\) > 0/],
  ['licence step validates end date after start date', /subForm\.ends_at > subForm\.starts_at/],
  ['wizard shows fixed Phase 1 price', /Price \/ student \/ year[\s\S]*₹199/],
  ['review step summarizes institution admin licence and term', /Review before onboarding[\s\S]*First School Admin[\s\S]*Annual licence[\s\S]*Term/],
  ['review explains transactional all-or-rollback behavior', /transactional onboarding service[\s\S]*all succeed together or all roll back/],
  ['creation uses dedicated transactional onboarding endpoint', /fetch\('\/api\/admin\/institution-onboarding\/'/],
  ['creation payload carries first admin explicitly', /firstAdminUserId: firstAdminUserId\.trim\(\)/],
  ['normal school-control create action is not used by UI', !/action:\s*'create'/.test(ui)],
  ['existing-school edit remains available', /action:\s*'save'/],
  ['server onboarding still requires Super Admin', /isSuperAdmin\(profile\.role\)/],
  ['server onboarding still requires first School Admin', /First School Admin is required/],
  ['server onboarding delegates to transactional RPC', /auth\.admin\.rpc\('onboard_institution_v1'/],
];

let failed = 0;
for (const [label, pattern] of checks) {
  const ok = typeof pattern === 'boolean' ? pattern : pattern.test(label.startsWith('server onboarding') ? onboardingRoute : ui);
  console.log(`${ok ? 'PASS' : 'FAIL'} B2 — ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`B2 institution onboarding wizard smoke failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`B2 institution onboarding wizard smoke passed: ${checks.length}/${checks.length}.`);
