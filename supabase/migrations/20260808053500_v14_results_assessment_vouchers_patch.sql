-- V14 correction patch: focused self-assessment caps + Super Admin complimentary vouchers.

create or replace function public.self_assessment_exam_cap_v14(p_exam_type text, p_test_type text)
returns jsonb
language sql
immutable
set search_path to 'public'
as $function$
select case
  when upper(trim(coalesce(p_exam_type,'')))='NEET'
    and lower(trim(coalesce(p_test_type,''))) in ('full mock','full_length_mock','mock','full length')
    then jsonb_build_object('maxQuestions',180,'subjects',jsonb_build_object('Physics',45,'Chemistry',45,'Botany',45,'Zoology',45))
  when upper(trim(coalesce(p_exam_type,''))) like 'JEE MAIN%'
    and lower(trim(coalesce(p_test_type,''))) in ('full mock','full_length_mock','mock','full length')
    then jsonb_build_object('maxQuestions',75,'subjects',jsonb_build_object('Physics',25,'Chemistry',25,'Mathematics',25))
  when lower(trim(coalesce(p_test_type,''))) in ('topic','topic_test','topic test')
    then jsonb_build_object('maxQuestions',20,'subjects','{}'::jsonb)
  when lower(trim(coalesce(p_test_type,''))) in ('weak_area','weak area','weak-area','weakness')
    then jsonb_build_object('maxQuestions',25,'subjects','{}'::jsonb)
  when lower(trim(coalesce(p_test_type,''))) in ('chapter','chapter_test','chapter test')
    then jsonb_build_object('maxQuestions',30,'subjects','{}'::jsonb)
  when lower(trim(coalesce(p_test_type,''))) in ('subject','subject_test','subject test')
    then jsonb_build_object('maxQuestions',45,'subjects','{}'::jsonb)
  else jsonb_build_object('maxQuestions',60,'subjects','{}'::jsonb)
end
$function$;

create or replace function public.admin_upsert_voucher_v9(
  p_voucher_id uuid,
  p_code text,
  p_description text,
  p_discount_percent integer,
  p_purpose public.voucher_purpose,
  p_product_id uuid,
  p_allowed_email text,
  p_organization_id uuid,
  p_seat_count integer,
  p_usage_limit integer,
  p_per_user_limit integer,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_active boolean,
  p_offline_payment_reference text,
  p_offline_amount_paise integer,
  p_internal_note text
)
returns uuid
language plpgsql
security definer
set search_path to 'public','auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_code text := upper(btrim(p_code));
  v_email text := nullif(lower(btrim(coalesce(p_allowed_email,''))), '');
  v_reference text := nullif(btrim(coalesce(p_offline_payment_reference,'')), '');
  v_seat_count integer := p_seat_count;
  v_super boolean;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  if not public.is_evidara_platform_admin() then raise exception 'Evidara Admin or Super Admin access required.' using errcode='42501'; end if;
  v_super := public.is_evidara_super_admin();
  if v_code !~ '^[A-Z0-9_-]{4,32}$' then raise exception 'Voucher code must contain 4–32 letters, numbers, hyphens or underscores.'; end if;
  if p_discount_percent not between 1 and 100 then raise exception 'Discount must be between 1%% and 100%%.'; end if;
  if not v_super and p_discount_percent > 10 then raise exception 'Only Super Admin can create discounts above 10%%.' using errcode='42501'; end if;

  if p_discount_percent = 100 then
    if not v_super then raise exception 'Only Super Admin can create a 100%% voucher.' using errcode='42501'; end if;
    if p_product_id is null then raise exception 'A 100%% voucher must be linked to one product.'; end if;
    p_usage_limit := coalesce(p_usage_limit,1);
    p_per_user_limit := 1;
    if p_purpose = 'offline_payment' then
      if p_organization_id is null then raise exception 'Choose the school for an offline-payment voucher.'; end if;
      if v_reference is null or coalesce(p_offline_amount_paise,0) <= 0 then raise exception 'Record the offline amount and transaction, receipt or invoice reference.'; end if;
      if coalesce(v_seat_count,0) <= 0 then raise exception 'Enter the number of school seats being activated.'; end if;
    elsif p_purpose not in ('manual_access','scholarship','promotion') then
      raise exception 'Unsupported complimentary voucher purpose.';
    else
      v_seat_count := null;
      p_offline_amount_paise := null;
      v_reference := null;
    end if;
  else
    if p_purpose='offline_payment' then raise exception 'Offline-payment activation uses a controlled 100%% voucher.'; end if;
    v_seat_count := null;
    p_offline_amount_paise := null;
    v_reference := null;
  end if;

  if p_usage_limit is not null and p_usage_limit < 1 then raise exception 'Usage limit must be positive.'; end if;
  if coalesce(p_per_user_limit,0) < 1 then raise exception 'Per-user limit must be positive.'; end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at<=p_starts_at then raise exception 'Voucher end time must be after its start time.'; end if;

  if p_voucher_id is null then
    insert into public.voucher_codes(
      code,description,discount_percent,purpose,product_id,allowed_email,organization_id,seat_count,
      usage_limit,per_user_limit,starts_at,ends_at,active,offline_payment_reference,offline_amount_paise,internal_note,created_by
    ) values (
      v_code,nullif(btrim(coalesce(p_description,'')),''),p_discount_percent,p_purpose,p_product_id,v_email,p_organization_id,v_seat_count,
      p_usage_limit,p_per_user_limit,p_starts_at,p_ends_at,p_active,v_reference,p_offline_amount_paise,
      nullif(btrim(coalesce(p_internal_note,'')),''),v_user
    ) returning id into v_id;
  else
    update public.voucher_codes set
      code=v_code,description=nullif(btrim(coalesce(p_description,'')),''),discount_percent=p_discount_percent,purpose=p_purpose,
      product_id=p_product_id,allowed_email=v_email,organization_id=p_organization_id,seat_count=v_seat_count,
      usage_limit=p_usage_limit,per_user_limit=p_per_user_limit,starts_at=p_starts_at,ends_at=p_ends_at,active=p_active,
      offline_payment_reference=v_reference,offline_amount_paise=p_offline_amount_paise,
      internal_note=nullif(btrim(coalesce(p_internal_note,'')),'')
    where id=p_voucher_id returning id into v_id;
    if v_id is null then raise exception 'Voucher not found.'; end if;
  end if;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_user,case when p_voucher_id is null then 'voucher.v14.created' else 'voucher.v14.updated' end,'voucher',v_id::text,
    jsonb_build_object('code',v_code,'discount_percent',p_discount_percent,'purpose',p_purpose,'product_id',p_product_id,
      'organization_id',p_organization_id,'seat_count',v_seat_count,'offline_reference',v_reference,'offline_amount_paise',p_offline_amount_paise));
  return v_id;
