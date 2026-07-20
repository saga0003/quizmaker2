-- Evidara V6.7.1 — percentage vouchers, offline-payment records and zero-value fulfilment
-- Run AFTER supabase/23_achievement_benchmark_validity_hardening.sql.

create extension if not exists pgcrypto;

do $$ begin
  create type public.voucher_purpose as enum (
    'promotion',
    'offline_payment',
    'scholarship',
    'manual_access'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.voucher_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_percent integer not null check (discount_percent between 1 and 100),
  purpose public.voucher_purpose not null default 'promotion',
  product_id uuid references public.products(id) on delete cascade,
  allowed_email text,
  organization_id uuid references public.organizations(id) on delete cascade,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  offline_payment_reference text,
  offline_amount_paise integer check (offline_amount_paise is null or offline_amount_paise >= 0),
  internal_note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (code = upper(code)),
  check (code ~ '^[A-Z0-9_-]{4,32}$'),
  check (ends_at is null or starts_at is null or ends_at > starts_at),
  check (discount_percent < 100 or allowed_email is not null or organization_id is not null),
  check (
    purpose <> 'offline_payment' or
    (offline_payment_reference is not null and length(trim(offline_payment_reference)) > 0 and coalesce(offline_amount_paise, 0) > 0)
  )
);

alter table public.orders
  add column if not exists voucher_id uuid references public.voucher_codes(id) on delete set null,
  add column if not exists payment_source text not null default 'razorpay',
  add column if not exists offline_reference text,
  add column if not exists commerce_metadata jsonb not null default '{}'::jsonb;

do $$ begin
  alter table public.orders
    add constraint orders_payment_source_check
    check (payment_source in ('razorpay', 'voucher', 'offline_voucher'));
exception when duplicate_object then null;
end $$;

create index if not exists orders_voucher_id_idx on public.orders(voucher_id);
create index if not exists orders_user_voucher_idx on public.orders(user_id, voucher_id);

