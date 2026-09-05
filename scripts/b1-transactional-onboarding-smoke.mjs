import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260831083000_phase1_transactional_institution_onboarding.sql', 'utf8');
const route = fs.readFileSync('src/app/api/admin/institution-onboarding/route.ts', 'utf8');

const checks = [
  ['single transactional RPC exists', /create or replace function public\.onboard_institution_v1/],
  ['RPC is SECURITY DEFINER with empty search path', /security definer[\s\S]*set search_path = ''/],
  ['organization created inside RPC', /insert into public\.organizations/],
  ['annual licence created inside RPC', /insert into public\.school_subscriptions/],
  ['199 annual price default enforced', /annual_price_per_student_paise[\s\S]*19900/],
  ['first School Admin membership created', /insert into public\.organization_members[\s\S]*'school_admin'/],
  ['School Admin profile state established', /update public\.profiles set role = 'school_admin'/],
  ['onboarding audit written', /'institution\.onboarded'/],
  ['defaults recorded with onboarding metadata', /'onboarding_version'[\s\S]*'resource_access'/],
  ['invalid seat count fails transaction', /Licensed student count must be at least 1/],
  ['invalid dates fail transaction', /Licence end date must be after its start date/],
  ['browser roles cannot execute onboarding RPC', /revoke all on function[\s\S]*from public, anon, authenticated/],
  ['service role is the only application executor', /grant execute on function[\s\S]*to service_role/],
  ['server route requires Super Admin', /isSuperAdmin\(profile\.role\)/],
  ['server route requires explicit first admin', /First School Admin is required/],
  ['server route delegates bootstrap to one RPC', /auth\.admin\.rpc\('onboard_institution_v1'/],
];

let failed = 0;
for (const [label, pattern] of checks) {
  const source = label.startsWith('server route') ? route : migration;
  const ok = pattern.test(source);
  console.log(`${ok ? 'PASS' : 'FAIL'} B1 — ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`B1 transactional onboarding smoke failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`B1 transactional onboarding smoke passed: ${checks.length}/${checks.length}.`);
