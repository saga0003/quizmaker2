-- Evidara V12 — security foundation, account directory and transactional attempt usage
-- Run after 43_v12_trial_response_evidence.sql.

begin;

create or replace function public.is_org_finance_manager_v12(p_organization_id uuid)
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
      from public.organization_members member
      where member.organization_id = p_organization_id
        and member.user_id = auth.uid()
        and member.is_active = true
        and member.member_role::text in ('institute_owner','institute_admin','school_owner','school_admin')
    ), false
  );
$$;

revoke all on function public.is_org_finance_manager_v12(uuid) from public, anon;
grant execute on function public.is_org_finance_manager_v12(uuid) to authenticated, service_role;

-- Financial records are visible only to the buyer, platform administrators or
-- an authorised school finance manager. Teachers and ordinary school members
-- do not receive access merely because they belong to the organization.
drop policy if exists orders_select_own_or_admin on public.orders;
drop policy if exists orders_select_own_or_finance_v12 on public.orders;
create policy orders_select_own_or_finance_v12 on public.orders
for select to authenticated
using (
  user_id = auth.uid()
  or public.is_evidara_platform_admin()
  or (organization_id is not null and public.is_org_finance_manager_v12(organization_id))
);

drop policy if exists payments_select_own_or_admin on public.payments;
drop policy if exists payments_select_own_or_finance_v12 on public.payments;
create policy payments_select_own_or_finance_v12 on public.payments
for select to authenticated
using (
  public.is_evidara_platform_admin()
  or exists(
    select 1
    from public.orders order_row
    where order_row.id = payments.order_id
      and (
        order_row.user_id = auth.uid()
        or (
          order_row.organization_id is not null
          and public.is_org_finance_manager_v12(order_row.organization_id)
        )
      )
  )
);

