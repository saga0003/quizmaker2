import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const migrationPath = join(root, 'supabase', 'migrations', '20260807111613_secure_profiles_authorization.sql');
const databaseTestPath = join(root, 'supabase', 'tests', 'profile_authorization_rls.sql');
const accessControlPath = join(root, 'src', 'app', 'api', 'access-control', 'route.ts');
const schoolPlatformPath = join(root, 'src', 'app', 'api', 'school-platform', 'route.ts');
const demoBootstrapPath = join(root, 'scripts', 'bootstrap-sales-demo.mjs');

const migration = readFileSync(migrationPath, 'utf8');
const databaseTest = readFileSync(databaseTestPath, 'utf8');
const accessControl = readFileSync(accessControlPath, 'utf8');
const schoolPlatform = readFileSync(schoolPlatformPath, 'utf8');
const demoBootstrap = readFileSync(demoBootstrapPath, 'utf8');
const schoolRegistrationStart = migration.indexOf('create or replace function public.create_school');
const schoolRegistrationEnd = migration.indexOf('comment on function public.create_school', schoolRegistrationStart);
const schoolRegistrationFunction = migration.slice(schoolRegistrationStart, schoolRegistrationEnd);

let passed = 0;
function expect(name, condition) {
  if (!condition) throw new Error(`Profile authorization smoke failed: ${name}`);
  passed += 1;
  console.log(`PASS ${passed}: ${name}`);
}

expect('historical broad profile update policy is removed', migration.includes('drop policy if exists profiles_update_own_or_admin'));
expect('replacement update policy is self-row-only', /create policy profiles_update_own_personal_fields[\s\S]*using \(\(select auth\.uid\(\)\) = id\)[\s\S]*with check \(\(select auth\.uid\(\)\) = id\)/i.test(migration));
expect('broad authenticated UPDATE is revoked', /revoke update on table public\.profiles from public, anon, authenticated/i.test(migration));
expect('only reviewed personal fields receive UPDATE', /grant update \(full_name, phone, avatar_url, username\)[\s\S]*to authenticated/i.test(migration));
expect('role is not included in the authenticated column grant', !/grant update \([^)]*role[^)]*\)[\s\S]*to authenticated/i.test(migration));
expect('database trigger rejects direct client role changes', migration.includes("current_user in ('anon', 'authenticated')"));
expect('audited server role RPC is service-role-only', /revoke all on function public\.assign_evidara_role_for_actor_v13\(uuid, uuid, text\)[\s\S]*from public, anon, authenticated;[\s\S]*grant execute[\s\S]*to service_role;/i.test(migration));
expect('audited server role RPC revalidates the Super Admin actor', migration.includes("actor_role is distinct from 'super_admin'"));
expect('role audit captures API actor and source', migration.includes('app.evidara_role_change_actor_id') && migration.includes('access_control_api'));
expect('Access Control API uses the audited V14 role RPC', /\.rpc\(['\"]assign_account_role_service_v14['\"]/.test(accessControl));
expect('Access Control API no longer directly updates profiles.role', !/from\('profiles'\)\.update\(\{ role \}\)/.test(accessControl));
expect('school registration remains pending without changing profiles.role', schoolRegistrationStart >= 0 && schoolRegistrationEnd > schoolRegistrationStart && /'institute_owner',\s+false/i.test(schoolRegistrationFunction) && !/update public\.profiles/i.test(schoolRegistrationFunction));
expect('student invitation does not overwrite an existing profile role', !/from\("profiles"\)\.upsert\(\{[\s\S]{0,180}?role:/i.test(schoolPlatform));
expect('demo provisioning delegates role changes to role RPCs', !/from\("profiles"\)\.upsert\(\{[\s\S]{0,180}?role,/i.test(demoBootstrap));

for (const requiredCase of [
  "'student to school_teacher'",
  "'student to school_admin'",
  "'student to evidara_admin'",
  "'student to super_admin'",
  "'school teacher self-promotion'",
  "'school admin to platform role'",
  'expect_other_profile_denied',
  "full_name = 'Updated Student'",
  'expect_role_rpc_denied',
  'school registration changed the student profile role',
  'access_control_api',
]) {
  expect(`database test covers ${requiredCase}`, databaseTest.includes(requiredCase));
}

console.log(`Profile authorization smoke passed (${passed}/${passed}).`);
