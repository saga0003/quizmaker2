-- Evidara V9 — paper-series products, vouchers, school seats and commerce analytics
-- Run after migrations 32 and 33.

begin;

alter table public.products
  add column if not exists gallery_image_urls text[] not null default '{}',
  add column if not exists image_alt_text text,
  add column if not exists grade_levels text[] not null default '{}',
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists commerce_settings jsonb not null default '{}'::jsonb;

alter table public.entitlements
  add column if not exists seat_limit integer check (seat_limit is null or seat_limit > 0),
  add column if not exists commerce_metadata jsonb not null default '{}'::jsonb;

alter table public.voucher_codes
  add column if not exists seat_count integer check (seat_count is null or seat_count > 0);

create table if not exists public.product_papers (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  paper_id uuid not null references public.question_papers(id) on delete restrict,
  display_name text not null,
  display_order integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(product_id, paper_id)
);

create index if not exists product_papers_product_order_idx
  on public.product_papers(product_id, display_order, created_at);
create index if not exists product_papers_paper_idx
  on public.product_papers(paper_id);

create table if not exists public.product_seat_assignments (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.entitlements(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'active' check (status in ('active','released')),
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  released_by uuid references public.profiles(id) on delete set null,
  released_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  unique(entitlement_id, student_id)
);

create index if not exists product_seat_assignments_org_status_idx
  on public.product_seat_assignments(organization_id, status, assigned_at desc);
create index if not exists product_seat_assignments_student_idx
  on public.product_seat_assignments(student_id, status);

alter table public.product_papers enable row level security;
alter table public.product_seat_assignments enable row level security;

-- Commerce metadata is read by platform administrators and changed through audited RPCs.
drop policy if exists products_admin_all on public.products;
drop policy if exists products_platform_admin_select_v9 on public.products;
create policy products_platform_admin_select_v9 on public.products
for select to authenticated
using (public.is_evidara_platform_admin() or status='published');

drop policy if exists product_versions_admin_all on public.product_versions;
drop policy if exists product_versions_platform_admin_select_v9 on public.product_versions;
create policy product_versions_platform_admin_select_v9 on public.product_versions
for select to authenticated
using (public.is_evidara_platform_admin());

drop policy if exists product_papers_platform_admin_select_v9 on public.product_papers;
create policy product_papers_platform_admin_select_v9 on public.product_papers
for select to authenticated
using (public.is_evidara_platform_admin());

drop policy if exists voucher_codes_super_admin_all on public.voucher_codes;
drop policy if exists voucher_codes_platform_admin_select_v9 on public.voucher_codes;
create policy voucher_codes_platform_admin_select_v9 on public.voucher_codes
for select to authenticated
using (public.is_evidara_platform_admin());

drop policy if exists voucher_redemptions_super_admin_select on public.voucher_redemptions;
drop policy if exists voucher_redemptions_platform_admin_select_v9 on public.voucher_redemptions;
create policy voucher_redemptions_platform_admin_select_v9 on public.voucher_redemptions
for select to authenticated
using (public.is_evidara_platform_admin());

drop policy if exists orders_select_own_or_admin on public.orders;
create policy orders_select_own_or_admin on public.orders
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_evidara_platform_admin()
  or (organization_id is not null and public.is_org_member(organization_id))
);

drop policy if exists payments_select_own_or_admin on public.payments;
create policy payments_select_own_or_admin on public.payments
for select to authenticated
using (
  public.is_evidara_platform_admin()
  or exists(select 1 from public.orders o where o.id=payments.order_id and (o.user_id=auth.uid() or (o.organization_id is not null and public.is_org_member(o.organization_id))))
);

drop policy if exists entitlements_select_owner_member_or_admin on public.entitlements;
create policy entitlements_select_owner_member_or_admin on public.entitlements
for select to authenticated
using (
  public.is_evidara_platform_admin()
  or user_id=auth.uid()
  or (organization_id is not null and public.is_org_member(organization_id))
);

drop policy if exists product_seats_read_v9 on public.product_seat_assignments;
create policy product_seats_read_v9 on public.product_seat_assignments
for select to authenticated
using (
  public.is_evidara_platform_admin()
  or student_id=auth.uid()
  or public.is_org_member(organization_id)
);

revoke insert, update, delete on public.products, public.product_versions, public.product_papers, public.voucher_codes from authenticated;
grant select on public.products, public.product_versions, public.product_papers, public.voucher_codes, public.voucher_redemptions, public.product_seat_assignments to authenticated;

