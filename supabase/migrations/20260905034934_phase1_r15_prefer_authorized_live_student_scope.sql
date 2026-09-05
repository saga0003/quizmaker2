create or replace function public.get_student_analytics_v12(
  p_student_id uuid default auth.uid(),
  p_product_id uuid default null::uuid,
  p_date_from timestamptz default null::timestamptz,
  p_date_to timestamptz default null::timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_requested uuid := coalesce(p_student_id, auth.uid());
  v_demo_id uuid;
  v_demo_auth_user uuid;
  v_demo_org uuid;
  v_demo_payload jsonb;
  v_demo_evidence jsonb;
  v_orgs uuid[];
  v_support_org uuid;
  v_latest_paper uuid;
  v_release jsonb;
  v_live_staff_access boolean := false;
begin
  if v_actor is null then
    raise exception 'Login required.' using errcode='42501';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_to < p_date_from then
    raise exception 'The end date must be on or after the start date.' using errcode='22023';
  end if;

  select demo.id, demo.auth_user_id, demo.organization_id
  into v_demo_id, v_demo_auth_user, v_demo_org
  from public.sales_demo_students demo
  where demo.id = v_requested or demo.auth_user_id = v_requested
  order by case when demo.id = v_requested then 0 else 1 end
  limit 1;

  -- A live institutional roster can legitimately contain a learner whose auth
  -- identity is also attached to a sales-demo record. For staff analytics, the
  -- live school scope must win when the signed-in actor has explicit access to
  -- that active membership. analytics_scope_organization_v20() then enforces
  -- the one-authorized-institution rule and filters attempts to that school.
  -- Student-self and platform-support demo behaviour stays unchanged.
  if v_demo_id is not null
     and v_requested = v_demo_auth_user
     and v_actor is distinct from v_demo_auth_user
     and not public.is_evidara_platform_admin() then
    select exists (
      select 1
      from public.student_school_memberships membership
      where membership.student_id = v_requested
        and membership.status = 'active'
        and public.analytics_can_view_membership_v20(membership.organization_id, membership.section_id)
    ) into v_live_staff_access;
  end if;

  if v_demo_id is not null and not v_live_staff_access then
    if not (
      v_demo_auth_user = v_actor
      or public.is_evidara_platform_admin()
      or exists (
        select 1
        from public.organization_members member
        where member.organization_id = v_demo_org
          and member.user_id = v_actor
          and member.is_active = true
          and member.member_role::text in (
            'institute_owner','institute_admin','school_owner','school_admin',
            'teacher','school_teacher','reviewer','invigilator'
          )
      )
    ) then
      raise exception 'You do not have access to this student analytics profile.' using errcode='42501';
    end if;
    if public.is_evidara_platform_admin() and v_actor is distinct from v_demo_auth_user then
      insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
      values(
        v_actor,
        v_demo_org,
        'support.analytics.view',
        'student',
        v_requested::text,
        jsonb_build_object(
          'scope','single_institution_compatibility',
          'explicit',false,
          'source','get_student_analytics_v12',
          'demo_student_id',v_demo_id
        )
      );
    end if;
    v_demo_payload := public.get_sales_demo_student_analytics_v12(v_demo_id);
    v_demo_evidence := public.get_sales_demo_student_evidence_v12(v_demo_id);
    return coalesce(v_demo_payload,'{}'::jsonb) || jsonb_build_object(
      'evidence',coalesce(v_demo_evidence,'{}'::jsonb),
      'organization_scope',v_demo_org,
      'support_scope_explicit',false
    );
  end if;

  if not public.analytics_can_view_student_v12(v_requested) then
    raise exception 'You do not have access to this student analytics profile.' using errcode='42501';
  end if;

  if public.is_evidara_platform_admin() and v_requested <> v_actor then
    select array_agg(distinct scoped.organization_id order by scoped.organization_id)
    into v_orgs
    from (
      select membership.organization_id
      from public.student_school_memberships membership
      where membership.student_id = v_requested
      union
      select attempt.organization_id
      from public.exam_attempts attempt
      where attempt.student_id = v_requested and attempt.organization_id is not null
    ) scoped;
    if coalesce(array_length(v_orgs,1),0) = 0 then
      raise exception 'Choose an institution before opening support analytics.' using errcode='42501';
    end if;
    if array_length(v_orgs,1) <> 1 then
      raise exception 'This student has history in multiple institutions. Choose one institution before opening support analytics.' using errcode='42501';
    end if;
    v_support_org := v_orgs[1];
    insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
    values(
      v_actor,
      v_support_org,
      'support.analytics.view',
      'student',
      v_requested::text,
      jsonb_build_object('scope','single_institution_compatibility','explicit',false,'source','get_student_analytics_v12')
    );
    perform set_config('evidara.analytics_scope_org',v_support_org::text,true);
  end if;

  if v_requested = v_actor then
    select attempt.paper_id
    into v_latest_paper
    from public.exam_attempts attempt
    where attempt.student_id = v_requested
      and attempt.status = 'submitted'
      and attempt.submitted_at is not null
      and (p_date_from is null or attempt.submitted_at >= p_date_from)
      and (p_date_to is null or attempt.submitted_at <= p_date_to)
      and (
        p_product_id is null
        or exists (
          select 1
          from public.product_papers product_paper
          where product_paper.product_id = p_product_id
            and product_paper.paper_id = attempt.paper_id
        )
      )
    order by attempt.submitted_at desc, attempt.id
    limit 1;
    if v_latest_paper is not null then
      v_release := public.student_result_release_state_v20(v_latest_paper,v_requested);
      if not coalesce((v_release->>'analytics_released')::boolean,false) then
        raise exception '%', coalesce(v_release->>'message','Detailed analytics has not been released yet.') using errcode='42501';
      end if;
    end if;
  end if;

  return public.get_live_student_analytics_v12(v_requested,p_product_id,p_date_from,p_date_to);
end;
$$;

revoke all on function public.get_student_analytics_v12(uuid,uuid,timestamptz,timestamptz) from public;
revoke all on function public.get_student_analytics_v12(uuid,uuid,timestamptz,timestamptz) from anon;
grant execute on function public.get_student_analytics_v12(uuid,uuid,timestamptz,timestamptz) to authenticated;
grant execute on function public.get_student_analytics_v12(uuid,uuid,timestamptz,timestamptz) to service_role;

comment on function public.get_student_analytics_v12(uuid,uuid,timestamptz,timestamptz) is
'Phase 1 R15 hardening: returns student analytics with live institution scope preferred for authorized staff when a live roster identity also exists in sales-demo data; demo/self/support behavior remains guarded.';
