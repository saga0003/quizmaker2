begin;

-- The original organization_members table has created_at but no updated_at.
alter table public.organization_members
  add column if not exists updated_at timestamptz not null default now();

-- Automatically refresh updated_at whenever a membership is changed.
drop trigger if exists organization_members_set_updated_at
on public.organization_members;

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row
execute function public.set_updated_at();

-- Convert any canonical V7 school membership values to the legacy internal
-- values expected by the existing question-bank and paper-builder policies.
update public.organization_members
set
  member_role = case member_role::text
    when 'school_admin' then 'institute_admin'::public.app_role
    when 'school_teacher' then 'teacher'::public.app_role
    else member_role
  end,
  updated_at = now()
where member_role::text in ('school_admin', 'school_teacher');


-- ============================================================
-- Canonical profile role assignment
-- ============================================================

create or replace function public.assign_evidara_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  requested_role text := lower(btrim(p_role));
begin
  if auth.role() <> 'service_role'
     and not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can assign Evidara roles.'
      using errcode = '42501';
  end if;

  if requested_role not in (
    'super_admin',
    'evidara_admin',
    'school_admin',
    'school_teacher',
    'student'
  ) then
    raise exception 'Unsupported Evidara role: %', requested_role
      using errcode = '22023';
  end if;

  update public.profiles
  set
    role = requested_role::public.app_role,
    updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Evidara profile not found for user %', p_user_id
      using errcode = 'P0002';
  end if;
end
$$;


create or replace function public.assign_evidara_role_by_email(
  p_email text,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
begin
  if auth.role() <> 'service_role'
     and not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can assign Evidara roles.'
      using errcode = '42501';
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception 'No Supabase Auth user exists for %', p_email
      using errcode = 'P0002';
  end if;

  perform public.assign_evidara_role(
    target_user_id,
    p_role
  );

  return target_user_id;
end
$$;


-- ============================================================
-- School Admin and School Teacher assignment
-- ============================================================

create or replace function public.assign_evidara_school_role_by_email(
  p_email text,
  p_organization_id uuid,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_user_id uuid;
  requested_role text := lower(btrim(p_role));
  compatible_member_role public.app_role;
begin
  if auth.role() <> 'service_role'
     and not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can assign school roles.'
      using errcode = '42501';
  end if;

  if requested_role not in (
    'school_admin',
    'school_teacher'
  ) then
    raise exception
      'School role must be school_admin or school_teacher.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.organizations
    where id = p_organization_id
  ) then
    raise exception 'School organization not found.'
      using errcode = 'P0002';
  end if;

  -- profiles.role stores the canonical V7 role.
  -- organization_members keeps the compatible legacy role.
  compatible_member_role := case
    when requested_role = 'school_admin'
      then 'institute_admin'::public.app_role
    else 'teacher'::public.app_role
  end;

  target_user_id :=
    public.assign_evidara_role_by_email(
      p_email,
      requested_role
    );

  update public.organization_members
  set
    member_role = compatible_member_role,
    is_active = true,
    updated_at = now()
  where organization_id = p_organization_id
    and user_id = target_user_id;

  if not found then
    insert into public.organization_members (
      organization_id,
      user_id,
      member_role,
      is_active,
      updated_at
    )
    values (
      p_organization_id,
      target_user_id,
      compatible_member_role,
      true,
      now()
    );
  end if;

  return target_user_id;
end
$$;


-- ============================================================
-- School permission helpers
-- ============================================================

create or replace function public.is_evidara_school_staff(
  p_organization_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    public.is_evidara_platform_admin()
    or exists (
      select 1
      from public.organization_members member
      where member.user_id = auth.uid()
        and member.is_active = true
        and (
          p_organization_id is null
          or member.organization_id = p_organization_id
        )
        and member.member_role::text in (
          'institute_owner',
          'institute_admin',
          'school_owner',
          'school_admin',
          'teacher',
          'school_teacher',
          'reviewer',
          'invigilator'
        )
    ),
    false
  )
$$;


create or replace function public.is_evidara_school_manager(
  p_organization_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    public.is_evidara_platform_admin()
    or exists (
      select 1
      from public.organization_members member
      where member.user_id = auth.uid()
        and member.is_active = true
        and (
          p_organization_id is null
          or member.organization_id = p_organization_id
        )
        and member.member_role::text in (
          'institute_owner',
          'institute_admin',
          'school_owner',
          'school_admin'
        )
    ),
    false
  )
$$;


-- ============================================================
-- Function permissions
-- ============================================================

revoke all
on function public.assign_evidara_role(uuid, text)
from public, anon;

revoke all
on function public.assign_evidara_role_by_email(text, text)
from public, anon;

revoke all
on function public.assign_evidara_school_role_by_email(
  text,
  uuid,
  text
)
from public, anon;

revoke all
on function public.is_evidara_school_staff(uuid)
from public, anon;

revoke all
on function public.is_evidara_school_manager(uuid)
from public, anon;


grant execute
on function public.assign_evidara_role(uuid, text)
to authenticated, service_role;

grant execute
on function public.assign_evidara_role_by_email(text, text)
to authenticated, service_role;

grant execute
on function public.assign_evidara_school_role_by_email(
  text,
  uuid,
  text
)
to authenticated, service_role;

grant execute
on function public.is_evidara_school_staff(uuid)
to authenticated, service_role;

grant execute
on function public.is_evidara_school_manager(uuid)
to authenticated, service_role;

commit;
