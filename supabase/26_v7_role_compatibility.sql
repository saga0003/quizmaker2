begin;

-- The application stores canonical V7 roles in public.profiles.
-- Earlier question-bank and paper-builder RLS/functions use legacy organization
-- membership values. Keep those internal membership values for compatibility
-- while the interface continues to display School Admin and School Teacher.

update public.organization_members
set member_role = case
  when member_role = 'school_admin' then 'institute_admin'
  when member_role = 'school_teacher' then 'teacher'
  else member_role
end,
updated_at = now()
where member_role in ('school_admin', 'school_teacher');

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
  compatible_member_role text;
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

  compatible_member_role := case
    when requested_role = 'school_admin' then 'institute_admin'
    else 'teacher'
  end;

  target_user_id := public.assign_evidara_role_by_email(p_email, requested_role);

  update public.organization_members
  set member_role = compatible_member_role,
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
      compatible_member_role,
      true
    );
  end if;

  return target_user_id;
end
$$;

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
        and (p_organization_id is null or member.organization_id = p_organization_id)
        and member.member_role in (
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
        and (p_organization_id is null or member.organization_id = p_organization_id)
        and member.member_role in (
          'institute_owner',
          'institute_admin',
          'school_owner',
          'school_admin'
        )
    ),
    false
  )
$$;

revoke all on function public.assign_evidara_school_role_by_email(text, uuid, text) from public, anon;
revoke all on function public.is_evidara_school_staff(uuid) from public, anon;
revoke all on function public.is_evidara_school_manager(uuid) from public, anon;

grant execute on function public.assign_evidara_school_role_by_email(text, uuid, text) to authenticated, service_role;
grant execute on function public.is_evidara_school_staff(uuid) to authenticated, service_role;
grant execute on function public.is_evidara_school_manager(uuid) to authenticated, service_role;

commit;
