-- Phase 1 onboarding v2: complete institution data, dedicated School Admin, duplicate protection.
create or replace function public.onboard_institution_v2(
  p_actor_id uuid,
  p_admin_user_id uuid,
  p_name text,
  p_institute_type text default 'School',
  p_board text default 'Other',
  p_address_line1 text default null,
  p_address_line2 text default null,
  p_city text default '',
  p_state text default '',
  p_postal_code text default null,
  p_phone text default '',
  p_secondary_phone text default null,
  p_website text default null,
  p_contact_name text default null,
  p_contact_email text default null,
  p_seat_limit integer default 100,
  p_starts_at date default current_date,
  p_ends_at date default ((current_date + interval '1 year'))::date,
  p_resource_access text default 'full'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_org_id uuid;
  v_subscription_id uuid;
  v_slug text;
  v_actor_role text;
  v_admin_role text;
begin
  select role::text into v_actor_role from public.profiles where id = p_actor_id;
  if v_actor_role not in ('super_admin', 'evidara_admin', 'platform_admin', 'admin') then
    raise exception 'Super Admin permission is required.' using errcode = '42501';
  end if;

  select role::text into v_admin_role from public.profiles where id = p_admin_user_id;
  if v_admin_role is null then
    raise exception 'First School Admin account was not found.' using errcode = '22023';
  end if;
  if v_admin_role <> 'school_admin' then
    raise exception 'First School Admin must use a dedicated School Admin account.' using errcode = '22023';
  end if;

  if pg_catalog.length(pg_catalog.btrim(coalesce(p_name, ''))) < 3 then
    raise exception 'Institution name is too short.' using errcode = '22023';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_city, ''))) < 2
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_state, ''))) < 2 then
    raise exception 'City and state are required.' using errcode = '22023';
  end if;
  if coalesce(p_seat_limit, 0) < 1 or p_seat_limit > 100000 then
    raise exception 'Licensed student count must be between 1 and 100000.' using errcode = '22023';
  end if;
  if p_ends_at <= p_starts_at then
    raise exception 'Licence end date must be after its start date.' using errcode = '22023';
  end if;
  if coalesce(nullif(pg_catalog.btrim(p_resource_access), ''), 'full') not in ('full', 'limited') then
    raise exception 'Unsupported resource access setting.' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.organizations o
    where pg_catalog.lower(pg_catalog.btrim(o.name)) = pg_catalog.lower(pg_catalog.btrim(p_name))
      and pg_catalog.lower(pg_catalog.btrim(o.city)) = pg_catalog.lower(pg_catalog.btrim(p_city))
  ) then
    raise exception 'An institution with this name and city already exists.' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.organization_members om
    where om.user_id = p_admin_user_id and om.is_active = true
  ) then
    raise exception 'This School Admin is already attached to an institution. Use a dedicated admin account for the new institution.' using errcode = '22023';
  end if;

  v_slug := pg_catalog.lower(pg_catalog.regexp_replace(pg_catalog.btrim(p_name), '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8);

  insert into public.organizations (
    name, slug, institute_type, board, address_line1, address_line2, city, state, postal_code,
    phone, secondary_phone, website, contact_name, contact_email, student_count_range, status, created_by, is_demo
  ) values (
    pg_catalog.btrim(p_name), v_slug,
    coalesce(nullif(pg_catalog.btrim(p_institute_type), ''), 'School'),
    coalesce(nullif(pg_catalog.btrim(p_board), ''), 'Other'),
    nullif(pg_catalog.btrim(coalesce(p_address_line1, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_address_line2, '')), ''),
    pg_catalog.btrim(p_city), pg_catalog.btrim(p_state),
    nullif(pg_catalog.btrim(coalesce(p_postal_code, '')), ''),
    coalesce(pg_catalog.btrim(p_phone), ''),
    nullif(pg_catalog.btrim(coalesce(p_secondary_phone, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_website, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_contact_name, '')), ''),
    nullif(pg_catalog.btrim(coalesce(p_contact_email, '')), ''),
    p_seat_limit::text, 'active', p_actor_id, false
  ) returning id into v_org_id;

  insert into public.school_subscriptions (
    organization_id, plan_name, status, starts_at, ends_at, seat_limit, resource_access,
    annual_price_per_student_paise, payment_status, created_by, metadata
  ) values (
    v_org_id, 'Evidara Institution Licence', 'active', p_starts_at, p_ends_at, p_seat_limit,
    coalesce(nullif(pg_catalog.btrim(p_resource_access), ''), 'full'), 19900, 'unpaid', p_actor_id,
    jsonb_build_object('onboarding_version', 2, 'pricing_model', 'per_licensed_student_year', 'institution_rate_paise', 19900)
  ) returning id into v_subscription_id;

  insert into public.organization_members (organization_id, user_id, member_role, is_active)
  values (v_org_id, p_admin_user_id, 'school_admin', true);

  insert into public.audit_logs (actor_id, organization_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_id, v_org_id, 'institution.onboarded', 'organization', v_org_id::text,
    jsonb_build_object(
      'onboarding_version', 2,
      'first_school_admin_user_id', p_admin_user_id,
      'subscription_id', v_subscription_id,
      'seat_limit', p_seat_limit,
      'annual_price_per_student_paise', 19900,
      'resource_access', coalesce(nullif(pg_catalog.btrim(p_resource_access), ''), 'full')
    )
  );

  return jsonb_build_object(
    'organization_id', v_org_id,
    'subscription_id', v_subscription_id,
    'first_school_admin_user_id', p_admin_user_id,
    'slug', v_slug
  );
end;
$function$;

revoke all on function public.onboard_institution_v2(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,integer,date,date,text) from public, anon, authenticated;
grant execute on function public.onboard_institution_v2(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,integer,date,date,text) to service_role;