-- One immutable row is written for every new product-backed attempt. The
-- entitlement start timestamp creates a natural purchase/renewal cycle, so a
-- renewed entitlement receives a fresh limit without deleting audit history.
create table if not exists public.product_attempt_usage (
  id uuid primary key default gen_random_uuid(),
  entitlement_id uuid not null references public.entitlements(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  entitlement_started_at timestamptz not null,
  attempts_used integer not null check (attempts_used > 0),
  created_at timestamptz not null default now(),
  unique(attempt_id)
);

create index if not exists product_attempt_usage_entitlement_cycle_idx
  on public.product_attempt_usage(entitlement_id, entitlement_started_at, created_at);
create index if not exists product_attempt_usage_student_product_idx
  on public.product_attempt_usage(student_id, product_id, created_at desc);

alter table public.product_attempt_usage enable row level security;

drop policy if exists product_attempt_usage_read_v12 on public.product_attempt_usage;
create policy product_attempt_usage_read_v12 on public.product_attempt_usage
for select to authenticated
using (
  student_id = auth.uid()
  or public.is_evidara_platform_admin()
  or exists(
    select 1
    from public.entitlements entitlement
    where entitlement.id = product_attempt_usage.entitlement_id
      and entitlement.organization_id is not null
      and public.is_org_finance_manager_v12(entitlement.organization_id)
  )
);

revoke insert, update, delete on public.product_attempt_usage from authenticated;
grant select on public.product_attempt_usage to authenticated;

create or replace function public.start_exam_attempt(p_paper_id uuid, p_access_code text default null)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_paper public.question_papers%rowtype;
  v_existing uuid;
  v_attempt uuid;
  v_number integer;
  v_order uuid[];
  v_expiry timestamptz;
  v_product_id uuid;
  v_entitlement public.entitlements%rowtype;
  v_product_attempts integer := 0;
begin
  if v_user is null then raise exception 'Login required.'; end if;

  select * into v_paper
  from public.question_papers
  where id = p_paper_id and status = 'published';
  if not found then raise exception 'This test is not available.'; end if;

  if v_paper.available_from is not null and now() < v_paper.available_from then
    raise exception 'This test has not opened yet.';
  end if;
  if v_paper.available_until is not null and now() > v_paper.available_until then
    raise exception 'This test has closed.';
  end if;
  if v_paper.access_mode = 'organization'
     and (v_paper.organization_id is null or not public.is_org_member(v_paper.organization_id)) then
    raise exception 'This test is restricted to school members.';
  end if;
  if v_paper.access_mode = 'code'
     and upper(btrim(coalesce(p_access_code,''))) <> upper(btrim(coalesce(v_paper.access_code,''))) then
    raise exception 'Invalid test access code.';
  end if;

  -- Reusing an active attempt never consumes another product attempt.
  select id into v_existing
  from public.exam_attempts
  where paper_id = p_paper_id
    and student_id = v_user
    and status = 'in_progress'
    and expires_at > now()
  order by started_at desc
  limit 1;
  if v_existing is not null then return v_existing; end if;

  update public.exam_attempts
  set status = 'expired'
  where paper_id = p_paper_id
    and student_id = v_user
    and status = 'in_progress'
    and expires_at <= now();

  select count(*) + 1 into v_number
  from public.exam_attempts
  where paper_id = p_paper_id and student_id = v_user;
  if v_number > v_paper.attempt_limit then
    raise exception 'You have used all attempts for this test.';
  end if;

  -- Product-backed papers require one active direct entitlement or an assigned
  -- school seat. Lock the selected entitlement so concurrent starts cannot
  -- overspend the same limit.
  select product_paper.product_id
  into v_product_id
  from public.product_papers product_paper
  where product_paper.paper_id = p_paper_id
  order by product_paper.display_order, product_paper.created_at
  limit 1;

  if v_product_id is not null then
    select entitlement.*
    into v_entitlement
    from public.entitlements entitlement
    where entitlement.id = (
      select candidate.id
      from (
        select direct_entitlement.id, 0 as priority
        from public.entitlements direct_entitlement
        where direct_entitlement.product_id = v_product_id
          and direct_entitlement.user_id = v_user
          and direct_entitlement.status = 'active'
          and (direct_entitlement.expires_at is null or direct_entitlement.expires_at > now())

        union all

        select school_entitlement.id, 1 as priority
        from public.entitlements school_entitlement
        join public.student_school_memberships membership
          on membership.organization_id = school_entitlement.organization_id
         and membership.student_id = v_user
         and membership.status = 'active'
        where school_entitlement.product_id = v_product_id
          and school_entitlement.organization_id is not null
          and school_entitlement.status = 'active'
          and (school_entitlement.expires_at is null or school_entitlement.expires_at > now())
          and (
            school_entitlement.seat_limit is null
            or exists(
              select 1
              from public.product_seat_assignments seat
              where seat.entitlement_id = school_entitlement.id
                and seat.student_id = v_user
                and seat.status = 'active'
            )
          )
      ) candidate
      order by candidate.priority, candidate.id
      limit 1
    )
    for update;

    if not found then
      raise exception 'Purchase this paper series or ask your school to assign a product seat before starting the test.';
    end if;

    select count(*)::integer
    into v_product_attempts
    from public.product_attempt_usage usage
    where usage.entitlement_id = v_entitlement.id
      and usage.entitlement_started_at = v_entitlement.starts_at;

    if v_entitlement.attempts_limit is not null
       and v_product_attempts >= v_entitlement.attempts_limit then
      raise exception 'You have used all purchased attempts for this paper series.';
    end if;
  end if;

  if v_paper.shuffle_questions then
    select array_agg(id order by random()) into v_order
    from public.paper_questions where paper_id = p_paper_id;
  else
    select array_agg(id order by display_order, id) into v_order
    from public.paper_questions where paper_id = p_paper_id;
  end if;

  v_expiry := now() + make_interval(mins => v_paper.duration_minutes);
  if v_paper.available_until is not null then
    v_expiry := least(v_expiry, v_paper.available_until);
  end if;

  insert into public.exam_attempts(
    paper_id, student_id, organization_id, attempt_number, status,
    expires_at, question_order, maximum_marks, unanswered_count
  ) values (
    p_paper_id, v_user, v_paper.organization_id, v_number, 'in_progress',
    v_expiry, coalesce(v_order, '{}'), v_paper.total_marks, v_paper.total_questions
  ) returning id into v_attempt;

  if v_product_id is not null then
    insert into public.product_attempt_usage(
      entitlement_id, product_id, paper_id, student_id, attempt_id,
      entitlement_started_at, attempts_used
    ) values (
      v_entitlement.id, v_product_id, p_paper_id, v_user, v_attempt,
      v_entitlement.starts_at, v_product_attempts + 1
    );

    update public.entitlements
    set attempts_used = v_product_attempts + 1,
        updated_at = now()
    where id = v_entitlement.id;
  end if;

  return v_attempt;
end;
$$;

revoke all on function public.start_exam_attempt(uuid,text) from public, anon;
grant execute on function public.start_exam_attempt(uuid,text) to authenticated;

-- Server-side account directory. It reads auth.users only inside a SECURITY
-- DEFINER boundary and returns one paginated result instead of repeatedly
-- scanning Auth Admin pages from application code.
create or replace function public.admin_account_directory_v12(
  p_actor_id uuid,
  p_organization_id uuid default null,
  p_search text default null,
  p_role text default null,
  p_page integer default 1,
  p_page_size integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_actor_role text;
  v_actor_org uuid;
  v_page integer := greatest(coalesce(p_page,1),1);
  v_page_size integer := least(100,greatest(coalesce(p_page_size,50),1));
  v_total integer := 0;
  v_accounts jsonb := '[]'::jsonb;
begin
  if p_actor_id is null then raise exception 'Actor is required.'; end if;
  if coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' and auth.uid() is distinct from p_actor_id then
    raise exception 'The directory actor does not match the signed-in account.' using errcode='42501';
  end if;

  select profile.role::text into v_actor_role
  from public.profiles profile where profile.id = p_actor_id;
  if v_actor_role is null then raise exception 'Actor profile not found.'; end if;

  if v_actor_role not in ('super_admin','evidara_admin','admin','platform_admin') then
    select member.organization_id into v_actor_org
    from public.organization_members member
    where member.user_id = p_actor_id
      and member.is_active = true
      and member.member_role::text in ('institute_owner','institute_admin','school_owner','school_admin')
    order by member.created_at
    limit 1;
    if v_actor_org is null then raise exception 'Access Control permission is required.' using errcode='42501'; end if;
    if p_organization_id is not null and p_organization_id <> v_actor_org then
      raise exception 'School Admin can view only their own school.' using errcode='42501';
    end if;
    p_organization_id := v_actor_org;
  end if;

  with filtered as (
    select profile.id, profile.full_name, profile.phone, profile.role::text as role,
      profile.avatar_url, profile.created_at, auth_user.email, auth_user.last_sign_in_at
    from public.profiles profile
    left join auth.users auth_user on auth_user.id = profile.id
    where (
      p_organization_id is null
      or exists(
        select 1 from public.organization_members member
        where member.user_id = profile.id
          and member.organization_id = p_organization_id
          and member.is_active = true
      )
      or exists(
        select 1 from public.student_school_memberships membership
        where membership.student_id = profile.id
          and membership.organization_id = p_organization_id
          and membership.status = 'active'
      )
    )
    and (p_role is null or profile.role::text = p_role)
    and (
      nullif(btrim(coalesce(p_search,'')),'') is null
      or coalesce(profile.full_name,'') ilike '%' || btrim(p_search) || '%'
      or coalesce(auth_user.email,'') ilike '%' || btrim(p_search) || '%'
      or coalesce(profile.phone,'') ilike '%' || btrim(p_search) || '%'
    )
  ), counted as (
    select count(*)::integer as total from filtered
  ), page_rows as (
    select * from filtered
    order by lower(coalesce(full_name,email,'')), id
    offset (v_page - 1) * v_page_size
    limit v_page_size
  )
  select
    counted.total,
    coalesce(jsonb_agg(jsonb_build_object(
      'id', row.id,
      'full_name', coalesce(row.full_name, split_part(coalesce(row.email,''),'@',1), 'Account'),
      'email', row.email,
      'phone', row.phone,
      'role', row.role,
      'avatar_url', row.avatar_url,
      'created_at', row.created_at,
      'last_sign_in_at', row.last_sign_in_at,
      'memberships', coalesce((
        select jsonb_agg(jsonb_build_object(
          'organization_id', member.organization_id,
          'organization_name', organization.name,
          'role', member.member_role::text,
          'is_active', member.is_active
        ) order by organization.name)
        from public.organization_members member
        join public.organizations organization on organization.id = member.organization_id
        where member.user_id = row.id
      ), '[]'::jsonb)
    ) order by lower(coalesce(row.full_name,row.email,''))) filter (where row.id is not null), '[]'::jsonb)
  into v_total, v_accounts
  from counted
  left join page_rows row on true
  group by counted.total;

  return jsonb_build_object(
    'accounts', coalesce(v_accounts,'[]'::jsonb),
    'page', v_page,
    'pageSize', v_page_size,
    'total', coalesce(v_total,0),
    'totalPages', greatest(1,ceil(coalesce(v_total,0)::numeric / v_page_size)::integer)
  );
end;
$$;

revoke all on function public.admin_account_directory_v12(uuid,uuid,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.admin_account_directory_v12(uuid,uuid,text,text,integer,integer) to service_role;

create or replace function public.lookup_auth_user_by_email_v12(p_email text)
returns uuid
language sql
stable
security definer
set search_path = auth, public
as $$
  select user_row.id
  from auth.users user_row
  where lower(user_row.email) = lower(btrim(p_email))
  order by user_row.created_at
  limit 1;
$$;

revoke all on function public.lookup_auth_user_by_email_v12(text) from public, anon, authenticated;
grant execute on function public.lookup_auth_user_by_email_v12(text) to service_role;


-- Student purchase history is exposed through a self-scoped RPC so school-level
-- entitlements are never returned merely because a student belongs to a school.
create or replace function public.list_my_entitlements_v12()
returns table (
  id uuid,
  status text,
  source text,
  starts_at timestamptz,
  expires_at timestamptz,
  attempts_limit integer,
  attempts_used integer,
  seat_limit integer,
  organization_id uuid,
  products jsonb
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    entitlement.id,
    entitlement.status::text,
    entitlement.source,
    entitlement.starts_at,
    entitlement.expires_at,
    entitlement.attempts_limit,
    entitlement.attempts_used,
    entitlement.seat_limit,
    entitlement.organization_id,
    jsonb_build_object(
      'name', product.name,
      'cover_image_url', product.cover_image_url
    ) as products
  from public.entitlements entitlement
  join public.products product on product.id = entitlement.product_id
  where auth.uid() is not null
    and (
      entitlement.user_id = auth.uid()
      or exists (
        select 1
        from public.product_seat_assignments seat
        where seat.entitlement_id = entitlement.id
          and seat.student_id = auth.uid()
          and seat.status = 'active'
      )
    )
  order by entitlement.created_at desc;
$$;

revoke all on function public.list_my_entitlements_v12() from public, anon;
grant execute on function public.list_my_entitlements_v12() to authenticated;

insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
values(null, 'evidara.v12.security_foundation_ready', 'system', '44_v12_security_foundation',
  jsonb_build_object(
    'financial_rls', true,
    'transactional_attempt_usage', true,
    'paginated_account_directory', true,
    'auth_email_lookup', true
  ));

notify pgrst, 'reload schema';
commit;
