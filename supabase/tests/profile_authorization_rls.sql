-- Local Supabase authorization test. Run only against an isolated local/test
-- database after all historical SQL and the migration under test are applied.
-- The transaction is always rolled back and never needs production data.

begin;

do $$
begin
  if to_regclass('public.profiles') is null
     or to_regclass('public.profile_role_audit') is null then
    raise exception 'Required profile authorization schema is not installed.';
  end if;
end
$$;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'profile-authz-student@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Student"}', now(), now()),
  ('00000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'profile-authz-teacher@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Teacher"}', now(), now()),
  ('00000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'profile-authz-school-admin@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"School Admin"}', now(), now()),
  ('00000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'profile-authz-super-admin@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Super Admin"}', now(), now()),
  ('00000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'profile-authz-other@example.invalid', '', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Other User"}', now(), now());

update public.profiles
set role = case id
  when '00000000-0000-4000-8000-000000000002' then 'school_teacher'::public.app_role
  when '00000000-0000-4000-8000-000000000003' then 'school_admin'::public.app_role
  when '00000000-0000-4000-8000-000000000004' then 'super_admin'::public.app_role
  else 'student'::public.app_role
end
where id in (
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005'
);

create or replace function pg_temp.set_test_auth(p_user_id uuid, p_database_role text)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', p_database_role, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', p_database_role)::text,
    true
  );
end
$$;

create or replace function pg_temp.expect_direct_role_denied(
  p_actor_id uuid,
  p_role text,
  p_test_name text
)
returns void
language plpgsql
security invoker
as $$
begin
  perform pg_temp.set_test_auth(p_actor_id, 'authenticated');

  begin
    update public.profiles
    set role = p_role::public.app_role
    where id = p_actor_id;

    raise exception 'FAILED: % (role update unexpectedly succeeded)', p_test_name;
  exception
    when insufficient_privilege then
      return;
  end;
end
$$;

create or replace function pg_temp.expect_other_profile_denied(
  p_actor_id uuid,
  p_target_id uuid
)
returns void
language plpgsql
security invoker
as $$
declare
  affected_rows bigint;
begin
  perform pg_temp.set_test_auth(p_actor_id, 'authenticated');

  update public.profiles
  set full_name = 'Unauthorized change'
  where id = p_target_id;

  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'FAILED: normal user altered another profile';
  end if;
end
$$;

create or replace function pg_temp.expect_role_rpc_denied(
  p_actor_id uuid,
  p_target_id uuid,
  p_role text
)
returns void
language plpgsql
security invoker
as $$
begin
  perform pg_temp.set_test_auth(p_actor_id, 'authenticated');

  begin
    perform public.assign_evidara_role(p_target_id, p_role);
    raise exception 'FAILED: unauthorized role RPC unexpectedly succeeded';
  exception
    when insufficient_privilege then
      return;
  end;
end
$$;

set local role authenticated;

select pg_temp.expect_direct_role_denied('00000000-0000-4000-8000-000000000001', 'school_teacher', 'student to school_teacher');
select pg_temp.expect_direct_role_denied('00000000-0000-4000-8000-000000000001', 'school_admin', 'student to school_admin');
select pg_temp.expect_direct_role_denied('00000000-0000-4000-8000-000000000001', 'evidara_admin', 'student to evidara_admin');
select pg_temp.expect_direct_role_denied('00000000-0000-4000-8000-000000000001', 'super_admin', 'student to super_admin');
select pg_temp.expect_direct_role_denied('00000000-0000-4000-8000-000000000002', 'school_admin', 'school teacher self-promotion');
select pg_temp.expect_direct_role_denied('00000000-0000-4000-8000-000000000003', 'evidara_admin', 'school admin to platform role');

select pg_temp.expect_other_profile_denied(
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000005'
);

select pg_temp.set_test_auth('00000000-0000-4000-8000-000000000001', 'authenticated');
update public.profiles
set
  full_name = 'Updated Student',
  phone = '+910000000001',
  avatar_url = 'https://example.invalid/avatar.png',
  username = 'profile_authz_student'
where id = '00000000-0000-4000-8000-000000000001';

select pg_temp.expect_role_rpc_denied(
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000001',
  'school_teacher'
);

select public.create_school(
  'Authorization Test School',
  'School',
  'Test City',
  'Test State',
  '+910000000099',
  '1-100'
);

reset role;

do $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000001'
      and role::text = 'student'
  ) then
    raise exception 'FAILED: school registration changed the student profile role';
  end if;

  if not exists (
    select 1
    from public.organizations organization
    join public.organization_members member
      on member.organization_id = organization.id
    where organization.created_by = '00000000-0000-4000-8000-000000000001'
      and organization.status::text = 'pending'
      and member.user_id = organization.created_by
      and member.member_role::text = 'institute_owner'
      and member.is_active = false
  ) then
    raise exception 'FAILED: school registration was not retained as a pending inactive request';
  end if;
end
$$;

set local role authenticated;
select pg_temp.set_test_auth('00000000-0000-4000-8000-000000000004', 'authenticated');
select public.assign_evidara_role(
  '00000000-0000-4000-8000-000000000001',
  'school_teacher'
);

reset role;

do $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = '00000000-0000-4000-8000-000000000001'
      and full_name = 'Updated Student'
      and phone = '+910000000001'
      and avatar_url = 'https://example.invalid/avatar.png'
      and username::text = 'profile_authz_student'
      and role::text = 'school_teacher'
  ) then
    raise exception 'FAILED: approved profile fields or authorized Super Admin role assignment did not persist';
  end if;

  if not exists (
    select 1
    from public.profile_role_audit
    where profile_id = '00000000-0000-4000-8000-000000000001'
      and old_role = 'student'
      and new_role = 'school_teacher'
      and changed_by = '00000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'FAILED: authenticated Super Admin role assignment was not audited';
  end if;
end
$$;

set local role service_role;
select pg_temp.set_test_auth('00000000-0000-4000-8000-000000000004', 'service_role');
select public.assign_evidara_role_for_actor_v13(
  '00000000-0000-4000-8000-000000000004',
  '00000000-0000-4000-8000-000000000005',
  'evidara_admin'
);
reset role;

do $$
begin
  if not exists (
    select 1
    from public.profile_role_audit
    where profile_id = '00000000-0000-4000-8000-000000000005'
      and old_role = 'student'
      and new_role = 'evidara_admin'
      and changed_by = '00000000-0000-4000-8000-000000000004'
      and source = 'access_control_api'
  ) then
    raise exception 'FAILED: service-only role assignment was not attributed and audited';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.assign_evidara_role_for_actor_v13(uuid,uuid,text)',
    'execute'
  ) then
    raise exception 'FAILED: authenticated retained EXECUTE on the service-only role RPC';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.assign_evidara_role_for_actor_v13(uuid,uuid,text)',
    'execute'
  ) then
    raise exception 'FAILED: service_role cannot execute the audited role RPC';
  end if;

    raise notice 'Profile authorization RLS tests passed: all required denial, pending-registration, personal-edit, privileged-path, and audit assertions succeeded.';
end
$$;

rollback;
