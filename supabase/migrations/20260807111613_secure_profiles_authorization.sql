-- Phase 0 stop-ship fix: prevent authenticated profile owners from changing
-- authorization-bearing fields while retaining narrowly scoped personal edits.
--
-- Approved authenticated self-edit fields:
--   full_name, phone, avatar_url, username
--
-- Security/system fields intentionally excluded:
--   id, role, created_at, updated_at

begin;

alter table public.profiles enable row level security;

-- The historical policy limited rows but allowed every updatable column,
-- including role. Replace it with a self-row policy and pair it with explicit
-- column privileges below.
drop policy if exists profiles_update_own_or_admin on public.profiles;
drop policy if exists profiles_update_own_personal_fields on public.profiles;

create policy profiles_update_own_personal_fields
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Table privileges and RLS are independent in PostgreSQL. Remove broad and
-- historical column grants first, then allow only the reviewed personal fields.
revoke update on table public.profiles from public, anon, authenticated;
revoke update (
  id,
  full_name,
  phone,
  role,
  avatar_url,
  created_at,
  updated_at,
  username
) on public.profiles from public, anon, authenticated;

grant update (full_name, phone, avatar_url, username)
on public.profiles
to authenticated;

comment on policy profiles_update_own_personal_fields on public.profiles is
  'Authenticated users may update only their own row; column grants limit writes to full_name, phone, avatar_url, and username.';

