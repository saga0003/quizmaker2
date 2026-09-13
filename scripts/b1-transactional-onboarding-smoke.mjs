import fs from 'node:fs';

const migration = fs.readFileSync('supabase/migrations/20260913030000_institution_onboarding_v2.sql', 'utf8');
const route = fs.readFileSync('src/app/api/admin/institution-onboarding/route.ts', 'utf8');

const checks = [
  ['single transactional v2 RPC exists', /create or replace function public\.onboard_institution_v2/],
  ['RPC is SECURITY DEFINER with empty search path', /security definer[\s\S]*set search_path = ''/],
  ['organization created inside RPC', /insert into public\.organizations/],
  ['complete institution profile is persisted', /address_line1[\s\S]*address_line2[\s\S]*postal_code[\s\S]*secondary_phone[\s\S]*website/],
  ['annual licence created inside RPC', /insert into public\.school_subscriptions/],
  ['199 annual institutional price is enforced', /annual_price_per_student_paise[\s\S]*19900/],
  ['first School Admin membership created', /insert into public\.organization_members[\s\S]*'school_admin'/],
  ['dedicated School Admin profile is required', /v_admin_role <> 'school_admin'[\s\S]*dedicated School Admin account/],
  ['existing active admin membership is rejected', /already attached to an institution/],
  ['duplicate institution name and city are rejected', /institution with this name and city already exists/],
  ['onboarding audit is written', /'institution\.onboarded'/],
  ['v2 metadata records pricing model', /'onboarding_version'[\s\S]*'pricing_model'[\s\S]*'institution_rate_paise'/],
  ['invalid seat count fails transaction', /Licensed student count must be between 1 and 100000/],
  ['invalid dates fail transaction', /Licence end date must be after its start date/],
  ['browser roles cannot execute onboarding RPC', /revoke all on function[\s\S]*from public, anon, authenticated/],
  ['service role is the only application executor', /grant execute on function[\s\S]*to service_role/],
  ['server route requires Super Admin', /isSuperAdmin\(actorProfile\.role\)/],
  ['server route requires first admin identity by email', /First School Admin name is required[\s\S]*first School Admin email is required/],
  ['new School Admin is invited rather than given a generated password', /inviteUserByEmail\(adminEmail/],
  ['invited School Admin is forced through private password setup', /credential_security_states[\s\S]*must_change_password:\s*true/],
  ['route refuses silent promotion of existing non-school-admin account', /role is \$\{String\(profile\.role\)\}[\s\S]*dedicated School Admin email/],
  ['route cleans invited account if transaction fails', /if \(createdUserId\)[\s\S]*deleteUser\(createdUserId\)/],
  ['server route delegates bootstrap to one v2 RPC', /auth\.admin\.rpc\('onboard_institution_v2'/],
];

let failed = 0;
for (const [label, pattern] of checks) {
  const routeCheck = label.startsWith('server route') || label.startsWith('new School') || label.startsWith('invited School') || label.startsWith('route refuses') || label.startsWith('route cleans');
  const source = routeCheck ? route : migration;
  const ok = pattern.test(source);
  console.log(`${ok ? 'PASS' : 'FAIL'} B1 — ${label}`);
  if (!ok) failed += 1;
}

if (failed) {
  console.error(`B1 transactional onboarding smoke failed: ${failed}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`B1 transactional onboarding smoke passed: ${checks.length}/${checks.length}.`);