create or replace function public.admin_upsert_product_v9(
  p_product_id uuid,
  p_name text,
  p_slug text,
  p_short_description text,
  p_description text,
  p_product_type public.product_type,
  p_audience public.product_audience,
  p_exam_type text,
  p_grade_levels text[],
  p_cover_image_url text,
  p_gallery_image_urls text[],
  p_image_alt_text text,
  p_mrp_paise integer,
  p_selling_price_paise integer,
  p_access_days integer,
  p_max_attempts integer,
  p_student_limit integer,
  p_features jsonb,
  p_status public.product_status,
  p_is_featured boolean,
  p_papers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_product uuid;
  v_next_version integer;
  v_item jsonb;
  v_paper uuid;
  v_paper_title text;
  v_paper_status text;
  v_paper_org uuid;
  v_image text;
  v_order integer := 0;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  if not public.is_evidara_platform_admin() then
    raise exception 'Evidara Admin or Super Admin access required.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_name,''))) < 3 then raise exception 'Product name is too short.'; end if;
  if btrim(coalesce(p_slug,'')) !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then raise exception 'Use a lowercase URL slug with hyphens only.'; end if;
  if p_mrp_paise < 0 or p_selling_price_paise < 0 or p_selling_price_paise > p_mrp_paise then raise exception 'Invalid product pricing.'; end if;
  if p_cover_image_url is not null and btrim(p_cover_image_url) <> '' and btrim(p_cover_image_url) !~* '^https://' then
    raise exception 'The cover image must be an HTTPS link.';
  end if;
  if coalesce(array_length(p_gallery_image_urls,1),0) > 8 then raise exception 'Add no more than eight gallery images.'; end if;
  foreach v_image in array coalesce(p_gallery_image_urls,'{}'::text[]) loop
    if btrim(v_image) !~* '^https://' then raise exception 'Every gallery image must be an HTTPS link.'; end if;
  end loop;
  if jsonb_typeof(coalesce(p_papers,'[]'::jsonb)) <> 'array' then raise exception 'Product papers must be an array.'; end if;

  if p_product_id is null then
    insert into public.products(
      name,slug,short_description,description,product_type,audience,exam_type,grade_levels,
      cover_image_url,gallery_image_urls,image_alt_text,status,is_featured,created_by,updated_by
    ) values (
      btrim(p_name),lower(btrim(p_slug)),nullif(btrim(coalesce(p_short_description,'')),''),
      nullif(btrim(coalesce(p_description,'')),''),p_product_type,p_audience,
      nullif(btrim(coalesce(p_exam_type,'')),''),coalesce(p_grade_levels,'{}'::text[]),
      nullif(btrim(coalesce(p_cover_image_url,'')),''),coalesce(p_gallery_image_urls,'{}'::text[]),
      nullif(btrim(coalesce(p_image_alt_text,'')),''),p_status,p_is_featured,v_user,v_user
    ) returning id into v_product;
    v_next_version := 1;
  else
    select id into v_product from public.products where id=p_product_id for update;
    if v_product is null then raise exception 'Product not found.'; end if;
    update public.products set
      name=btrim(p_name),slug=lower(btrim(p_slug)),
      short_description=nullif(btrim(coalesce(p_short_description,'')),''),
      description=nullif(btrim(coalesce(p_description,'')),''),
      product_type=p_product_type,audience=p_audience,
      exam_type=nullif(btrim(coalesce(p_exam_type,'')),''),
      grade_levels=coalesce(p_grade_levels,'{}'::text[]),
      cover_image_url=nullif(btrim(coalesce(p_cover_image_url,'')),''),
      gallery_image_urls=coalesce(p_gallery_image_urls,'{}'::text[]),
      image_alt_text=nullif(btrim(coalesce(p_image_alt_text,'')),''),
      status=p_status,is_featured=p_is_featured,updated_by=v_user,updated_at=now()
    where id=v_product;
    select coalesce(max(version_number),0)+1 into v_next_version from public.product_versions where product_id=v_product;
    update public.product_versions set is_current=false where product_id=v_product and is_current=true;
    delete from public.product_papers where product_id=v_product;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_papers,'[]'::jsonb)) loop
    v_paper := nullif(v_item->>'paper_id','')::uuid;
    if v_paper is null then raise exception 'Every product item needs a paper.'; end if;
    select title,status::text,organization_id into v_paper_title,v_paper_status,v_paper_org
    from public.question_papers where id=v_paper;
    if v_paper_title is null then raise exception 'A selected paper no longer exists.'; end if;
    if v_paper_org is not null then raise exception 'Only Evidara master papers can be sold as catalogue products.'; end if;
    if v_paper_status not in ('approved','published') then raise exception 'Only approved or published papers can be bundled.'; end if;
    if p_status='published' and v_paper_status <> 'published' then raise exception 'Publish every bundled paper before publishing the product.'; end if;
    insert into public.product_papers(product_id,paper_id,display_name,display_order,created_by)
    values(v_product,v_paper,coalesce(nullif(btrim(v_item->>'display_name'),''),v_paper_title),coalesce((v_item->>'display_order')::integer,v_order),v_user);
    v_order := v_order + 1;
  end loop;

  if p_status='published' and not exists(select 1 from public.product_papers where product_id=v_product) then
    raise exception 'A published paper-series product must contain at least one question paper.';
  end if;

  insert into public.product_versions(
    product_id,version_number,mrp_paise,selling_price_paise,access_days,max_attempts,student_limit,features,is_current,created_by
  ) values (
    v_product,v_next_version,p_mrp_paise,p_selling_price_paise,p_access_days,p_max_attempts,p_student_limit,
    coalesce(p_features,'[]'::jsonb),true,v_user
  );

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_user,case when p_product_id is null then 'product.v9.created' else 'product.v9.updated' end,'product',v_product::text,
    jsonb_build_object('version',v_next_version,'price_paise',p_selling_price_paise,'paper_count',(select count(*) from public.product_papers where product_id=v_product),'status',p_status));
  return v_product;
