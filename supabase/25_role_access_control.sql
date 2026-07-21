begin;

-- Evidara V7 canonical roles:
-- super_admin, evidara_admin, school_admin, school_teacher, student
-- Legacy values remain accepted during migration so existing accounts do not break.

alter table public.profiles
  alter column role set default 'student';

update public.profiles
set role = 'student'
where role is null or btrim(role) = '';

do $$
declare
  role_attnum smallint;
  constraint_row record;
begin
  select attnum
  into role_attnum
  from pg_attribute
  where attrelid = 'public.profiles'::regclass
    and attname = 'role'
    and not attisdropped;

  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and role_attnum = any (conkey)
  loop
    execute format('alter table public.profiles drop constraint %I', constraint_row.conname);
  end loop;
end
$$;

alter table public.profiles
  add constraint profiles_role_allowed
  check (
    role in (
      'super_admin',
      'evidara_admin',
      'school_admin',
      'school_teacher',
      'student',
      -- Backward-compatible values retained until all existing records are migrated.
      'admin',
      'platform_admin',
      'institute_owner',
      'institute_admin',
      'school_owner',
      'teacher',
      'reviewer',
      'invigilator'
    )
  );

-- Extend organization membership role checks without changing existing memberships.
do $$
declare
  member_role_attnum smallint;
  constraint_row record;
begin
  if to_regclass('public.organization_members') is null then
    return;
  end if;

  select attnum
  into member_role_attnum
  from pg_attribute
  where attrelid = 'public.organization_members'::regclass
    and attname = 'member_role'
    and not attisdropped;

  if member_role_attnum is null then
    return;
  end if;

  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.organization_members'::regclass
      and contype = 'c'
      and member_role_attnum = any (conkey)
  loop
    execute format('alter table public.organization_members drop constraint %I', constraint_row.conname);
  end loop;

  execute $constraint$
    alter table public.organization_members
      add constraint organization_members_member_role_allowed
      check (
        member_role in (
          'school_admin',
          'school_teacher',
          'institute_owner',
          'institute_admin',
          'school_owner',
          'teacher',
          'reviewer',
          'invigilator'
        )
      )
  $constraint$;
end
$$;

create or replace function public.current_evidara_role()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
  limit 1
$$;

create or replace function public.is_evidara_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.current_evidara_role() = 'super_admin', false)
$$;

create or replace function public.is_evidara_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(public.current_evidara_role() in ('super_admin', 'evidara_admin', 'admin', 'platform_admin'), false)
$$;

create table if not exists public.profile_role_audit (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  old_role text,
  new_role text not null,
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  source text not null default 'profile_update'
);

create index if not exists profile_role_audit_profile_changed_idx
  on public.profile_role_audit(profile_id, changed_at desc);

alter table public.profile_role_audit enable row level security;

drop policy if exists profile_role_audit_super_admin_select on public.profile_role_audit;
create policy profile_role_audit_super_admin_select
on public.profile_role_audit
for select
to authenticated
using (public.is_evidara_super_admin());

create or replace function public.audit_evidara_profile_role_change()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if old.role is distinct from new.role then
    insert into public.profile_role_audit (
      profile_id,
      old_role,
      new_role,
      changed_by,
      source
    ) values (
      new.id,
      old.role,
      new.role,
      auth.uid(),
      case when auth.role() = 'service_role' then 'service_role' else 'profile_update' end
    );
  end if;
  return new;
end
$$;

drop trigger if exists audit_evidara_profile_role_change on public.profiles;
create trigger audit_evidara_profile_role_change
after update of role on public.profiles
for each row
execute function public.audit_evidara_profile_role_change();

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
  if auth.role() <> 'service_role' and not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can assign Evidara roles.' using errcode = '42501';
  end if;

  if requested_role not in (
    'super_admin',
    'evidara_admin',
    'school_admin',
    'school_teacher',
    'student'
  ) then
    raise exception 'Unsupported Evidara role: %', requested_role using errcode = '22023';
  end if;

  update public.profiles
  set role = requested_role,
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'Evidara profile not found for user %', p_user_id using errcode = 'P0002';
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
  if auth.role() <> 'service_role' and not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can assign Evidara roles.' using errcode = '42501';
  end if;

  select id
  into target_user_id
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if target_user_id is null then
    raise exception 'No Supabase Auth user exists for %', p_email using errcode = 'P0002';
  end if;

  perform public.assign_evidara_role(target_user_id, p_role);
  return target_user_id;
end
$$;

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
begin
  if auth.role() <> 'service_role' and not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can assign school roles.' using errcode = '42501';
  end if;

  if requested_role not in ('school_admin', 'school_teacher') then
    raise exception 'School role must be school_admin or school_teacher.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.organizations where id = p_organization_id
  ) then
    raise exception 'School organization not found.' using errcode = 'P0002';
  end if;

  target_user_id := public.assign_evidara_role_by_email(p_email, requested_role);

  update public.organization_members
  set member_role = requested_role,
      is_active = true,
      updated_at = now()
  where organization_id = p_organization_id
    and user_id = target_user_id;

  if not found then
    insert into public.organization_members (
      organization_id,
      user_id,
      member_role,
      is_active
    ) values (
      p_organization_id,
      target_user_id,
      requested_role,
      true
    );
  end if;

  return target_user_id;
end
$$;

revoke all on function public.current_evidara_role() from public;
revoke all on function public.is_evidara_super_admin() from public;
revoke all on function public.is_evidara_platform_admin() from public;
revoke all on function public.assign_evidara_role(uuid, text) from public, anon;
revoke all on function public.assign_evidara_role_by_email(text, text) from public, anon;
revoke all on function public.assign_evidara_school_role_by_email(text, uuid, text) from public, anon;

grant execute on function public.current_evidara_role() to authenticated, service_role;
grant execute on function public.is_evidara_super_admin() to authenticated, service_role;
grant execute on function public.is_evidara_platform_admin() to authenticated, service_role;
grant execute on function public.assign_evidara_role(uuid, text) to authenticated, service_role;
grant execute on function public.assign_evidara_role_by_email(text, text) to authenticated, service_role;
grant execute on function public.assign_evidara_school_role_by_email(text, uuid, text) to authenticated, service_role;

commit;
