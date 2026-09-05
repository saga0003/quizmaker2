-- Evidara Phase 1 P0.5: close the remaining platform-admin analytics scope gap.
--
-- Goals:
-- 1. A platform-admin support read must never silently aggregate a student's data
--    across multiple institutions.
-- 2. Explicitly scoped support reads use get_student_analytics_scoped_v20().
-- 3. Every platform-admin student analytics read is written to audit_logs.
-- 4. The legacy get_student_analytics_v12() browser contract remains compatible
--    only when exactly one institution can be inferred. A transferred/multi-school
--    student must use the explicitly scoped v20 function.

create or replace function public.analytics_scope_organization_v20(p_student_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_forced_scope text := nullif(current_setting('evidara.analytics_scope_org', true), '');
  v_orgs uuid[];
  v_forced_org uuid;
begin
  if v_forced_scope is not null then
    begin
      v_forced_org := v_forced_scope::uuid;
    exception when others then
      raise exception 'Invalid analytics institution scope.' using errcode = '22023';
    end;

    -- Service work and platform support can set an explicit scope. School staff
    -- may also use it, but only when the requested student has an active
    -- membership in that institution and the actor can view that membership.
    if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
       or public.is_evidara_platform_admin() then
      return v_forced_org;
    end if;

    if exists (
      select 1
      from public.student_school_memberships membership
      where membership.student_id = p_student_id
        and membership.organization_id = v_forced_org
        and membership.status = 'active'
        and public.analytics_can_view_membership_v20(
          membership.organization_id,
          membership.section_id
        )
    ) then
      return v_forced_org;
    end if;

    raise exception 'You do not have access to the requested analytics institution scope.'
      using errcode = '42501';
  end if;

  -- A student viewing their own history may continue to see their personal
  -- cross-institution history. The service role is intentionally unscoped for
  -- trusted maintenance jobs unless a forced scope was supplied above.
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or auth.uid() = p_student_id then
    return null;
  end if;

  -- Platform support is no longer allowed an implicit cross-school scope.
  if public.is_evidara_platform_admin() then
    raise exception 'Platform support analytics requires an explicit institution scope.'
      using errcode = '42501';
  end if;

  select array_agg(distinct membership.organization_id order by membership.organization_id)
  into v_orgs
  from public.student_school_memberships membership
  where membership.student_id = p_student_id
    and membership.status = 'active'
    and public.analytics_can_view_membership_v20(
      membership.organization_id,
      membership.section_id
    );

  if coalesce(array_length(v_orgs, 1), 0) = 0 then
    raise exception 'You do not have access to this student analytics profile.'
      using errcode = '42501';
  end if;
  if array_length(v_orgs, 1) <> 1 then
    raise exception 'Choose one institution before opening this student analytics profile.'
      using errcode = '42501';
  end if;

  return v_orgs[1];
end;
$$;

revoke all on function public.analytics_scope_organization_v20(uuid) from public, anon, authenticated;
grant execute on function public.analytics_scope_organization_v20(uuid) to service_role;

create or replace function public.get_student_analytics_scoped_v20(
  p_student_id uuid,
  p_organization_id uuid,
  p_product_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null,
  p_reason text default 'support'
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
  v_demo_org uuid;
  v_demo_payload jsonb;
  v_demo_evidence jsonb;
  v_payload jsonb;
  v_membership_section uuid;
begin
  if v_actor is null then
    raise exception 'Login required.' using errcode = '42501';
  end if;
  if p_organization_id is null then
    raise exception 'Choose an institution before opening support analytics.' using errcode = '22023';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_to < p_date_from then
    raise exception 'The end date must be on or after the start date.' using errcode = '22023';
  end if;

  select demo.id, demo.organization_id
  into v_demo_id, v_demo_org
  from public.sales_demo_students demo
  where demo.id = v_requested or demo.auth_user_id = v_requested
  order by case when demo.id = v_requested then 0 else 1 end
  limit 1;

  if public.is_evidara_platform_admin() then
    if v_demo_id is not null then
      if v_demo_org is distinct from p_organization_id then
        raise exception 'This demo student belongs to another institution.' using errcode = '42501';
      end if;

      insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
      values(
        v_actor,
        p_organization_id,
        'support.analytics.view',
        'student',
        v_requested::text,
        jsonb_build_object(
          'scope', 'explicit_institution',
          'reason', left(coalesce(nullif(btrim(p_reason), ''), 'support'), 200),
          'source', 'get_student_analytics_scoped_v20',
          'demo_student_id', v_demo_id
        )
      );

      v_demo_payload := public.get_sales_demo_student_analytics_v12(v_demo_id);
      v_demo_evidence := public.get_sales_demo_student_evidence_v12(v_demo_id);
      return coalesce(v_demo_payload, '{}'::jsonb)
        || jsonb_build_object(
          'evidence', coalesce(v_demo_evidence, '{}'::jsonb),
          'organization_scope', p_organization_id,
          'support_scope_explicit', true
        );
    end if;

    if not exists (
      select 1 from public.student_school_memberships membership
      where membership.student_id = v_requested
        and membership.organization_id = p_organization_id
    ) and not exists (
      select 1 from public.exam_attempts attempt
      where attempt.student_id = v_requested
        and attempt.organization_id = p_organization_id
    ) then
      raise exception 'This student has no analytics history in the selected institution.'
        using errcode = '42501';
    end if;

    insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
    values(
      v_actor,
      p_organization_id,
      'support.analytics.view',
      'student',
      v_requested::text,
      jsonb_build_object(
        'scope', 'explicit_institution',
        'reason', left(coalesce(nullif(btrim(p_reason), ''), 'support'), 200),
        'source', 'get_student_analytics_scoped_v20'
      )
    );

    perform set_config('evidara.analytics_scope_org', p_organization_id::text, true);
    v_payload := public.get_live_student_analytics_v12(
      v_requested,
      p_product_id,
      p_date_from,
      p_date_to
    );
    return coalesce(v_payload, '{}'::jsonb)
      || jsonb_build_object(
        'organization_scope', p_organization_id,
        'support_scope_explicit', true
      );
  end if;

  -- Normal school staff can use the same explicit contract, but only for an
  -- active membership that their manager/teacher assignment can view.
  select membership.section_id
  into v_membership_section
  from public.student_school_memberships membership
  where membership.student_id = v_requested
    and membership.organization_id = p_organization_id
    and membership.status = 'active'
  order by membership.academic_year desc, membership.updated_at desc
  limit 1;

  if not found or not public.analytics_can_view_membership_v20(
    p_organization_id,
    v_membership_section
  ) then
    raise exception 'You do not have access to this student in the selected institution.'
      using errcode = '42501';
  end if;

  perform set_config('evidara.analytics_scope_org', p_organization_id::text, true);
  v_payload := public.get_live_student_analytics_v12(
    v_requested,
    p_product_id,
    p_date_from,
    p_date_to
  );
  return coalesce(v_payload, '{}'::jsonb)
    || jsonb_build_object('organization_scope', p_organization_id);
end;
$$;

revoke all on function public.get_student_analytics_scoped_v20(uuid, uuid, uuid, timestamptz, timestamptz, text) from public, anon;
grant execute on function public.get_student_analytics_scoped_v20(uuid, uuid, uuid, timestamptz, timestamptz, text) to authenticated, service_role;

-- Keep the existing browser contract safe while older UI consumers are migrated.
-- Platform admins may use it only when the student's support scope resolves to
-- exactly one institution. Multi-school/transferred students are deliberately
-- rejected and must use get_student_analytics_scoped_v20().
create or replace function public.get_student_analytics_v12(
  p_student_id uuid default auth.uid(),
  p_product_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
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
begin
  if v_actor is null then
    raise exception 'Login required.' using errcode = '42501';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_to < p_date_from then
    raise exception 'The end date must be on or after the start date.' using errcode = '22023';
  end if;

  select demo.id, demo.auth_user_id, demo.organization_id
  into v_demo_id, v_demo_auth_user, v_demo_org
  from public.sales_demo_students demo
  where demo.id = v_requested or demo.auth_user_id = v_requested
  order by case when demo.id = v_requested then 0 else 1 end
  limit 1;

  if v_demo_id is not null then
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
      raise exception 'You do not have access to this student analytics profile.' using errcode = '42501';
    end if;

    if public.is_evidara_platform_admin() and v_actor is distinct from v_demo_auth_user then
      insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
      values(
        v_actor,
        v_demo_org,
        'support.analytics.view',
        'student',
        v_requested::text,
        jsonb_build_object(
          'scope', 'single_institution_compatibility',
          'explicit', false,
          'source', 'get_student_analytics_v12',
          'demo_student_id', v_demo_id
        )
      );
    end if;

    v_demo_payload := public.get_sales_demo_student_analytics_v12(v_demo_id);
    v_demo_evidence := public.get_sales_demo_student_evidence_v12(v_demo_id);
    return coalesce(v_demo_payload, '{}'::jsonb)
      || jsonb_build_object(
        'evidence', coalesce(v_demo_evidence, '{}'::jsonb),
        'organization_scope', v_demo_org,
        'support_scope_explicit', false
      );
  end if;

  if not public.analytics_can_view_student_v12(v_requested) then
    raise exception 'You do not have access to this student analytics profile.' using errcode = '42501';
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
      where attempt.student_id = v_requested
        and attempt.organization_id is not null
    ) scoped;

    if coalesce(array_length(v_orgs, 1), 0) = 0 then
      raise exception 'Choose an institution before opening support analytics.' using errcode = '42501';
    end if;
    if array_length(v_orgs, 1) <> 1 then
      raise exception 'This student has history in multiple institutions. Choose one institution before opening support analytics.'
        using errcode = '42501';
    end if;

    v_support_org := v_orgs[1];
    insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
    values(
      v_actor,
      v_support_org,
      'support.analytics.view',
      'student',
      v_requested::text,
      jsonb_build_object(
        'scope', 'single_institution_compatibility',
        'explicit', false,
        'source', 'get_student_analytics_v12'
      )
    );
    perform set_config('evidara.analytics_scope_org', v_support_org::text, true);
  end if;

  -- Student self-view still honours result-release policy before analytics can
  -- expose derived outcome information.
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
          select 1 from public.product_papers product_paper
          where product_paper.product_id = p_product_id
            and product_paper.paper_id = attempt.paper_id
        )
      )
    order by attempt.submitted_at desc, attempt.id
    limit 1;

    if v_latest_paper is not null then
      v_release := public.student_result_release_state_v20(v_latest_paper, v_requested);
      if not coalesce((v_release ->> 'analytics_released')::boolean, false) then
        raise exception '%', coalesce(v_release ->> 'message', 'Detailed analytics has not been released yet.')
          using errcode = '42501';
      end if;
    end if;
  end if;

  return public.get_live_student_analytics_v12(
    v_requested,
    p_product_id,
    p_date_from,
    p_date_to
  );
end;
$$;

revoke all on function public.get_student_analytics_v12(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_student_analytics_v12(uuid, uuid, timestamptz, timestamptz) to authenticated, service_role;

comment on function public.get_student_analytics_scoped_v20(uuid, uuid, uuid, timestamptz, timestamptz, text)
is 'Phase 1 explicit institution-scoped student analytics contract. Platform support reads are audited.';
