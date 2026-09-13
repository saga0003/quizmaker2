import fs from 'node:fs';

const ui = fs.readFileSync('src/components/evidara/admin-school-control.tsx', 'utf8');
const route = fs.readFileSync('src/app/api/admin/institution-onboarding/route.ts', 'utf8');

const checks = [
  ['guided onboarding exposes four named steps', /const steps = \['Institution', 'First admin', 'Licence', 'Review'\]/],
  ['register action is presented as onboarding', /Onboard institution/],
  ['wizard starts with complete institution details', /step === 0[\s\S]*Institution details[\s\S]*Address line 1[\s\S]*PIN \/ postal code[\s\S]*Website/],
  ['institution step requires name city and state', /step === 0[\s\S]*school\.name[\s\S]*school\.city[\s\S]*school\.state/],
  ['wizard has explicit first School Admin step', /step === 1[\s\S]*First School Admin/],
  ['operator UI contains no UUID workflow', !ui.includes('UUID') && !ui.includes('Existing Evidara user ID')],
  ['first admin captures name email and mobile', /Full name \*[\s\S]*Email \*[\s\S]*Mobile number/],
  ['first admin email is required before continuing', /step === 1[\s\S]*admin\.fullName[\s\S]*admin\.email/],
  ['wizard has annual licence step', /step === 2[\s\S]*Annual institution licence/],
  ['licence step validates positive seat count', /Number\(sub\.seat_limit \|\| 0\) > 0/],
  ['licence step validates end date after start date', /sub\.ends_at > sub\.starts_at/],
  ['wizard shows fixed institution price', /Institution rate[\s\S]*₹199 \/ student \/ year/],
  ['wizard shows estimated annual licence value', /Estimated annual licence/],
  ['review summarizes institution admin licence and term', /Review before onboarding[\s\S]*First School Admin[\s\S]*Annual licence[\s\S]*Term/],
  ['review communicates duplicate and admin safety', /Duplicate institutions are blocked[\s\S]*School Admin is invited by email/],
  ['creation uses dedicated onboarding endpoint', /fetch\('\/api\/admin\/institution-onboarding\/'/],
  ['creation payload carries first admin object', /firstAdmin: admin/],
  ['normal school-control create action is not used by UI', !/action:\s*'create'/.test(ui)],
  ['existing-school edit remains available', /action:\s*'save'/],
  ['payment amount is entered in rupees rather than paise', /Amount received \(₹\)/],
  ['server onboarding requires Super Admin', /isSuperAdmin\(actorProfile\.role\)/],
  ['server onboarding validates admin email', /valid first School Admin email is required/],
  ['server onboarding invites new admins', /inviteUserByEmail\(adminEmail/],
  ['server onboarding rejects conflicting existing roles', /Use a dedicated School Admin email/],
  ['server onboarding delegates to hardened v2 RPC', /auth\.admin\.rpc\('onboard_institution_v2'/],
];

let failed = 0;
for (const [label, pattern] of checks) {
  const source = label.startsWith('server onboarding') ? route : ui;
  const ok = typeof pattern === 'boolean' ? pattern : pattern.test(source);
  console.log(`${ok ? 'PASS' : 'FAIL'} B2 — ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`B2 institution onboarding wizard smoke failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`B2 institution onboarding wizard smoke passed: ${checks.length}/${checks.length}.`);
