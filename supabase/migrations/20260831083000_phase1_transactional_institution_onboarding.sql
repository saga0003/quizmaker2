-- Phase 1 B1: transactional institution onboarding.
-- All tenant bootstrap rows are created in one PostgreSQL transaction.

create or replace function public.onboard_institution_v1(
  p_actor_id uuid,
  p_admin_user_id uuid,
  p_name text,
  p_institute_type text default 'School',
  p_board text default 'Other',
  p_city text default '',
  p_state text default '',
  p_phone text default '',
  p_contact_name text default null,
  p_contact_email text default null,
  p_seat_limit integer default 100,
  p_starts_at date default current_date,
  p_ends_at date default (current_date + interval '1 year')::date
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id uuid;
  v_subscription_id uuid;
  v_slug text;
  v_actor_role text;
  v_admin_role text;
begin
  select role::text into v_actor_role
  from public.profiles
  where id = p_actor_id;

  if v_actor_role not in ('super_admin', 'evidara_admin', 'platform_admin', 'admin') then
    raise exception 'Super Admin permission is required.' using errcode = '42501';
  end if;

  if p_admin_user_id is null or not exists (select 1 from public.profiles where id = p_admin_user_id) then
    raise exception 'First School Admin must be an existing Evidara account.' using errcode = '22023';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_name, ''))) < 3 then
    raise exception 'Institution name is too short.' using errcode = '22023';
  end if;

  if coalesce(p_seat_limit, 0) < 1 then
    raise exception 'Licensed student count must be at least 1.' using errcode = '22023';
  end if;

  if p_ends_at <= p_starts_at then
    raise exception 'Licence end date must be after its start date.' using errcode = '22023';
  end if;

  v_slug := pg_catalog.lower(
    pg_catalog.regexp_replace(pg_catalog.btrim(p_name), '[^a-zA-Z0-9]+', '-', 'g')
  ) || '-' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.organizations (
    name, slug, institute_type, board, city, state, phone, contact_name, contact_email,
    student_count_range, status, created_by, is_demo
  ) values (
    pg_catalog.btrim(p_name), v_slug,
    coalesce(nullif(pg_catalog.btrim(p_institute_type), ''), 'School'),
    coalesce(nullif(pg_catalog.btrim(p_board), ''), 'Other'),
    coalesce(pg_catalog.btrim(p_city), ''), coalesce(pg_catalog.btrim(p_state), ''),
    coalesce(pg_catalog.btrim(p_phone), ''), nullif(pg_catalog.btrim(p_contact_name), ''),
    nullif(pg_catalog.btrim(p_contact_email), ''), p_seat_limit::text,
    'active', p_actor_id, false
  ) returning id into v_org_id;

  insert into public.school_subscriptions (
    organization_id, plan_name, status, starts_at, ends_at, seat_limit,
    resource_access, annual_price_per_student_paise, payment_status, created_by, metadata
  ) values (
    v_org_id, 'Evidara ₹199 Student Licence', 'active', p_starts_at, p_ends_at,
    p_seat_limit, 'full', 19900, 'unpaid', p_actor_id,
    jsonb_build_object('onboarding_version', 1, 'pricing_model', 'per_licensed_student_year')
  ) returning id into v_subscription_id;

  insert into public.organization_members (organization_id, user_id, member_role, is_active)
  values (v_org_id, p_admin_user_id, 'school_admin', true);

  select role::text into v_admin_role from public.profiles where id = p_admin_user_id for update;
  if v_admin_role in ('student', 'teacher', 'school_teacher', 'institute_admin', 'institute_owner') then
    update public.profiles set role = 'school_admin', updated_at = pg_catalog.now() where id = p_admin_user_id;
  elsif v_admin_role <> 'school_admin' then
    raise exception 'Selected first admin already has an incompatible platform role.' using errcode = '22023';
  end if;

  insert into public.audit_logs (actor_id, organization_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_id, v_org_id, 'institution.onboarded', 'organization', v_org_id::text,
    jsonb_build_object(
      'first_school_admin_user_id', p_admin_user_id,
      'subscription_id', v_subscription_id,
      'seat_limit', p_seat_limit,
      'annual_price_per_student_paise', 19900,
      'defaults', jsonb_build_object('board', coalesce(nullif(pg_catalog.btrim(p_board), ''), 'Other'), 'resource_access', 'full')
    )
  );

  return jsonb_build_object(
    'organization_id', v_org_id,
    'subscription_id', v_subscription_id,
    'first_school_admin_user_id', p_admin_user_id
  );
end;
$$;

revoke all on function public.onboard_institution_v1(uuid,uuid,text,text,text,text,text,text,text,text,integer,date,date) from public, anon, authenticated;
grant execute on function public.onboard_institution_v1(uuid,uuid,text,text,text,text,text,text,text,text,integer,date,date) to service_role;

comment on function public.onboard_institution_v1(uuid,uuid,text,text,text,text,text,text,text,text,integer,date,date)
is 'Phase 1 B1: atomically creates institution, annual licence, first School Admin membership/profile state, defaults and audit. Service-role only.';
