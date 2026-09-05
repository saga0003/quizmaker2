-- Phase 1 D6 foundation: one server-authoritative publish-readiness contract.

create or replace function public.paper_publish_readiness_internal_v1(p_paper_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_paper public.question_papers%rowtype;
  v_question_count integer := 0;
  v_unapproved_count integer := 0;
  v_invalid_marks_count integer := 0;
  v_mark_sum numeric := 0;
  v_assignment_count integer := 0;
  v_profile_count integer := 0;
  v_profile_materialized timestamptz;
  v_checks jsonb := '[]'::jsonb;
  v_ready boolean := true;
  v_ok boolean;
begin
  select * into v_paper from public.question_papers where id=p_paper_id;
  if not found then
    return jsonb_build_object(
      'paper_id',p_paper_id,
      'ready',false,
      'checks',jsonb_build_array(jsonb_build_object('code','paper','label','Paper exists','ok',false,'message','Paper not found.'))
    );
  end if;

  select
    count(*)::integer,
    count(*) filter(where q.id is null or q.status::text <> 'approved')::integer,
    count(*) filter(where pq.marks <= 0 or pq.negative_marks < 0 or pq.negative_marks > pq.marks)::integer,
    coalesce(sum(pq.marks),0)
  into v_question_count,v_unapproved_count,v_invalid_marks_count,v_mark_sum
  from public.paper_questions pq
  left join public.questions q on q.id=pq.question_id
  where pq.paper_id=p_paper_id;

  v_ok := v_question_count > 0 and v_unapproved_count = 0;
  v_ready := v_ready and v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'code','approved_questions','label','Approved questions','ok',v_ok,
    'message',case when v_ok then format('%s approved question(s) linked.',v_question_count)
      else format('%s question(s) linked; %s missing or not approved.',v_question_count,v_unapproved_count) end
  ));

  v_ok := v_paper.duration_minutes > 0;
  v_ready := v_ready and v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'code','duration','label','Duration','ok',v_ok,
    'message',case when v_ok then format('%s minute duration.',v_paper.duration_minutes) else 'Duration must be at least one minute.' end
  ));

  v_ok := v_question_count > 0 and v_invalid_marks_count = 0 and v_mark_sum > 0
    and v_paper.total_marks = v_mark_sum and v_paper.total_questions = v_question_count;
  v_ready := v_ready and v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'code','marks','label','Marks','ok',v_ok,
    'message',case when v_ok then format('%s total marks across %s question(s).',v_mark_sum,v_question_count)
      else format('Marks are inconsistent: total=%s, linked=%s, invalid marking rows=%s.',v_mark_sum,v_question_count,v_invalid_marks_count) end
  ));

  if v_paper.organization_id is null then
    v_ok := true;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','audience','label','Audience','ok',true,'message','Platform/public paper does not require an institution assignment cohort.'
    ));
  else
    select count(*)::integer into v_assignment_count
    from public.paper_student_assignments
    where paper_id=p_paper_id and status='assigned';

    select coalesce(assigned_count,0),materialized_at
    into v_profile_count,v_profile_materialized
    from public.paper_assignment_profiles
    where paper_id=p_paper_id;

    if not found then
      v_profile_count := 0;
      v_profile_materialized := null;
    end if;

    v_ok := v_assignment_count > 0 and v_profile_count > 0 and v_profile_materialized is not null
      and v_assignment_count = v_profile_count;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object(
      'code','audience','label','Audience','ok',v_ok,
      'message',case when v_ok then format('%s student(s) are materialized in the frozen audience.',v_assignment_count)
        else format('Assign an eligible audience before publishing (profile=%s, materialized assignments=%s).',v_profile_count,v_assignment_count) end
    ));
  end if;
  v_ready := v_ready and v_ok;

  v_ok := v_paper.open_forever
    or (v_paper.available_from is not null and v_paper.available_until is not null and v_paper.available_until > v_paper.available_from);
  v_ready := v_ready and v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'code','schedule','label','Schedule','ok',v_ok,
    'message',case when v_paper.open_forever then 'Open-forever schedule selected.'
      when v_ok then format('Scheduled from %s to %s.',v_paper.available_from,v_paper.available_until)
      else 'A scheduled paper needs both opening and closing times, with closing after opening.' end
  ));

  v_ok := v_paper.result_mode::text in ('hidden','score_only','score_and_answers','in_depth_analytics','after_close');
  v_ready := v_ready and v_ok;
  v_checks := v_checks || jsonb_build_array(jsonb_build_object(
    'code','result_policy','label','Result policy','ok',v_ok,
    'message',case when v_ok then format('Result release mode: %s.',replace(v_paper.result_mode::text,'_',' ')) else 'Choose a supported result-release policy.' end
  ));

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'organization_id',v_paper.organization_id,
    'ready',v_ready,
    'checks',v_checks
  );
end;
$function$;

comment on function public.paper_publish_readiness_internal_v1(uuid) is
  'Internal D6 readiness evaluator covering approved questions, duration, marks, audience, schedule and result policy.';

revoke all on function public.paper_publish_readiness_internal_v1(uuid) from public, anon, authenticated;
grant execute on function public.paper_publish_readiness_internal_v1(uuid) to service_role;

create or replace function public.get_paper_publish_readiness_v1(p_paper_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.question_papers where id=p_paper_id;
  if not found then raise exception 'Paper not found.' using errcode='22023'; end if;

  if auth.uid() is null and coalesce(auth.jwt()->>'role','') <> 'service_role' then
    raise exception 'Login required.' using errcode='42501';
  end if;
  if coalesce(auth.jwt()->>'role','') <> 'service_role' and not public.can_manage_v8_papers(v_org) then
    raise exception 'Paper-builder permission required.' using errcode='42501';
  end if;

  return public.paper_publish_readiness_internal_v1(p_paper_id);
end;
$function$;

comment on function public.get_paper_publish_readiness_v1(uuid) is
  'D6 authorized pre-publish checklist for the paper builder.';

revoke all on function public.get_paper_publish_readiness_v1(uuid) from public, anon;
grant execute on function public.get_paper_publish_readiness_v1(uuid) to authenticated, service_role;

create or replace function public.enforce_paper_publish_readiness_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_result jsonb;
  v_failed text;
begin
  if new.status::text <> 'published' then return new; end if;
  v_result := public.paper_publish_readiness_internal_v1(new.id);
  if not coalesce((v_result->>'ready')::boolean,false) then
    select string_agg(coalesce(item->>'label',item->>'code'),', ' order by ord)
      into v_failed
    from jsonb_array_elements(coalesce(v_result->'checks','[]'::jsonb)) with ordinality as t(item,ord)
    where not coalesce((item->>'ok')::boolean,false);
    raise exception 'Paper is not ready to publish. Fix: %.',coalesce(v_failed,'publish checklist') using errcode='23514';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_paper_publish_readiness_v1() from public, anon, authenticated;
grant execute on function public.enforce_paper_publish_readiness_v1() to service_role;

drop trigger if exists trg_phase1_paper_publish_readiness on public.question_papers;
create constraint trigger trg_phase1_paper_publish_readiness
after insert or update on public.question_papers
deferrable initially deferred
for each row
when (new.status::text='published')
execute function public.enforce_paper_publish_readiness_v1();