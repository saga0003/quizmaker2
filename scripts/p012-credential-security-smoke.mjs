import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260831031500_phase1_credential_hardening.sql');
const server = read('src/lib/server/supabaseServer.ts');
const route = read('src/app/api/account/security/route.ts');
const gate = read('src/components/evidara/credential-security-gate.tsx');
const page = read('src/app/page.tsx');
const schoolRoute = read('src/app/api/school-platform/route.ts');

const checks = [
  ['credential state table exists', /create table if not exists public\.credential_security_states/i.test(migration)],
  ['credential state table has RLS', /alter table public\.credential_security_states enable row level security/i.test(migration)],
  ['temporary password audit trigger exists', /capture_temporary_password_issue_v20/i.test(migration) && /school\.student\.password_reset/.test(migration)],
  ['privileged MFA database helper exists', /evidara_privileged_mfa_satisfied_v20/i.test(migration) && /aal2/.test(migration)],
  ['platform admin helper requires MFA', /create or replace function public\.is_evidara_platform_admin[\s\S]*evidara_privileged_mfa_satisfied_v20/i.test(migration)],
  ['school manager helper requires MFA', /create or replace function public\.is_evidara_school_manager[\s\S]*evidara_privileged_mfa_satisfied_v20/i.test(migration)],
  ['server privileged routes require AAL2', /privilegedRoles/.test(server) && /accessTokenAal/.test(server) && /MFA_REQUIRED/.test(server)],
  ['security bootstrap can run before AAL2', /allowPrivilegedAal1/.test(server) && /allowPrivilegedAal1: true/.test(route)],
  ['new password policy is server enforced', /password\.length < 12/.test(route) && /uppercase letter/.test(route) && /symbol/.test(route)],
  ['password completion is audited', /account\.password_setup_completed/.test(route)],
  ['workspace gate enforces password replacement', /mustChangePassword/.test(gate) && /Create your private password/.test(gate)],
  ['workspace gate enrolls and verifies TOTP', /auth\.mfa\.enroll/.test(gate) && /challengeAndVerify/.test(gate) && /getAuthenticatorAssuranceLevel/.test(gate)],
  ['root workspace is wrapped in security gate', /<CredentialSecurityGate>[\s\S]*<ViewRouter \/>[\s\S]*<\/CredentialSecurityGate>/.test(page)],
  ['school issued passwords use cryptographic randomness', /crypto\.randomUUID\(\)/.test(schoolRoute)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`P0.12 credential security smoke failed: ${failed}/${checks.length} checks failed.`);
  process.exit(1);
}

console.log(`P0.12 credential security smoke passed: ${checks.length}/${checks.length}.`);