create table if not exists public.voucher_redemptions (
  id uuid primary key default gen_random_uuid(),
  voucher_id uuid not null references public.voucher_codes(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  discount_paise integer not null check (discount_paise >= 0),
  payment_source text not null,
  offline_reference text,
  created_at timestamptz not null default now()
);

create index if not exists voucher_redemptions_voucher_idx on public.voucher_redemptions(voucher_id, created_at desc);
create index if not exists voucher_redemptions_user_idx on public.voucher_redemptions(user_id, created_at desc);

drop trigger if exists voucher_codes_set_updated_at on public.voucher_codes;
create trigger voucher_codes_set_updated_at
before update on public.voucher_codes
for each row execute function public.set_updated_at();

create or replace function public.validate_voucher_order()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_voucher public.voucher_codes%rowtype;
  v_email text;
  v_expected_discount integer;
  v_reserved integer;
  v_user_reserved integer;
  v_current_order uuid;
begin
  if new.voucher_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    v_current_order := old.id;
  end if;

  select * into v_voucher
  from public.voucher_codes
  where id = new.voucher_id
  for update;

  if not found then raise exception 'Voucher not found.'; end if;
  if not v_voucher.active then raise exception 'Voucher is inactive.'; end if;
  if v_voucher.starts_at is not null and v_voucher.starts_at > now() then raise exception 'Voucher is not active yet.'; end if;
  if v_voucher.ends_at is not null and v_voucher.ends_at < now() then raise exception 'Voucher has expired.'; end if;
  if v_voucher.product_id is not null and v_voucher.product_id <> new.product_id then raise exception 'Voucher does not apply to this product.'; end if;
  if v_voucher.organization_id is not null and v_voucher.organization_id is distinct from new.organization_id then raise exception 'Voucher is assigned to a different school.'; end if;

  select lower(email) into v_email from auth.users where id = new.user_id;
  if v_voucher.allowed_email is not null and lower(v_voucher.allowed_email) is distinct from v_email then
    raise exception 'Voucher is assigned to a different account.';
  end if;

  v_expected_discount := least(
    new.subtotal_paise,
    floor(new.subtotal_paise * v_voucher.discount_percent / 100.0)::integer
  );

  if new.discount_paise <> v_expected_discount then raise exception 'Voucher discount does not match the approved percentage.'; end if;
  if new.amount_paise <> new.subtotal_paise - new.discount_paise then raise exception 'Order total is invalid.'; end if;

  select count(*) into v_reserved
  from public.orders o
  where o.voucher_id = v_voucher.id
    and (v_current_order is null or o.id <> v_current_order)
    and (
      o.status = 'paid' or
      (o.status in ('created', 'payment_pending') and o.created_at >= now() - interval '30 minutes')
    );

  if v_voucher.usage_limit is not null and v_reserved >= v_voucher.usage_limit then
    raise exception 'Voucher usage limit has been reached.';
  end if;

  select count(*) into v_user_reserved
  from public.orders o
  where o.voucher_id = v_voucher.id
    and o.user_id = new.user_id
    and (v_current_order is null or o.id <> v_current_order)
    and (
      o.status = 'paid' or
      (o.status in ('created', 'payment_pending') and o.created_at >= now() - interval '30 minutes')
    );

  if v_user_reserved >= v_voucher.per_user_limit then
    raise exception 'This account has already used or reserved the voucher.';
  end if;

  new.payment_source := case
    when new.amount_paise = 0 and v_voucher.purpose = 'offline_payment' then 'offline_voucher'
    when new.amount_paise = 0 then 'voucher'
    else 'razorpay'
  end;
  new.offline_reference := case when v_voucher.purpose = 'offline_payment' then v_voucher.offline_payment_reference else null end;
  new.commerce_metadata := coalesce(new.commerce_metadata, '{}'::jsonb) || jsonb_build_object(
    'voucher_code', v_voucher.code,
    'voucher_percent', v_voucher.discount_percent,
    'voucher_purpose', v_voucher.purpose
  );

  return new;
end;
$$;

drop trigger if exists orders_validate_voucher on public.orders;
create trigger orders_validate_voucher
before insert or update of voucher_id, product_id, user_id, organization_id, subtotal_paise, discount_paise, amount_paise
on public.orders
for each row execute function public.validate_voucher_order();

create or replace function public.record_voucher_redemption()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_redemption uuid;
  v_code text;
begin
  if new.status <> 'paid' or old.status = 'paid' or new.voucher_id is null then
    return new;
  end if;

  insert into public.voucher_redemptions(
    voucher_id, order_id, user_id, organization_id, discount_paise, payment_source, offline_reference
  ) values (
    new.voucher_id, new.id, new.user_id, new.organization_id, new.discount_paise, new.payment_source, new.offline_reference
  )
  on conflict(order_id) do nothing
  returning id into v_redemption;

  if v_redemption is not null then
    update public.voucher_codes set used_count = used_count + 1 where id = new.voucher_id returning code into v_code;
    insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
    values(
      new.user_id,
      new.organization_id,
      'voucher.redeemed',
      'order',
      new.id::text,
      jsonb_build_object(
        'voucher_code', v_code,
        'discount_paise', new.discount_paise,
        'payment_source', new.payment_source,
        'offline_reference', new.offline_reference
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists orders_record_voucher_redemption on public.orders;
create trigger orders_record_voucher_redemption
after update of status on public.orders
for each row execute function public.record_voucher_redemption();

create or replace function public.admin_upsert_voucher(
  p_voucher_id uuid,
  p_code text,
  p_description text,
  p_discount_percent integer,
  p_purpose public.voucher_purpose,
  p_product_id uuid,
  p_allowed_email text,
  p_organization_id uuid,
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
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_code text := upper(trim(p_code));
  v_email text := nullif(lower(trim(coalesce(p_allowed_email, ''))), '');
  v_offline_reference text := nullif(trim(coalesce(p_offline_payment_reference, '')), '');
begin
  if not public.is_super_admin() then raise exception 'Super-admin access required.'; end if;
  if v_code !~ '^[A-Z0-9_-]{4,32}$' then raise exception 'Voucher code must contain 4–32 letters, numbers, hyphens or underscores.'; end if;
  if p_discount_percent < 1 or p_discount_percent > 100 then raise exception 'Discount must be between 1%% and 100%%.'; end if;
  if p_usage_limit is not null and p_usage_limit < 1 then raise exception 'Usage limit must be positive.'; end if;
  if coalesce(p_per_user_limit, 0) < 1 then raise exception 'Per-user limit must be positive.'; end if;
  if p_usage_limit is not null and p_per_user_limit > p_usage_limit then raise exception 'Per-user limit cannot exceed total usage limit.'; end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'Voucher end time must be after its start time.'; end if;
  if p_discount_percent = 100 and v_email is null and p_organization_id is null then raise exception 'A 100%% voucher must be assigned to an email address or school.'; end if;
  if p_purpose = 'offline_payment' and (v_offline_reference is null or coalesce(p_offline_amount_paise, 0) <= 0) then
    raise exception 'Offline-payment vouchers require a payment reference and amount.';
  end if;

  if p_voucher_id is null then
    insert into public.voucher_codes(
      code, description, discount_percent, purpose, product_id, allowed_email, organization_id,
      usage_limit, per_user_limit, starts_at, ends_at, active, offline_payment_reference,
      offline_amount_paise, internal_note, created_by
    ) values (
      v_code, nullif(trim(coalesce(p_description, '')), ''), p_discount_percent, p_purpose,
      p_product_id, v_email, p_organization_id, p_usage_limit, p_per_user_limit,
      p_starts_at, p_ends_at, p_active, v_offline_reference, p_offline_amount_paise,
      nullif(trim(coalesce(p_internal_note, '')), ''), v_user
    ) returning id into v_id;
  else
    update public.voucher_codes set
      code = v_code,
      description = nullif(trim(coalesce(p_description, '')), ''),
      discount_percent = p_discount_percent,
      purpose = p_purpose,
      product_id = p_product_id,
      allowed_email = v_email,
      organization_id = p_organization_id,
      usage_limit = p_usage_limit,
      per_user_limit = p_per_user_limit,
      starts_at = p_starts_at,
      ends_at = p_ends_at,
      active = p_active,
      offline_payment_reference = v_offline_reference,
      offline_amount_paise = p_offline_amount_paise,
      internal_note = nullif(trim(coalesce(p_internal_note, '')), '')
    where id = p_voucher_id
    returning id into v_id;

    if v_id is null then raise exception 'Voucher not found.'; end if;
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    v_user,
    case when p_voucher_id is null then 'voucher.created' else 'voucher.updated' end,
    'voucher',
    v_id::text,
    jsonb_build_object(
      'code', v_code,
      'discount_percent', p_discount_percent,
      'purpose', p_purpose,
      'product_id', p_product_id,
      'allowed_email', v_email,
      'organization_id', p_organization_id,
      'usage_limit', p_usage_limit,
      'active', p_active,
      'offline_payment_reference', v_offline_reference,
      'offline_amount_paise', p_offline_amount_paise
    )
  );

  return v_id;
end;
$$;

create or replace function public.fulfill_voucher_order(p_order_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_version public.product_versions%rowtype;
  v_voucher public.voucher_codes%rowtype;
  v_entitlement uuid;
  v_expiry timestamptz;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;

  if v_order.status = 'paid' then
    select id into v_entitlement from public.entitlements where order_id = v_order.id limit 1;
    return v_entitlement;
  end if;

  if v_order.voucher_id is null or v_order.amount_paise <> 0 then raise exception 'Order is not eligible for voucher fulfilment.'; end if;
  select * into v_voucher from public.voucher_codes where id = v_order.voucher_id for update;
  if not found or v_voucher.discount_percent <> 100 then raise exception 'A valid 100%% voucher is required.'; end if;
  if not v_voucher.active then raise exception 'Voucher is inactive.'; end if;
  if v_voucher.starts_at is not null and v_voucher.starts_at > now() then raise exception 'Voucher is not active yet.'; end if;
  if v_voucher.ends_at is not null and v_voucher.ends_at < now() then raise exception 'Voucher has expired.'; end if;

  select * into v_version from public.product_versions where id = v_order.product_version_id;
  if not found then raise exception 'Product version not found.'; end if;
  if v_version.access_days is not null then v_expiry := now() + make_interval(days => v_version.access_days); end if;

  update public.orders
  set status = 'paid', paid_at = coalesce(paid_at, now()), failure_reason = null
  where id = v_order.id;

  if v_order.organization_id is not null then
    insert into public.entitlements(organization_id, product_id, product_version_id, source, status, starts_at, expires_at, attempts_limit, order_id)
    values(v_order.organization_id, v_order.product_id, v_order.product_version_id, 'voucher', 'active', now(), v_expiry, v_version.max_attempts, v_order.id)
    on conflict(organization_id, product_id) where organization_id is not null
    do update set product_version_id = excluded.product_version_id, source = excluded.source, status = 'active', starts_at = now(),
      expires_at = excluded.expires_at, attempts_limit = excluded.attempts_limit, order_id = excluded.order_id, updated_at = now()
    returning id into v_entitlement;
  else
    insert into public.entitlements(user_id, product_id, product_version_id, source, status, starts_at, expires_at, attempts_limit, order_id)
    values(v_order.user_id, v_order.product_id, v_order.product_version_id, 'voucher', 'active', now(), v_expiry, v_version.max_attempts, v_order.id)
    on conflict(user_id, product_id) where organization_id is null
    do update set product_version_id = excluded.product_version_id, source = excluded.source, status = 'active', starts_at = now(),
      expires_at = excluded.expires_at, attempts_limit = excluded.attempts_limit, order_id = excluded.order_id, updated_at = now()
    returning id into v_entitlement;
  end if;

  return v_entitlement;
end;
$$;

revoke all on function public.fulfill_voucher_order(uuid) from public, anon, authenticated;
grant execute on function public.fulfill_voucher_order(uuid) to service_role;
grant execute on function public.admin_upsert_voucher(uuid,text,text,integer,public.voucher_purpose,uuid,text,uuid,integer,integer,timestamptz,timestamptz,boolean,text,integer,text) to authenticated;

alter table public.voucher_codes enable row level security;
alter table public.voucher_redemptions enable row level security;

drop policy if exists voucher_codes_super_admin_all on public.voucher_codes;
create policy voucher_codes_super_admin_all on public.voucher_codes
for all to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists voucher_redemptions_super_admin_select on public.voucher_redemptions;
create policy voucher_redemptions_super_admin_select on public.voucher_redemptions
for select to authenticated
using (public.is_super_admin());

grant select on public.voucher_codes, public.voucher_redemptions to authenticated;

comment on table public.voucher_codes is 'Super-Admin-created percentage vouchers. 100% vouchers must be account- or school-bound.';
comment on table public.voucher_redemptions is 'Immutable redemption evidence for Razorpay discounts and zero-value offline/manual access.';
comment on function public.fulfill_voucher_order(uuid) is 'Service-role-only zero-value order fulfilment after all voucher constraints are validated.';