end;
$$;

grant execute on function public.admin_upsert_product_v9(uuid,text,text,text,text,public.product_type,public.product_audience,text,text[],text,text[],text,integer,integer,integer,integer,integer,jsonb,public.product_status,boolean,jsonb) to authenticated, service_role;

create or replace function public.admin_list_products_v9()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select case when public.is_evidara_platform_admin() then coalesce(jsonb_agg(product_row order by product_row->>'created_at' desc),'[]'::jsonb) else '[]'::jsonb end
  from (
    select jsonb_build_object(
      'id',p.id,'name',p.name,'slug',p.slug,'short_description',p.short_description,'description',p.description,
      'product_type',p.product_type,'audience',p.audience,'exam_type',p.exam_type,'grade_levels',p.grade_levels,
      'cover_image_url',p.cover_image_url,'gallery_image_urls',p.gallery_image_urls,'image_alt_text',p.image_alt_text,
      'status',p.status,'is_featured',p.is_featured,'created_at',p.created_at,'updated_at',p.updated_at,
      'current_version',(select jsonb_build_object(
        'id',pv.id,'version_number',pv.version_number,'mrp_paise',pv.mrp_paise,'selling_price_paise',pv.selling_price_paise,
        'access_days',pv.access_days,'max_attempts',pv.max_attempts,'student_limit',pv.student_limit,'features',pv.features,
        'starts_at',pv.starts_at,'ends_at',pv.ends_at
      ) from public.product_versions pv where pv.product_id=p.id and pv.is_current=true limit 1),
      'papers',coalesce((select jsonb_agg(jsonb_build_object(
        'id',pp.id,'paper_id',pp.paper_id,'display_name',pp.display_name,'display_order',pp.display_order,
        'title',qp.title,'code',qp.code,'exam_type',qp.exam_type,'grade_level',qp.grade_level,'test_type',qp.test_type,
        'duration_minutes',qp.duration_minutes,'total_questions',qp.total_questions,'total_marks',qp.total_marks,'status',qp.status
      ) order by pp.display_order,pp.created_at) from public.product_papers pp join public.question_papers qp on qp.id=pp.paper_id where pp.product_id=p.id),'[]'::jsonb),
      'paper_count',(select count(*) from public.product_papers pp where pp.product_id=p.id)
    ) as product_row
    from public.products p
  ) product_rows;
$$;

grant execute on function public.admin_list_products_v9() to authenticated, service_role;

create or replace function public.list_product_builder_papers_v9()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select case when public.is_evidara_platform_admin() then coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'title',p.title,'code',p.code,'description',p.description,'exam_type',p.exam_type,'grade_level',p.grade_level,
    'test_type',p.test_type,'custom_test_type',p.custom_test_type,'status',p.status,'duration_minutes',p.duration_minutes,
    'total_questions',p.total_questions,'total_marks',p.total_marks,'published_at',p.published_at
  ) order by p.published_at desc nulls last,p.created_at desc),'[]'::jsonb) else '[]'::jsonb end
  from public.question_papers p
  where p.organization_id is null and p.status in ('approved','published');
$$;

grant execute on function public.list_product_builder_papers_v9() to authenticated, service_role;

