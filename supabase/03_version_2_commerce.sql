-- ScholarOS - Version 2 commerce, products, payments and access
-- Run AFTER 01_version_1_schema.sql.

create extension if not exists pgcrypto;

do $$ begin
  create type public.product_status as enum ('draft','published','archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_type as enum ('single_exam','test_series','subject_package','chapter_package','entrance_exam','student_subscription','school_subscription','question_bank_addon','bundle');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.product_audience as enum ('student','school','both');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum ('created','payment_pending','paid','failed','cancelled','refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum ('created','authorized','captured','failed','refunded');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.entitlement_status as enum ('active','expired','revoked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.discount_type as enum ('percentage','fixed');
exception when duplicate_object then null;
end $$;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  product_type public.product_type not null,
  audience public.product_audience not null default 'student',
  exam_type text,
  cover_image_url text,
  status public.product_status not null default 'draft',
  is_featured boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_versions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  version_number integer not null,
  mrp_paise integer not null check (mrp_paise >= 0),
  selling_price_paise integer not null check (selling_price_paise >= 0 and selling_price_paise <= mrp_paise),
  access_days integer check (access_days is null or access_days > 0),
  max_attempts integer check (max_attempts is null or max_attempts > 0),
  student_limit integer check (student_limit is null or student_limit > 0),
  features jsonb not null default '[]'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  is_current boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(product_id, version_number)
);

create unique index if not exists one_current_version_per_product
on public.product_versions(product_id) where is_current = true;

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_type public.discount_type not null,
  discount_value integer not null check (discount_value > 0),
  max_discount_paise integer check (max_discount_paise is null or max_discount_paise > 0),
  minimum_order_paise integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer,
  per_user_limit integer not null default 1,
  used_count integer not null default 0,
  active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  organization_id uuid references public.organizations(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  product_version_id uuid not null references public.product_versions(id) on delete restrict,
  coupon_id uuid references public.coupons(id) on delete set null,
  subtotal_paise integer not null check (subtotal_paise >= 0),
  discount_paise integer not null default 0 check (discount_paise >= 0),
  amount_paise integer not null check (amount_paise >= 0),
  currency text not null default 'INR',
  status public.order_status not null default 'created',
  receipt text not null unique,
  razorpay_order_id text unique,
  failure_reason text,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  razorpay_payment_id text not null unique,
  razorpay_signature text,
  status public.payment_status not null default 'created',
  amount_paise integer not null,
  method text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_version_id uuid not null references public.product_versions(id) on delete restrict,
  source text not null default 'purchase',
  status public.entitlement_status not null default 'active',
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  attempts_limit integer,
  attempts_used integer not null default 0,
  granted_by uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((user_id is not null) <> (organization_id is not null))
);

create unique index if not exists entitlement_user_product_unique
on public.entitlements(user_id, product_id) where organization_id is null;
create unique index if not exists entitlement_org_product_unique
on public.entitlements(organization_id, product_id) where organization_id is not null;

create table if not exists public.webhook_events (
  id bigint generated by default as identity primary key,
  provider text not null,
  provider_event_id text,
  event_type text not null,
  signature text,
  payload jsonb not null,
  processed boolean not null default false,
  processing_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create unique index if not exists webhook_provider_event_unique
on public.webhook_events(provider, provider_event_id) where provider_event_id is not null;

-- Updated-at triggers

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
for each row execute function public.set_updated_at();
drop trigger if exists coupons_set_updated_at on public.coupons;
create trigger coupons_set_updated_at before update on public.coupons
for each row execute function public.set_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_updated_at();
drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_updated_at();
drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at before update on public.entitlements
for each row execute function public.set_updated_at();

create or replace function public.get_store_products()
returns table (
  id uuid,
  name text,
  slug text,
  short_description text,
  description text,
  product_type public.product_type,
  audience public.product_audience,
  exam_type text,
  cover_image_url text,
  is_featured boolean,
  version_id uuid,
  mrp_paise integer,
  selling_price_paise integer,
  access_days integer,
  max_attempts integer,
  student_limit integer,
  features jsonb,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select p.id, p.name, p.slug, p.short_description, p.description,
         p.product_type, p.audience, p.exam_type, p.cover_image_url,
         p.is_featured, pv.id, pv.mrp_paise, pv.selling_price_paise,
         pv.access_days, pv.max_attempts, pv.student_limit, pv.features,
         pv.starts_at, pv.ends_at
  from public.products p
  join public.product_versions pv on pv.product_id = p.id and pv.is_current = true
  where p.status = 'published'
    and (pv.starts_at is null or pv.starts_at <= now())
    and (pv.ends_at is null or pv.ends_at >= now())
  order by p.is_featured desc, p.created_at desc;
$$;

grant execute on function public.get_store_products() to anon, authenticated;

create or replace function public.admin_upsert_product(
  p_product_id uuid,
  p_name text,
  p_slug text,
  p_short_description text,
  p_description text,
  p_product_type public.product_type,
  p_audience public.product_audience,
  p_exam_type text,
  p_mrp_paise integer,
  p_selling_price_paise integer,
  p_access_days integer,
  p_max_attempts integer,
  p_student_limit integer,
  p_features jsonb,
  p_status public.product_status,
  p_is_featured boolean
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_product uuid;
  v_next_version integer;
begin
  if not public.is_super_admin() then
    raise exception 'Super-admin access required.';
  end if;
  if length(trim(p_name)) < 3 then raise exception 'Product name is too short.'; end if;
  if p_mrp_paise < 0 or p_selling_price_paise < 0 or p_selling_price_paise > p_mrp_paise then
    raise exception 'Invalid product pricing.';
  end if;

  if p_product_id is null then
    insert into public.products(name,slug,short_description,description,product_type,audience,exam_type,status,is_featured,created_by)
    values(trim(p_name),lower(trim(p_slug)),p_short_description,p_description,p_product_type,p_audience,nullif(trim(p_exam_type),''),p_status,p_is_featured,v_user)
    returning id into v_product;
    v_next_version := 1;
  else
    if not exists(select 1 from public.products where id=p_product_id) then raise exception 'Product not found.'; end if;
    update public.products set name=trim(p_name),slug=lower(trim(p_slug)),short_description=p_short_description,
      description=p_description,product_type=p_product_type,audience=p_audience,exam_type=nullif(trim(p_exam_type),''),
      status=p_status,is_featured=p_is_featured where id=p_product_id;
    v_product := p_product_id;
    select coalesce(max(version_number),0)+1 into v_next_version from public.product_versions where product_id=v_product;
    update public.product_versions set is_current=false where product_id=v_product and is_current=true;
  end if;

  insert into public.product_versions(product_id,version_number,mrp_paise,selling_price_paise,access_days,max_attempts,student_limit,features,is_current,created_by)
  values(v_product,v_next_version,p_mrp_paise,p_selling_price_paise,p_access_days,p_max_attempts,p_student_limit,coalesce(p_features,'[]'::jsonb),true,v_user);

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_user,case when p_product_id is null then 'product.created' else 'product.updated' end,'product',v_product::text,
    jsonb_build_object('version',v_next_version,'price',p_selling_price_paise));
  return v_product;
end;
$$;

grant execute on function public.admin_upsert_product(uuid,text,text,text,text,public.product_type,public.product_audience,text,integer,integer,integer,integer,integer,jsonb,public.product_status,boolean) to authenticated;

create or replace function public.fulfill_paid_order(
  p_order_id uuid,
  p_payment_id text,
  p_signature text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_version public.product_versions%rowtype;
  v_entitlement uuid;
  v_expiry timestamptz;
  v_was_paid boolean := false;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  v_was_paid := v_order.status = 'paid';
  select * into v_version from public.product_versions where id=v_order.product_version_id;
  if v_version.access_days is not null then v_expiry := now() + make_interval(days => v_version.access_days); end if;

  update public.orders set status='paid',paid_at=coalesce(paid_at,now()),failure_reason=null where id=v_order.id;
  insert into public.payments(order_id,razorpay_payment_id,razorpay_signature,status,amount_paise,raw_payload)
  values(v_order.id,p_payment_id,p_signature,'captured',v_order.amount_paise,coalesce(p_payload,'{}'::jsonb))
  on conflict(razorpay_payment_id) do update set status='captured',razorpay_signature=coalesce(public.payments.razorpay_signature,excluded.razorpay_signature),raw_payload=excluded.raw_payload,updated_at=now();

  if v_order.organization_id is not null then
    insert into public.entitlements(organization_id,product_id,product_version_id,source,status,starts_at,expires_at,attempts_limit,order_id)
    values(v_order.organization_id,v_order.product_id,v_order.product_version_id,'purchase','active',now(),v_expiry,v_version.max_attempts,v_order.id)
    on conflict(organization_id,product_id) where organization_id is not null
    do update set product_version_id=excluded.product_version_id,status='active',starts_at=now(),expires_at=excluded.expires_at,
      attempts_limit=excluded.attempts_limit,order_id=excluded.order_id,updated_at=now()
    returning id into v_entitlement;
  else
    insert into public.entitlements(user_id,product_id,product_version_id,source,status,starts_at,expires_at,attempts_limit,order_id)
    values(v_order.user_id,v_order.product_id,v_order.product_version_id,'purchase','active',now(),v_expiry,v_version.max_attempts,v_order.id)
    on conflict(user_id,product_id) where organization_id is null
    do update set product_version_id=excluded.product_version_id,status='active',starts_at=now(),expires_at=excluded.expires_at,
      attempts_limit=excluded.attempts_limit,order_id=excluded.order_id,updated_at=now()
    returning id into v_entitlement;
  end if;

  if v_order.coupon_id is not null and not v_was_paid then
    update public.coupons set used_count=used_count+1 where id=v_order.coupon_id;
  end if;
  return v_entitlement;
end;
$$;

revoke all on function public.fulfill_paid_order(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.fulfill_paid_order(uuid,text,text,jsonb) to service_role;

alter table public.products enable row level security;
alter table public.product_versions enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;
alter table public.entitlements enable row level security;
alter table public.webhook_events enable row level security;

create policy products_admin_all on public.products for all to authenticated
using(public.is_super_admin()) with check(public.is_super_admin());
create policy product_versions_admin_all on public.product_versions for all to authenticated
using(public.is_super_admin()) with check(public.is_super_admin());
create policy coupons_admin_all on public.coupons for all to authenticated
using(public.is_super_admin()) with check(public.is_super_admin());
create policy orders_select_own_or_admin on public.orders for select to authenticated
using(user_id=auth.uid() or public.is_super_admin());
create policy payments_select_own_or_admin on public.payments for select to authenticated
using(public.is_super_admin() or exists(select 1 from public.orders o where o.id=payments.order_id and o.user_id=auth.uid()));
create policy entitlements_select_owner_member_or_admin on public.entitlements for select to authenticated
using(
  public.is_super_admin() or user_id=auth.uid() or
  (organization_id is not null and public.is_org_member(organization_id))
);
create policy webhook_admin_select on public.webhook_events for select to authenticated
using(public.is_super_admin());
