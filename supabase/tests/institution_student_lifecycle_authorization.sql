-- Local/disposable authorization verification for Phase 1 Increment 4.
-- Apply the historical schema and timestamped migrations first. This test uses
-- synthetic UUIDs, runs in one transaction, and always rolls back.

begin;

do $$
begin
  if to_regclass('public.student_school_memberships') is null
     or to_regclass('public.academic_sections') is null
     or to_regclass('public.teacher_section_assignments') is null
     or to_regprocedure('public.list_school_student_lifecycle_v13(uuid)') is null then
    raise exception 'Required Increment 4 lifecycle schema is not installed.';
  end if;
end
$$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at, invited_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-4000-9000-000000000101', 'authenticated', 'authenticated', 'lifecycle-admin@example.invalid', '', now(), null, '{"provider":"email","providers":["email"]}', '{"full_name":"Lifecycle Admin"}', now(), now()),
  ('00000000-0000-4000-9000-000000000102', 'authenticated', 'authenticated', 'lifecycle-teacher@example.invalid', '', now(), null, '{"provider":"email","providers":["email"]}', '{"full_name":"Assigned Teacher"}', now(), now()),
  ('00000000-0000-4000-9000-000000000103', 'authenticated', 'authenticated', 'lifecycle-inactive-teacher@example.invalid', '', now(), null, '{"provider":"email","providers":["email"]}', '{"full_name":"Inactive Teacher"}', now(), now()),
  ('00000000-0000-4000-9000-000000000104', 'authenticated', 'authenticated', 'lifecycle-assigned-student@example.invalid', '', now(), null, '{"provider":"email","providers":["email"]}', '{"full_name":"Assigned Student"}', now(), now()),
  ('00000000-0000-4000-9000-000000000105', 'authenticated', 'authenticated', 'lifecycle-other-section@example.invalid', '', null, now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Other Section Student"}', now(), now()),
  ('00000000-0000-4000-9000-000000000106', 'authenticated', 'authenticated', 'lifecycle-cross-org@example.invalid', '', now(), null, '{"provider":"email","providers":["email"]}', '{"full_name":"Cross Organization Student"}', now(), now());

update public.profiles
set role = case id
  when '00000000-0000-4000-9000-000000000101' then 'school_admin'::public.app_role
  when '00000000-0000-4000-9000-000000000102' then 'school_teacher'::public.app_role
  when '00000000-0000-4000-9000-000000000103' then 'school_teacher'::public.app_role
  else 'student'::public.app_role
end
where id in (
  '00000000-0000-4000-9000-000000000101',
  '00000000-0000-4000-9000-000000000102',
  '00000000-0000-4000-9000-000000000103',
  '00000000-0000-4000-9000-000000000104',
  '00000000-0000-4000-9000-000000000105',
  '00000000-0000-4000-9000-000000000106'
);

insert into public.organizations (
  id, name, slug, school_type, city, state, phone, status, created_by, board
)
values
  ('10000000-0000-4000-9000-000000000001', 'Lifecycle School A', 'lifecycle-school-a', 'School', 'Test City', 'Test State', '+910000000001', 'active', '00000000-0000-4000-9000-000000000101', 'CBSE'),
  ('10000000-0000-4000-9000-000000000002', 'Lifecycle School B', 'lifecycle-school-b', 'School', 'Other City', 'Other State', '+910000000002', 'active', '00000000-0000-4000-9000-000000000101', 'CBSE');

insert into public.organization_members (
  id, organization_id, user_id, member_role, is_active
)
values
  ('20000000-0000-4000-9000-000000000001', '10000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000101', 'institute_admin', true),
  ('20000000-0000-4000-9000-000000000002', '10000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000102', 'teacher', true),
  ('20000000-0000-4000-9000-000000000003', '10000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000103', 'teacher', false);

insert into public.academic_sections (
  id, organization_id, academic_year, grade, name, code, is_active, created_by
)
values
  ('30000000-0000-4000-9000-000000000001', '10000000-0000-4000-9000-000000000001', '2026-27', 10, 'A', '10-A', true, '00000000-0000-4000-9000-000000000101'),
  ('30000000-0000-4000-9000-000000000002', '10000000-0000-4000-9000-000000000001', '2026-27', 10, 'B', '10-B', true, '00000000-0000-4000-9000-000000000101'),
  ('30000000-0000-4000-9000-000000000003', '10000000-0000-4000-9000-000000000002', '2026-27', 10, 'X', '10-X', true, '00000000-0000-4000-9000-000000000101');

insert into public.teacher_section_assignments (
  id, section_id, teacher_id, subject_label, is_active, assigned_by
)
values
  ('40000000-0000-4000-9000-000000000001', '30000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000102', 'All subjects', true, '00000000-0000-4000-9000-000000000101'),
  ('40000000-0000-4000-9000-000000000002', '30000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000103', 'All subjects', true, '00000000-0000-4000-9000-000000000101');

insert into public.student_school_memberships (
  id, organization_id, student_id, academic_year, grade, section, section_id,
  board, tracks, status, promotion_locked, parent_name, parent_phone
)
values
  ('50000000-0000-4000-9000-000000000001', '10000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000104', '2026-27', 10, 'A', '30000000-0000-4000-9000-000000000001', 'CBSE', array['Boards'], 'active', false, 'Assigned Parent', '+910000000104'),
  ('50000000-0000-4000-9000-000000000002', '10000000-0000-4000-9000-000000000001', '00000000-0000-4000-9000-000000000105', '2026-27', 10, 'B', '30000000-0000-4000-9000-000000000002', 'CBSE', array['Foundation'], 'active', false, 'Other Parent', '+910000000105'),
  ('50000000-0000-4000-9000-000000000003', '10000000-0000-4000-9000-000000000002', '00000000-0000-4000-9000-000000000106', '2026-27', 10, 'X', '30000000-0000-4000-9000-000000000003', 'CBSE', array['Boards'], 'active', false, 'Cross Parent', '+910000000106');

create or replace function pg_temp.set_lifecycle_actor(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
end
$$;

create or replace function pg_temp.expect_roster_denied(
  p_actor uuid,
  p_organization uuid,
  p_label text
)
returns void
language plpgsql
security invoker
as $$
begin
  perform pg_temp.set_lifecycle_actor(p_actor);
  begin
    perform public.list_school_student_lifecycle_v13(p_organization);
    raise exception 'FAILED: %', p_label;
  exception
    when insufficient_privilege then return;
  end;
end
$$;

create or replace function pg_temp.expect_teacher_action_denied(
  p_actor uuid,
  p_membership uuid,
  p_label text
)
returns void
language plpgsql
security invoker
as $$
begin
  perform pg_temp.set_lifecycle_actor(p_actor);
  begin
    perform public.update_school_student_tracks_v13(p_membership, array['NEET']);
    raise exception 'FAILED: %', p_label;
  exception
    when insufficient_privilege then return;
  end;
end
$$;

create or replace function pg_temp.assert_admin_scope()
returns void
language plpgsql
security invoker
as $$
declare
  payload jsonb;
  direct_count integer;
begin
  perform pg_temp.set_lifecycle_actor('00000000-0000-4000-9000-000000000101');
  payload := public.list_school_student_lifecycle_v13('10000000-0000-4000-9000-000000000001');

  if payload->>'manager' <> 'true' or payload->>'scope' <> 'organization' then
    raise exception 'FAILED: School Admin did not receive manager organization scope';
  end if;
  if jsonb_array_length(payload->'students') <> 2 then
    raise exception 'FAILED: School Admin could not access the complete own-organization roster';
  end if;
  if payload::text like '%Cross Organization Student%' then
    raise exception 'FAILED: School Admin roster exposed another organization';
  end if;
  if not exists (
    select 1 from jsonb_array_elements(payload->'students') item
    where item->>'name' = 'Other Section Student'
      and item->>'invitationStatus' = 'invited'
  ) then
    raise exception 'FAILED: invitation status was not preserved in the roster DTO';
  end if;
  if exists (
    select 1 from jsonb_array_elements(payload->'students') item
    where item ?| array['studentId','email','role','avatarUrl','createdAt','updatedAt','rawUserMetaData','rawAppMetaData']
  ) then
    raise exception 'FAILED: roster DTO exposed privileged or unrelated profile/security fields';
  end if;

  select count(*) into direct_count from public.student_school_memberships;
  if direct_count <> 2 then
    raise exception 'FAILED: School Admin direct RLS scope was not limited to their organization';
  end if;
end
$$;

create or replace function pg_temp.assert_teacher_scope()
returns void
language plpgsql
security invoker
as $$
declare
  payload jsonb;
  student jsonb;
  direct_count integer;
begin
  perform pg_temp.set_lifecycle_actor('00000000-0000-4000-9000-000000000102');
  payload := public.list_school_student_lifecycle_v13('10000000-0000-4000-9000-000000000001');
  student := payload->'students'->0;

  if payload->>'manager' <> 'false' or payload->>'scope' <> 'assigned_sections' then
    raise exception 'FAILED: teacher scope was not read-only assigned_sections';
  end if;
  if jsonb_array_length(payload->'students') <> 1
     or student->>'name' <> 'Assigned Student' then
    raise exception 'FAILED: teacher received organization-wide or incorrect roster data';
  end if;
  if student ?| array['parentName','parentPhone','studentId','email','role','avatarUrl','createdAt','updatedAt'] then
    raise exception 'FAILED: teacher roster DTO exposed parent, privileged, or unrelated fields';
  end if;

  select count(*) into direct_count from public.student_school_memberships;
  if direct_count <> 1 then
    raise exception 'FAILED: teacher RLS did not restrict direct reads to the assigned section';
  end if;
end
$$;

set local role authenticated;

-- 1. School Admin can access only their own institution roster.
select pg_temp.assert_admin_scope();

-- 2. School Admin cannot select an unrelated institution.
select pg_temp.expect_roster_denied(
  '00000000-0000-4000-9000-000000000101',
  '10000000-0000-4000-9000-000000000002',
  'School Admin accessed another organization roster'
);

-- 3/4. Teacher has no organization-wide roster and their assigned section works.
select pg_temp.assert_teacher_scope();

-- 5. A student cannot open the institution roster contract.
select pg_temp.expect_roster_denied(
  '00000000-0000-4000-9000-000000000104',
  '10000000-0000-4000-9000-000000000001',
  'student opened the institution roster'
);

-- 6. An inactive organization membership cannot use a still-active assignment.
select pg_temp.expect_roster_denied(
  '00000000-0000-4000-9000-000000000103',
  '10000000-0000-4000-9000-000000000001',
  'inactive teacher membership opened the roster'
);

-- 7. A teacher cannot bypass scope with an arbitrary organization identifier.
select pg_temp.expect_roster_denied(
  '00000000-0000-4000-9000-000000000102',
  '10000000-0000-4000-9000-000000000002',
  'teacher used an arbitrary organization identifier'
);

-- Teachers cannot mutate even a student they can read.
select pg_temp.expect_teacher_action_denied(
  '00000000-0000-4000-9000-000000000102',
  '50000000-0000-4000-9000-000000000001',
  'teacher changed a student lifecycle record'
);

-- 8. An own-organization admin cannot target an arbitrary cross-organization student.
select pg_temp.expect_teacher_action_denied(
  '00000000-0000-4000-9000-000000000101',
  '50000000-0000-4000-9000-000000000003',
  'School Admin changed a cross-organization student by membership id'
);

-- 9. The authorized manager path still works and writes an audit record.
select pg_temp.set_lifecycle_actor('00000000-0000-4000-9000-000000000101');
select public.update_school_student_tracks_v13(
  '50000000-0000-4000-9000-000000000001',
  array['Boards','NEET']
);

reset role;

do $$
begin
  if not exists (
    select 1 from public.student_school_memberships
    where id = '50000000-0000-4000-9000-000000000001'
      and tracks @> array['Boards','NEET']
  ) then
    raise exception 'FAILED: authorized School Admin track update did not persist';
  end if;

  if not exists (
    select 1 from public.audit_logs
    where actor_id = '00000000-0000-4000-9000-000000000101'
      and organization_id = '10000000-0000-4000-9000-000000000001'
      and action = 'school.student_tracks.updated'
      and entity_id = '50000000-0000-4000-9000-000000000001'
  ) then
    raise exception 'FAILED: authorized roster mutation was not audited';
  end if;

  if has_function_privilege('authenticated', 'public.promote_school_student(uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.revoke_school_student(uuid,text)', 'execute')
     or has_function_privilege('authenticated', 'public.promote_all_school_students(uuid,text,text)', 'execute')
     or has_function_privilege('authenticated', 'public.revoke_all_school_students(uuid,text,text)', 'execute') then
    raise exception 'FAILED: authenticated retained execution of a teacher-permissive legacy lifecycle RPC';
  end if;

  if has_function_privilege('anon', 'public.list_school_student_lifecycle_v13(uuid)', 'execute') then
    raise exception 'FAILED: anon can execute the institution roster DTO';
  end if;

  if has_table_privilege('authenticated', 'public.student_school_memberships', 'insert')
     or has_table_privilege('authenticated', 'public.student_school_memberships', 'update')
     or has_table_privilege('authenticated', 'public.student_school_memberships', 'delete') then
    raise exception 'FAILED: authenticated retained direct membership mutation privileges';
  end if;

  raise notice 'Institution lifecycle authorization tests passed: manager tenancy, teacher section scope, inactive/student denial, identifier isolation, DTO minimization, checked writes, audit, and grants are correct.';
end
$$;

rollback;