-- Public store output includes the compiled paper count and paper display names.
drop function if exists public.get_store_products();
create function public.get_store_products()
returns table (
  id uuid,
  name text,
  slug text,
  short_description text,
  description text,
  product_type public.product_type,
  audience public.product_audience,
  exam_type text,
  grade_levels text[],
  cover_image_url text,
  gallery_image_urls text[],
  image_alt_text text,
  is_featured boolean,
  version_id uuid,
  mrp_paise integer,
  selling_price_paise integer,
  access_days integer,
  max_attempts integer,
  student_limit integer,
  features jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  paper_count integer,
  papers jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id,p.name,p.slug,p.short_description,p.description,p.product_type,p.audience,p.exam_type,p.grade_levels,
         p.cover_image_url,p.gallery_image_urls,p.image_alt_text,p.is_featured,
         pv.id,pv.mrp_paise,pv.selling_price_paise,pv.access_days,pv.max_attempts,pv.student_limit,pv.features,pv.starts_at,pv.ends_at,
         (select count(*)::integer from public.product_papers pp where pp.product_id=p.id),
         coalesce((select jsonb_agg(jsonb_build_object(
           'paper_id',pp.paper_id,'name',pp.display_name,'display_order',pp.display_order,
           'exam_type',qp.exam_type,'grade_level',qp.grade_level,'test_type',qp.test_type,
           'duration_minutes',qp.duration_minutes,'total_questions',qp.total_questions,'total_marks',qp.total_marks
         ) order by pp.display_order,pp.created_at)
         from public.product_papers pp join public.question_papers qp on qp.id=pp.paper_id
         where pp.product_id=p.id),'[]'::jsonb)
  from public.products p
  join public.product_versions pv on pv.product_id=p.id and pv.is_current=true
  where p.status='published'
    and (pv.starts_at is null or pv.starts_at<=now())
    and (pv.ends_at is null or pv.ends_at>=now())
  order by p.is_featured desc,p.created_at desc;
$$;

grant execute on function public.get_store_products() to anon, authenticated;

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
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_code text := upper(btrim(p_code));
  v_email text := nullif(lower(btrim(coalesce(p_allowed_email,''))), '');
  v_reference text := nullif(btrim(coalesce(p_offline_payment_reference,'')), '');
  v_seat_count integer := p_seat_count;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  if not public.is_evidara_platform_admin() then raise exception 'Evidara Admin or Super Admin access required.' using errcode='42501'; end if;
  if v_code !~ '^[A-Z0-9_-]{4,32}$' then raise exception 'Voucher code must contain 4–32 letters, numbers, hyphens or underscores.'; end if;
  if p_discount_percent not between 1 and 10 and p_discount_percent <> 100 then
    raise exception 'Promotional vouchers may be 1%% to 10%%. Use 100%% only for recorded offline school payments.';
  end if;
  if p_discount_percent = 100 then
    if not public.is_evidara_super_admin() then raise exception 'Only Super Admin can create or edit a 100%% offline-payment voucher.'; end if;
    if p_purpose <> 'offline_payment' then raise exception 'A 100%% voucher must be an offline-payment voucher.'; end if;
    if p_product_id is null or p_organization_id is null then raise exception 'Choose the purchased product and school for a 100%% voucher.'; end if;
    if v_reference is null or coalesce(p_offline_amount_paise,0) <= 0 then raise exception 'Record the offline amount and transaction, receipt or invoice reference.'; end if;
    if coalesce(v_seat_count,0) <= 0 then raise exception 'Enter the number of school seats being activated.'; end if;
    p_usage_limit := 1;
    p_per_user_limit := 1;
  else
    if p_purpose='offline_payment' then raise exception 'Offline-payment activation uses a controlled 100%% voucher.'; end if;
    v_seat_count := null;
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
  values(v_user,case when p_voucher_id is null then 'voucher.v9.created' else 'voucher.v9.updated' end,'voucher',v_id::text,
    jsonb_build_object('code',v_code,'discount_percent',p_discount_percent,'purpose',p_purpose,'product_id',p_product_id,
      'organization_id',p_organization_id,'seat_count',v_seat_count,'offline_reference',v_reference,'offline_amount_paise',p_offline_amount_paise));
  return v_id;
end;
$$;

grant execute on function public.admin_upsert_voucher_v9(uuid,text,text,integer,public.voucher_purpose,uuid,text,uuid,integer,integer,integer,timestamptz,timestamptz,boolean,text,integer,text) to authenticated, service_role;

-- Paid and offline-voucher fulfilment now carries the purchased school seat limit.
create or replace function public.fulfill_paid_order(
  p_order_id uuid,
  p_payment_id text,
  p_signature text,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_version public.product_versions%rowtype;
  v_entitlement uuid;
  v_expiry timestamptz;
  v_was_paid boolean := false;
  v_seat_limit integer;
begin
  select * into v_order from public.orders where id=p_order_id for update;
  if not found then raise exception 'Order not found.'; end if;
  v_was_paid := v_order.status='paid';
  select * into v_version from public.product_versions where id=v_order.product_version_id;
  if not found then raise exception 'Product version not found.'; end if;
  if v_version.access_days is not null then v_expiry:=now()+make_interval(days=>v_version.access_days); end if;
  if v_order.organization_id is not null then v_seat_limit:=v_version.student_limit; end if;

  update public.orders set status='paid',paid_at=coalesce(paid_at,now()),failure_reason=null where id=v_order.id;
  insert into public.payments(order_id,razorpay_payment_id,razorpay_signature,status,amount_paise,raw_payload)
  values(v_order.id,p_payment_id,p_signature,'captured',v_order.amount_paise,coalesce(p_payload,'{}'::jsonb))
  on conflict(razorpay_payment_id) do update set status='captured',razorpay_signature=coalesce(public.payments.razorpay_signature,excluded.razorpay_signature),raw_payload=excluded.raw_payload,updated_at=now();

  if v_order.organization_id is not null then
    insert into public.entitlements(organization_id,product_id,product_version_id,source,status,starts_at,expires_at,attempts_limit,seat_limit,order_id,commerce_metadata)
    values(v_order.organization_id,v_order.product_id,v_order.product_version_id,'purchase','active',now(),v_expiry,v_version.max_attempts,v_seat_limit,v_order.id,
      jsonb_build_object('payment_source','razorpay'))
    on conflict(organization_id,product_id) where organization_id is not null
    do update set product_version_id=excluded.product_version_id,source=excluded.source,status='active',starts_at=now(),expires_at=excluded.expires_at,
      attempts_limit=excluded.attempts_limit,seat_limit=excluded.seat_limit,order_id=excluded.order_id,commerce_metadata=excluded.commerce_metadata,updated_at=now()
    returning id into v_entitlement;
  else
    insert into public.entitlements(user_id,product_id,product_version_id,source,status,starts_at,expires_at,attempts_limit,seat_limit,order_id,commerce_metadata)
    values(v_order.user_id,v_order.product_id,v_order.product_version_id,'purchase','active',now(),v_expiry,v_version.max_attempts,null,v_order.id,
      jsonb_build_object('payment_source','razorpay'))
    on conflict(user_id,product_id) where organization_id is null
    do update set product_version_id=excluded.product_version_id,source=excluded.source,status='active',starts_at=now(),expires_at=excluded.expires_at,
      attempts_limit=excluded.attempts_limit,seat_limit=null,order_id=excluded.order_id,commerce_metadata=excluded.commerce_metadata,updated_at=now()
    returning id into v_entitlement;
  end if;

  if v_order.coupon_id is not null and not v_was_paid then update public.coupons set used_count=used_count+1 where id=v_order.coupon_id; end if;
  return v_entitlement;
end;
$$;

revoke all on function public.fulfill_paid_order(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.fulfill_paid_order(uuid,text,text,jsonb) to service_role;

create or replace function public.fulfill_voucher_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
  if v_voucher.purpose<>'offline_payment' or v_order.organization_id is null then raise exception '100%% vouchers are reserved for recorded school offline payments.'; end if;
  if not v_voucher.active then raise exception 'Voucher is inactive.'; end if;
  if v_voucher.starts_at is not null and v_voucher.starts_at>now() then raise exception 'Voucher is not active yet.'; end if;
  if v_voucher.ends_at is not null and v_voucher.ends_at<now() then raise exception 'Voucher has expired.'; end if;

  select * into v_version from public.product_versions where id=v_order.product_version_id;
  if not found then raise exception 'Product version not found.'; end if;
  if v_version.access_days is not null then v_expiry:=now()+make_interval(days=>v_version.access_days); end if;
  v_seat_limit:=coalesce(v_voucher.seat_count,v_version.student_limit);
  if coalesce(v_seat_limit,0)<=0 then raise exception 'The offline school activation does not contain a seat allocation.'; end if;

  update public.orders set status='paid',paid_at=coalesce(paid_at,now()),failure_reason=null,
    commerce_metadata=coalesce(commerce_metadata,'{}'::jsonb)||jsonb_build_object('seat_count',v_seat_limit)
  where id=v_order.id;

  insert into public.entitlements(organization_id,product_id,product_version_id,source,status,starts_at,expires_at,attempts_limit,seat_limit,order_id,commerce_metadata)
  values(v_order.organization_id,v_order.product_id,v_order.product_version_id,'offline_voucher','active',now(),v_expiry,v_version.max_attempts,v_seat_limit,v_order.id,
    jsonb_build_object('payment_source','offline_voucher','offline_reference',v_order.offline_reference,'offline_amount_paise',v_voucher.offline_amount_paise))
  on conflict(organization_id,product_id) where organization_id is not null
  do update set product_version_id=excluded.product_version_id,source=excluded.source,status='active',starts_at=now(),expires_at=excluded.expires_at,
    attempts_limit=excluded.attempts_limit,seat_limit=excluded.seat_limit,order_id=excluded.order_id,commerce_metadata=excluded.commerce_metadata,updated_at=now()
  returning id into v_entitlement;
  return v_entitlement;
end;
$$;

revoke all on function public.fulfill_voucher_order(uuid) from public,anon,authenticated;
grant execute on function public.fulfill_voucher_order(uuid) to service_role;

create or replace function public.has_product_access_v9(p_product_id uuid,p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    public.is_evidara_platform_admin()
    or exists(
      select 1
      from public.entitlements e
      where e.product_id=p_product_id
        and e.status='active'
        and (e.expires_at is null or e.expires_at>now())
        and (
          e.user_id=p_user_id
          or (
            e.organization_id is not null
            and (
              exists(
                select 1 from public.organization_members m
                where m.organization_id=e.organization_id and m.user_id=p_user_id and m.is_active=true
              )
              or exists(
                select 1 from public.student_school_memberships sm
                where sm.organization_id=e.organization_id and sm.student_id=p_user_id and sm.status='active'
                  and (
                    e.seat_limit is null
                    or exists(
                      select 1 from public.product_seat_assignments a
                      where a.entitlement_id=e.id and a.student_id=p_user_id and a.status='active'
                    )
                  )
              )
            )
          )
        )
    ),false
  )
$$;

grant execute on function public.has_product_access_v9(uuid,uuid) to authenticated,service_role;

create or replace function public.can_access_product_paper_v9(p_paper_id uuid,p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select not exists(select 1 from public.product_papers pp where pp.paper_id=p_paper_id)
    or exists(
      select 1 from public.product_papers pp
      where pp.paper_id=p_paper_id and public.has_product_access_v9(pp.product_id,p_user_id)
    )
$$;

grant execute on function public.can_access_product_paper_v9(uuid,uuid) to authenticated,service_role;

create or replace function public.assign_product_seat_v9(p_entitlement_id uuid,p_student_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_entitlement public.entitlements%rowtype;
  v_assignment uuid;
  v_used integer;
begin
  select * into v_entitlement from public.entitlements where id=p_entitlement_id and organization_id is not null for update;
  if not found then raise exception 'School product entitlement not found.'; end if;
  if not (public.is_evidara_platform_admin() or public.is_evidara_school_manager(v_entitlement.organization_id)) then raise exception 'School manager permission required.' using errcode='42501'; end if;
  if v_entitlement.status<>'active' or (v_entitlement.expires_at is not null and v_entitlement.expires_at<=now()) then raise exception 'This product entitlement is not active.'; end if;
  if not exists(select 1 from public.student_school_memberships m where m.organization_id=v_entitlement.organization_id and m.student_id=p_student_id and m.status='active') then
    raise exception 'The selected student is not an active member of this school.';
  end if;
  select count(*) into v_used from public.product_seat_assignments where entitlement_id=v_entitlement.id and status='active' and student_id<>p_student_id;
  if v_entitlement.seat_limit is not null and v_used>=v_entitlement.seat_limit then raise exception 'All purchased seats are already allocated.'; end if;
  insert into public.product_seat_assignments(entitlement_id,organization_id,student_id,status,assigned_by,assigned_at,released_by,released_at)
  values(v_entitlement.id,v_entitlement.organization_id,p_student_id,'active',auth.uid(),now(),null,null)
  on conflict(entitlement_id,student_id) do update set status='active',assigned_by=auth.uid(),assigned_at=now(),released_by=null,released_at=null
  returning id into v_assignment;
  return v_assignment;
end;
$$;

grant execute on function public.assign_product_seat_v9(uuid,uuid) to authenticated,service_role;

create or replace function public.release_product_seat_v9(p_assignment_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.product_seat_assignments where id=p_assignment_id;
  if v_org is null then raise exception 'Seat assignment not found.'; end if;
  if not (public.is_evidara_platform_admin() or public.is_evidara_school_manager(v_org)) then raise exception 'School manager permission required.' using errcode='42501'; end if;
  update public.product_seat_assignments set status='released',released_by=auth.uid(),released_at=now() where id=p_assignment_id;
end;
$$;

grant execute on function public.release_product_seat_v9(uuid) to authenticated,service_role;

create or replace function public.get_product_commerce_analytics_v9(
  p_from date,
  p_to date,
  p_granularity text default 'day'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_from timestamptz := coalesce(p_from,current_date-interval '29 days')::date::timestamptz;
  v_to timestamptz := (coalesce(p_to,current_date)+1)::date::timestamptz;
  v_granularity text := case when p_granularity in ('day','month','year') then p_granularity else 'day' end;
  v_result jsonb;
begin
  if not public.is_evidara_platform_admin() then raise exception 'Evidara Admin or Super Admin access required.' using errcode='42501'; end if;
  if v_to<=v_from then raise exception 'The end date must be on or after the start date.'; end if;

  with paid as (
    select o.*,p.name as product_name,coalesce(e.seat_limit,case when o.organization_id is null then 1 else 0 end) as seats,
      case when o.payment_source='offline_voucher' then coalesce(v.offline_amount_paise,0) else o.amount_paise end as recognized_revenue_paise
    from public.orders o
    join public.products p on p.id=o.product_id
    left join public.entitlements e on e.order_id=o.id
    left join public.voucher_codes v on v.id=o.voucher_id
    where o.status='paid' and coalesce(o.paid_at,o.created_at)>=v_from and coalesce(o.paid_at,o.created_at)<v_to
  ), series as (
    select
      case v_granularity when 'year' then date_trunc('year',coalesce(paid_at,created_at)) when 'month' then date_trunc('month',coalesce(paid_at,created_at)) else date_trunc('day',coalesce(paid_at,created_at)) end as period_start,
      sum(recognized_revenue_paise)::bigint as revenue_paise,
      sum(discount_paise)::bigint as discount_paise,
      count(*)::integer as orders,
      count(distinct user_id) filter(where organization_id is null)::integer as students,
      count(distinct organization_id) filter(where organization_id is not null)::integer as schools,
      coalesce(sum(seats) filter(where organization_id is not null),0)::bigint as seats
    from paid group by 1
  ), top_products as (
    select product_id,product_name,sum(recognized_revenue_paise)::bigint revenue_paise,count(*)::integer orders,
      count(distinct user_id) filter(where organization_id is null)::integer students,
      count(distinct organization_id) filter(where organization_id is not null)::integer schools,
      coalesce(sum(seats) filter(where organization_id is not null),0)::bigint seats
    from paid group by product_id,product_name order by revenue_paise desc,orders desc limit 10
  )
  select jsonb_build_object(
    'from',v_from,'to',v_to,'granularity',v_granularity,
    'summary',jsonb_build_object(
      'revenue_paise',coalesce((select sum(recognized_revenue_paise) from paid),0),
      'discount_paise',coalesce((select sum(discount_paise) from paid),0),
      'orders',coalesce((select count(*) from paid),0),
      'student_purchases',coalesce((select count(distinct user_id) from paid where organization_id is null),0),
      'school_purchases',coalesce((select count(distinct organization_id) from paid where organization_id is not null),0),
      'school_seats_sold',coalesce((select sum(seats) from paid where organization_id is not null),0),
      'average_order_paise',coalesce((select round(avg(recognized_revenue_paise)) from paid),0),
      'active_products',(select count(*) from public.products where status='published')
    ),
    'series',coalesce((select jsonb_agg(jsonb_build_object(
      'period',period_start,'revenue_paise',revenue_paise,'discount_paise',discount_paise,'orders',orders,'students',students,'schools',schools,'seats',seats
    ) order by period_start) from series),'[]'::jsonb),
    'top_products',coalesce((select jsonb_agg(jsonb_build_object(
      'product_id',product_id,'product_name',product_name,'revenue_paise',revenue_paise,'orders',orders,'students',students,'schools',schools,'seats',seats
    ) order by revenue_paise desc) from top_products),'[]'::jsonb),
    'voucher_redemptions',coalesce((select count(*) from public.voucher_redemptions vr where vr.created_at>=v_from and vr.created_at<v_to),0),
    'offline_school_activations',coalesce((select count(*) from public.orders o where o.status='paid' and o.organization_id is not null and o.payment_source='offline_voucher' and coalesce(o.paid_at,o.created_at)>=v_from and coalesce(o.paid_at,o.created_at)<v_to),0)
  ) into v_result;
  return v_result;
end;
$$;

grant execute on function public.get_product_commerce_analytics_v9(date,date,text) to authenticated,service_role;

-- Product-linked master papers are visible and startable only after a valid purchase or school seat assignment.
create or replace function public.list_available_papers()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'title',p.title,'description',p.description,'exam_type',p.exam_type,
    'grade_level',p.grade_level,'test_type',p.test_type,'custom_test_type',p.custom_test_type,
    'duration_minutes',p.duration_minutes,'total_marks',p.total_marks,'total_questions',p.total_questions,
    'available_from',p.available_from,'available_until',p.available_until,'open_forever',p.open_forever,
    'attempt_limit',p.attempt_limit,
    'attempts_used',(select count(*) from public.exam_attempts a where a.paper_id=p.id and a.student_id=auth.uid()),
    'result_mode',p.result_mode,'access_mode',p.access_mode,
    'access_label',case when exists(select 1 from public.product_papers pp where pp.paper_id=p.id) then 'paid' when p.organization_id is not null then 'free' else coalesce(p.access_label::text,'included') end
  ) order by p.available_from nulls first,p.created_at desc),'[]'::jsonb)
  from public.question_papers p
  where auth.uid() is not null
    and p.status='published'
    and (p.open_forever or p.available_from is null or p.available_from<=now())
    and (p.open_forever or p.available_until is null or p.available_until>=now())
    and (
      (p.organization_id is not null and public.is_org_member(p.organization_id))
      or (p.organization_id is null and public.can_access_product_paper_v9(p.id,auth.uid()))
    )
$$;

grant execute on function public.list_available_papers() to authenticated;

create or replace function public.find_paper_by_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select jsonb_build_object(
    'id',p.id,'title',p.title,'description',p.description,'exam_type',p.exam_type,
    'grade_level',p.grade_level,'test_type',p.test_type,'custom_test_type',p.custom_test_type,
    'duration_minutes',p.duration_minutes,'total_marks',p.total_marks,'total_questions',p.total_questions,
    'available_from',p.available_from,'available_until',p.available_until,'attempt_limit',p.attempt_limit,
    'attempts_used',(select count(*) from public.exam_attempts a where a.paper_id=p.id and a.student_id=auth.uid()),
    'result_mode',p.result_mode,'access_mode',p.access_mode,
    'access_label',case when exists(select 1 from public.product_papers pp where pp.paper_id=p.id) then 'paid' else 'included' end
  ) from public.question_papers p
  where auth.uid() is not null and p.status='published' and p.access_mode='code'
    and upper(btrim(p.access_code))=upper(btrim(p_code))
    and (p.available_from is null or p.available_from<=now())
    and (p.available_until is null or p.available_until>=now())
    and (p.organization_id is not null and public.is_org_member(p.organization_id) or p.organization_id is null and public.can_access_product_paper_v9(p.id,auth.uid()))
  limit 1),'null'::jsonb)
$$;

grant execute on function public.find_paper_by_code(text) to authenticated;

create or replace function public.start_exam_attempt(p_paper_id uuid,p_access_code text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_paper public.question_papers%rowtype;
  v_existing uuid;
  v_attempt uuid;
  v_number integer;
  v_order uuid[];
  v_expiry timestamptz;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  select * into v_paper from public.question_papers where id=p_paper_id and status='published';
  if not found then raise exception 'This test is not available.'; end if;
  if v_paper.available_from is not null and now()<v_paper.available_from then raise exception 'This test has not opened yet.'; end if;
  if v_paper.available_until is not null and now()>v_paper.available_until then raise exception 'This test has closed.'; end if;
  if v_paper.access_mode='organization' and (v_paper.organization_id is null or not public.is_org_member(v_paper.organization_id)) then raise exception 'This test is restricted to school members.'; end if;
  if v_paper.access_mode='code' and upper(btrim(coalesce(p_access_code,'')))<>upper(btrim(coalesce(v_paper.access_code,''))) then raise exception 'Invalid test access code.'; end if;
  if v_paper.organization_id is null and not public.can_access_product_paper_v9(v_paper.id,v_user) then raise exception 'Purchase this paper series or ask your school to assign a product seat before starting the test.'; end if;

  select id into v_existing from public.exam_attempts
  where paper_id=p_paper_id and student_id=v_user and status='in_progress' and expires_at>now()
  order by started_at desc limit 1;
  if v_existing is not null then return v_existing; end if;
  update public.exam_attempts set status='expired' where paper_id=p_paper_id and student_id=v_user and status='in_progress' and expires_at<=now();

  select count(*)+1 into v_number from public.exam_attempts where paper_id=p_paper_id and student_id=v_user;
  if v_number>v_paper.attempt_limit then raise exception 'You have used all attempts for this test.'; end if;
  if v_paper.shuffle_questions then select array_agg(id order by random()) into v_order from public.paper_questions where paper_id=p_paper_id;
  else select array_agg(id order by display_order,id) into v_order from public.paper_questions where paper_id=p_paper_id; end if;
  v_expiry:=now()+make_interval(mins=>v_paper.duration_minutes);
  if v_paper.available_until is not null then v_expiry:=least(v_expiry,v_paper.available_until); end if;

  insert into public.exam_attempts(paper_id,student_id,organization_id,attempt_number,status,expires_at,question_order,maximum_marks,unanswered_count)
  values(p_paper_id,v_user,v_paper.organization_id,v_number,'in_progress',v_expiry,coalesce(v_order,'{}'),v_paper.total_marks,v_paper.total_questions)
  returning id into v_attempt;
  return v_attempt;
end;
$$;

grant execute on function public.start_exam_attempt(uuid,text) to authenticated;

commit;
