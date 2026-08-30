-- Evidara Phase 1 hardening: real student assessment access.
--
-- Students are intentionally NOT added to organization_members. That table is
-- used for staff/administrative permissions in several RLS paths. Assessment
-- eligibility uses the canonical student_school_memberships relationship
-- instead, avoiding accidental privilege broadening.

create or replace function public.is_active_student_member(
  p_organization_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    p_organization_id is not null
    and p_user_id is not null
    and exists (
      select 1
      from public.student_school_memberships membership
      where membership.organization_id = p_organization_id
        and membership.student_id = p_user_id
        and membership.status = 'active'
    ),
    false
  );
$$;

-- Keep the helper private. Public assessment RPCs below call it while running
-- as their SECURITY DEFINER owner. This avoids exposing arbitrary membership
-- lookups to browser clients.
revoke all on function public.is_active_student_member(uuid, uuid) from public;
revoke all on function public.is_active_student_member(uuid, uuid) from anon;
revoke all on function public.is_active_student_member(uuid, uuid) from authenticated;
grant execute on function public.is_active_student_member(uuid, uuid) to service_role;

create or replace function public.list_available_papers()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
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
      (
        p.organization_id is not null
        and (
          public.is_org_member(p.organization_id)
          or public.is_active_student_member(p.organization_id, auth.uid())
        )
      )
      or (p.organization_id is null and public.can_access_product_paper_v9(p.id,auth.uid()))
    );
$$;

create or replace function public.find_paper_by_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
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
    and (
      (
        p.organization_id is not null
        and (
          public.is_org_member(p.organization_id)
          or public.is_active_student_member(p.organization_id, auth.uid())
        )
      )
      or (p.organization_id is null and public.can_access_product_paper_v9(p.id,auth.uid()))
    )
  limit 1),'null'::jsonb);
$$;

create or replace function public.start_exam_attempt(p_paper_id uuid, p_access_code text default null::text)
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
     and (
       v_paper.organization_id is null
       or not (
         public.is_org_member(v_paper.organization_id)
         or public.is_active_student_member(v_paper.organization_id, v_user)
       )
     ) then
    raise exception 'This test is restricted to active school members.';
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

  -- Legacy product-backed papers keep their existing entitlement rules. Phase 1
  -- institution papers do not depend on the parked direct-commerce modules.
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

-- Keep the existing public RPC grant posture for the three student-facing
-- assessment RPCs. RPC allowlisting is handled separately in P0.11.
