-- ScholarOS V5: cloud school platform compatibility and organisation metadata.
-- Apply after 09_permanent_revocation_guard.sql.

alter table public.organizations
  add column if not exists board text not null default 'Other';

-- Use the latest roster board as a safe migration default where possible.
update public.organizations organization
set board = latest.board
from lateral (
  select membership.board
  from public.student_school_memberships membership
  where membership.organization_id = organization.id
  order by membership.academic_year desc, membership.updated_at desc
  limit 1
) latest
where organization.board = 'Other'
  and latest.board is not null;

-- Replace the compatibility function so it targets the foundation schema's
-- school_type column rather than the obsolete institute_type name.
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
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_slug text;
begin
  if v_user is null then
    raise exception 'You must be logged in to create a school.';
  end if;

  if length(trim(p_name)) < 3 then
    raise exception 'School name is too short.';
  end if;

  v_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);

  insert into public.organizations(
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
  )
  values (
    trim(p_name),
    v_slug,
    trim(p_type),
    trim(p_city),
    trim(p_state),
    trim(p_phone),
    p_student_count,
    'pending',
    v_user,
    'Other'
  )
  returning id into v_org;

  insert into public.organization_members(organization_id, user_id, member_role)
  values(v_org, v_user, 'institute_owner')
  on conflict(organization_id, user_id) do update
    set member_role = 'institute_owner', is_active = true;

  update public.profiles
  set role = 'institute_owner', updated_at = now()
  where id = v_user;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id)
  values(v_user, v_org, 'organization.created', 'organization', v_org::text);

  return v_org;
end
$$;

grant execute on function public.create_school(text, text, text, text, text, text) to authenticated;