end;
$function$;

create or replace function public.fulfill_voucher_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_order public.orders%rowtype;
  v_version public.product_versions%rowtype;
  v_voucher public.voucher_codes%rowtype;
  v_entitlement uuid;
  v_expiry timestamptz;
  v_seat_limit integer;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  if v_order.status='paid' then select id into v_entitlement from public.entitlements where order_id=v_order.id limit 1; return v_entitlement; end if;
  if v_order.voucher_id is null or v_order.amount_paise<>0 then raise exception 'Order is not eligible for voucher fulfilment.'; end if;

  select * into v_voucher from public.voucher_codes where id=v_order.voucher_id for update;
  if not found or v_voucher.discount_percent<>100 then raise exception 'A valid 100%% voucher is required.'; end if;
  if not v_voucher.active then raise exception 'Voucher is inactive.'; end if;
  if v_voucher.starts_at is not null and v_voucher.starts_at>now() then raise exception 'Voucher is not active yet.'; end if;
  if v_voucher.ends_at is not null and v_voucher.ends_at<now() then raise exception 'Voucher has expired.'; end if;

  select * into v_version from public.product_versions where id=v_order.product_version_id;
  if not found then raise exception 'Product version not found.'; end if;
  if v_version.access_days is not null then v_expiry:=now()+make_interval(days=>v_version.access_days); end if;

  if v_order.organization_id is not null then
    if v_voucher.purpose='offline_payment' then
      v_seat_limit:=coalesce(v_voucher.seat_count,v_version.student_limit);
      if coalesce(v_seat_limit,0)<=0 then raise exception 'The school activation does not contain a seat allocation.'; end if;
    else
      v_seat_limit:=v_version.student_limit;
    end if;
    update public.orders set status='paid',paid_at=coalesce(paid_at,now()),failure_reason=null,
      commerce_metadata=coalesce(commerce_metadata,'{}'::jsonb)||jsonb_build_object('seat_count',v_seat_limit,'complimentary',v_voucher.purpose<>'offline_payment')
    where id=v_order.id;
    insert into public.entitlements(organization_id,product_id,product_version_id,source,status,starts_at,expires_at,attempts_limit,seat_limit,order_id,commerce_metadata)
    values(v_order.organization_id,v_order.product_id,v_order.product_version_id,
      case when v_voucher.purpose='offline_payment' then 'offline_voucher' else 'voucher' end,
      'active',now(),v_expiry,v_version.max_attempts,v_seat_limit,v_order.id,
      jsonb_build_object('payment_source',case when v_voucher.purpose='offline_payment' then 'offline_voucher' else 'voucher' end,'voucher_id',v_voucher.id,'offline_reference',v_order.offline_reference))
    on conflict(organization_id,product_id) where organization_id is not null
    do update set product_version_id=excluded.product_version_id,source=excluded.source,status='active',starts_at=now(),expires_at=excluded.expires_at,
      attempts_limit=excluded.attempts_limit,seat_limit=excluded.seat_limit,order_id=excluded.order_id,commerce_metadata=excluded.commerce_metadata,updated_at=now()
    returning id into v_entitlement;
  else
    if v_voucher.purpose='offline_payment' then raise exception 'Offline-payment vouchers require a school purchase.'; end if;
    update public.orders set status='paid',paid_at=coalesce(paid_at,now()),failure_reason=null where id=v_order.id;
    insert into public.entitlements(user_id,product_id,product_version_id,source,status,starts_at,expires_at,attempts_limit,seat_limit,order_id,commerce_metadata)
    values(v_order.user_id,v_order.product_id,v_order.product_version_id,'voucher','active',now(),v_expiry,v_version.max_attempts,null,v_order.id,
      jsonb_build_object('payment_source','voucher','voucher_id',v_voucher.id,'complimentary',true))
    on conflict(user_id,product_id) where organization_id is null
    do update set product_version_id=excluded.product_version_id,source=excluded.source,status='active',starts_at=now(),expires_at=excluded.expires_at,
      attempts_limit=excluded.attempts_limit,seat_limit=null,order_id=excluded.order_id,commerce_metadata=excluded.commerce_metadata,updated_at=now()
    returning id into v_entitlement;
  end if;
  return v_entitlement;
end;
$function$;