-- School registration used to change the caller from student to the legacy
-- institute_owner role (normalized by the app as school_admin). Preserve the
-- registration request, but keep both the profile role and membership inactive
-- until an authorized administrator approves and assigns the account.
create or replace function public.create_school(
  p_name text,
  p_type text,
  p_city text,
  p_state text,
  p_phone text,
  p_student_count text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_slug text;
begin
  if v_user is null then
    raise exception 'You must be logged in to register a school.'
      using errcode = '42501';
  end if;

  if pg_catalog.length(pg_catalog.btrim(p_name)) < 3 then
    raise exception 'School name is too short.' using errcode = '22023';
  end if;

  v_slug := pg_catalog.lower(
    pg_catalog.regexp_replace(
      pg_catalog.btrim(p_name),
      '[^a-zA-Z0-9]+',
      '-',
      'g'
    )
  ) || '-' || pg_catalog.substr(
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
    1,
    6
  );

  insert into public.organizations (
    name,
    slug,
    school_type,
    city,
    state,
    phone,
    student_count_range,
    status,
    created_by,
    board
  ) values (
    pg_catalog.btrim(p_name),
    v_slug,
    pg_catalog.btrim(p_type),
    pg_catalog.btrim(p_city),
    pg_catalog.btrim(p_state),
    pg_catalog.btrim(p_phone),
    p_student_count,
    'pending',
    v_user,
    'Other'
  )
  returning id into v_org;

  insert into public.organization_members (
    organization_id,
    user_id,
    member_role,
    is_active
  ) values (
    v_org,
    v_user,
    'institute_owner',
    false
  )
  on conflict (organization_id, user_id) do update
  set
    member_role = excluded.member_role,
    is_active = false,
    updated_at = pg_catalog.now();

  insert into public.audit_logs (
    actor_id,
    organization_id,
    action,
    entity_type,
    entity_id
  ) values (
    v_user,
    v_org,
    'organization.created',
    'organization',
    v_org::text
  );

  return v_org;
end
$$;

revoke all on function public.create_school(text, text, text, text, text, text)
from public, anon;
grant execute on function public.create_school(text, text, text, text, text, text)
to authenticated;

comment on function public.create_school(text, text, text, text, text, text) is
  'Creates a pending school-registration request without changing the caller profile role; owner membership remains inactive until authorized approval.';

-- Defense in depth: even if a future migration accidentally restores a broad
-- UPDATE grant, a direct anon/authenticated statement still cannot change role.
-- Existing checked SECURITY DEFINER functions and service-only server paths run
-- as their database owner/service role and remain available.
create or replace function public.guard_profiles_client_role_change_v13()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.role is distinct from new.role
     and current_user in ('anon', 'authenticated') then
    raise exception 'Profile role changes require an authorized role-management function.'
      using errcode = '42501';
  end if;

  return new;
end
$$;

revoke all on function public.guard_profiles_client_role_change_v13()
from public, anon, authenticated;

drop trigger if exists guard_profiles_client_role_change_v13 on public.profiles;
create trigger guard_profiles_client_role_change_v13
before update of role on public.profiles
for each row
execute function public.guard_profiles_client_role_change_v13();

-- Preserve the existing role audit and add trusted human-actor attribution for
-- service-role calls made by the authenticated Access Control API.
create or replace function public.audit_evidara_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_setting text := nullif(
    pg_catalog.current_setting('app.evidara_role_change_actor_id', true),
    ''
  );
  audit_actor uuid;
  audit_source text;
begin
  if old.role is distinct from new.role then
    if actor_setting is not null then
      begin
        audit_actor := actor_setting::uuid;
      exception
        when invalid_text_representation then
          raise exception 'Invalid audited role-change actor.' using errcode = '22023';
      end;
    else
      audit_actor := auth.uid();
    end if;

    audit_source := coalesce(
      nullif(
        pg_catalog.current_setting('app.evidara_role_change_source', true),
        ''
      ),
      case
        when coalesce(auth.jwt() ->> 'role', '') = 'service_role'
          then 'service_role'
        else 'profile_update'
      end
    );

    insert into public.profile_role_audit (
      profile_id,
      old_role,
      new_role,
      changed_by,
      source
    ) values (
      new.id,
      old.role::text,
      new.role::text,
      audit_actor,
      audit_source
    );
  end if;

  return new;
end
$$;

-- This RPC is deliberately SECURITY INVOKER and executable only by the
-- service_role. It also verifies that the human actor authenticated by the API
-- is still a Super Admin before changing the target profile.
create or replace function public.assign_evidara_role_for_actor_v13(
  p_actor_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  requested_role text := pg_catalog.lower(pg_catalog.btrim(p_role));
  actor_role text;
begin
  if current_user <> 'service_role' then
    raise exception 'The audited role-management function is server-only.'
      using errcode = '42501';
  end if;

  if p_actor_id is null or p_user_id is null then
    raise exception 'A role-change actor and target are required.'
      using errcode = '22023';
  end if;

  select profile.role::text
  into actor_role
  from public.profiles profile
  where profile.id = p_actor_id;

  if actor_role is distinct from 'super_admin' then
    raise exception 'Only Super Admin can assign Evidara roles.'
      using errcode = '42501';
  end if;

  if requested_role is null or requested_role not in (
    'super_admin',
    'evidara_admin',
    'school_admin',
    'school_teacher',
    'student'
  ) then
    raise exception 'Unsupported Evidara role: %', requested_role
      using errcode = '22023';
  end if;

  perform pg_catalog.set_config(
    'app.evidara_role_change_actor_id',
    p_actor_id::text,
    true
  );
  perform pg_catalog.set_config(
    'app.evidara_role_change_source',
    'access_control_api',
    true
  );

  update public.profiles
  set role = requested_role::public.app_role
  where id = p_user_id;

  if not found then
    raise exception 'Evidara profile not found for user %', p_user_id
      using errcode = 'P0002';
  end if;

  perform pg_catalog.set_config('app.evidara_role_change_actor_id', '', true);
  perform pg_catalog.set_config('app.evidara_role_change_source', '', true);
end
$$;

revoke all on function public.assign_evidara_role_for_actor_v13(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.assign_evidara_role_for_actor_v13(uuid, uuid, text)
to service_role;

comment on function public.assign_evidara_role_for_actor_v13(uuid, uuid, text) is
  'Service-only role assignment for the Access Control API; requires a current Super Admin actor and writes actor/source through profile_role_audit.';

commit;

notify pgrst, 'reload schema';
