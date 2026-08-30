begin;

create table if not exists public.credential_security_states (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  must_change_password boolean not null default false,
  temporary_issued_at timestamptz,
  password_changed_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.credential_security_states enable row level security;

revoke all on public.credential_security_states from public, anon, authenticated;
grant select on public.credential_security_states to authenticated;

create policy credential_security_states_self_read
on public.credential_security_states
for select
to authenticated
using (user_id = auth.uid());

create or replace function public.capture_temporary_password_issue_v20()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_student_id uuid;
begin
  if new.action not in ('school.student.password_reset', 'school.student.password_set') then
    return new;
  end if;

  select membership.student_id
  into v_student_id
  from public.student_school_memberships membership
  where membership.id::text = new.entity_id
  limit 1;

  if v_student_id is null then
    return new;
  end if;

  insert into public.credential_security_states(
    user_id,
    must_change_password,
    temporary_issued_at,
    updated_by,
    updated_at
  ) values (
    v_student_id,
    true,
    now(),
    new.actor_id,
    now()
  )
  on conflict (user_id) do update set
    must_change_password = true,
    temporary_issued_at = excluded.temporary_issued_at,
    updated_by = excluded.updated_by,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.capture_temporary_password_issue_v20() from public, anon, authenticated;

 drop trigger if exists capture_temporary_password_issue_v20 on public.audit_logs;
create trigger capture_temporary_password_issue_v20
after insert on public.audit_logs
for each row
execute function public.capture_temporary_password_issue_v20();

create or replace function public.evidara_privileged_mfa_satisfied_v20()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true) = 'service_role'
    or coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2',
    false
  )
$$;

revoke all on function public.evidara_privileged_mfa_satisfied_v20() from public, anon, authenticated;

create or replace function public.is_evidara_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    public.current_evidara_role() in ('super_admin', 'evidara_admin', 'admin', 'platform_admin')
    and public.evidara_privileged_mfa_satisfied_v20(),
    false
  )
$$;

create or replace function public.is_evidara_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    public.current_evidara_role() = 'super_admin'
    and public.evidara_privileged_mfa_satisfied_v20(),
    false
  )
$$;

create or replace function public.is_evidara_school_manager(p_organization_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    public.is_evidara_platform_admin()
    or (
      public.evidara_privileged_mfa_satisfied_v20()
      and exists (
        select 1
        from public.organization_members member
        where member.user_id = auth.uid()
          and member.is_active = true
          and (p_organization_id is null or member.organization_id = p_organization_id)
          and member.member_role::text in (
            'institute_owner', 'institute_admin', 'school_owner', 'school_admin'
          )
      )
    ),
    false
  )
$$;

create or replace function public.is_evidara_school_staff(p_organization_id uuid default null)
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
        and (p_organization_id is null or member.organization_id = p_organization_id)
        and member.member_role::text in (
          'teacher', 'school_teacher', 'reviewer', 'invigilator'
        )
    )
    or (
      public.evidara_privileged_mfa_satisfied_v20()
      and exists (
        select 1
        from public.organization_members member
        where member.user_id = auth.uid()
          and member.is_active = true
          and (p_organization_id is null or member.organization_id = p_organization_id)
          and member.member_role::text in (
            'institute_owner', 'institute_admin', 'school_owner', 'school_admin'
          )
      )
    ),
    false
  )
$$;

-- Preserve the explicit authenticated-only posture established by P0.11.
revoke all on function public.is_evidara_platform_admin() from public, anon;
revoke all on function public.is_evidara_super_admin() from public, anon;
revoke all on function public.is_evidara_school_manager(uuid) from public, anon;
revoke all on function public.is_evidara_school_staff(uuid) from public, anon;
grant execute on function public.is_evidara_platform_admin() to authenticated;
grant execute on function public.is_evidara_super_admin() to authenticated;
grant execute on function public.is_evidara_school_manager(uuid) to authenticated;
grant execute on function public.is_evidara_school_staff(uuid) to authenticated;

commit;
