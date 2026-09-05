-- Phase 1 P0.4: authoritative student result-release policy.
-- Student-facing RPCs must never expose score/answers/analytics before the paper policy permits it.

create or replace function public.student_result_release_level(
  p_paper_id uuid,
  p_student_id uuid default auth.uid()
)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_mode text;
  v_until timestamptz;
begin
  if auth.uid() is null and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Login required.' using errcode = '42501';
  end if;

  select p.result_mode::text, p.available_until
    into v_mode, v_until
  from public.question_papers p
  where p.id = p_paper_id;

  if not found then
    raise exception 'Paper not found.';
  end if;

  return case
    when v_mode = 'hidden' then 'none'
    when v_mode = 'score_only' then 'score'
    when v_mode = 'score_and_answers' then 'answers'
    when v_mode = 'in_depth_analytics' then 'analytics'
    when v_mode = 'after_close' and v_until is not null and now() >= v_until then 'analytics'
    else 'none'
  end;
end;
$$;

revoke all on function public.student_result_release_level(uuid, uuid) from public, anon;
grant execute on function public.student_result_release_level(uuid, uuid) to authenticated, service_role;

create or replace function public.submit_exam_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_paper public.question_papers%rowtype;
  v_item record;
  v_response jsonb;
  v_correct boolean;
  v_score numeric(10,2) := 0;
  v_correct_count integer := 0;
  v_incorrect integer := 0;
  v_unanswered integer := 0;
  v_percentage numeric(8,2) := 0;
  v_release text;
  v_released boolean;
begin
  select * into v_attempt
  from public.exam_attempts
  where id = p_attempt_id and student_id = auth.uid()
  for update;
  if not found then raise exception 'Attempt not found.'; end if;

  select * into v_paper from public.question_papers where id = v_attempt.paper_id;
  if not found then raise exception 'Paper not found.'; end if;

  if v_attempt.status <> 'submitted' then
    for v_item in
      select pq.id, pq.marks, pq.negative_marks,
        (pq.question_snapshot->>'question_type')::public.question_type as question_type,
        pq.question_snapshot->'correct_answer' as expected,
        r.response
      from public.paper_questions pq
      left join public.exam_responses r
        on r.paper_question_id = pq.id and r.attempt_id = v_attempt.id
      where pq.paper_id = v_attempt.paper_id
    loop
      v_response := v_item.response;
      if v_response is null or v_response = 'null'::jsonb or v_response = '[]'::jsonb or v_response = '""'::jsonb then
        v_unanswered := v_unanswered + 1;
        update public.exam_responses
          set is_correct = null, marks_awarded = 0
        where attempt_id = v_attempt.id and paper_question_id = v_item.id;
      else
        v_correct := public.answer_matches(v_item.expected, v_response, v_item.question_type);
        if v_correct then
          v_correct_count := v_correct_count + 1;
          v_score := v_score + v_item.marks;
        else
          v_incorrect := v_incorrect + 1;
          v_score := v_score - v_item.negative_marks;
        end if;
        update public.exam_responses
          set is_correct = v_correct,
              marks_awarded = case when v_correct then v_item.marks else -v_item.negative_marks end
        where attempt_id = v_attempt.id and paper_question_id = v_item.id;
      end if;
    end loop;

    if v_attempt.maximum_marks > 0 then
      v_percentage := round((v_score / v_attempt.maximum_marks) * 100, 2);
    end if;

    update public.exam_attempts
      set status = 'submitted', submitted_at = now(), score = v_score, percentage = v_percentage,
          correct_count = v_correct_count, incorrect_count = v_incorrect, unanswered_count = v_unanswered
    where id = v_attempt.id
    returning * into v_attempt;
  end if;

  v_release := public.student_result_release_level(v_attempt.paper_id, v_attempt.student_id);
  v_released := v_release in ('score', 'answers', 'analytics');

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'paper_id', v_attempt.paper_id,
    'paper_title', v_paper.title,
    'status', v_attempt.status,
    'score', case when v_released then v_attempt.score else null end,
    'maximum_marks', case when v_released then v_attempt.maximum_marks else null end,
    'percentage', case when v_released then v_attempt.percentage else null end,
    'correct_count', case when v_released then v_attempt.correct_count else null end,
    'incorrect_count', case when v_released then v_attempt.incorrect_count else null end,
    'unanswered_count', case when v_released then v_attempt.unanswered_count else null end,
    'started_at', v_attempt.started_at,
    'submitted_at', v_attempt.submitted_at,
    'result_mode', v_paper.result_mode,
    'result_release_level', v_release,
    'result_released', v_released,
    'answers_released', v_release in ('answers', 'analytics'),
    'analytics_released', v_release = 'analytics',
    'available_until', v_paper.available_until
  );
end;
$$;

revoke all on function public.submit_exam_attempt(uuid) from public, anon;
grant execute on function public.submit_exam_attempt(uuid) to authenticated, service_role;

create or replace function public.list_my_attempt_results()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id', a.id,
    'paper_id', a.paper_id,
    'paper_title', p.title,
    'status', a.status,
    'score', case when release.level in ('score','answers','analytics') then a.score else null end,
    'maximum_marks', case when release.level in ('score','answers','analytics') then a.maximum_marks else null end,
    'percentage', case when release.level in ('score','answers','analytics') then a.percentage else null end,
    'correct_count', case when release.level in ('score','answers','analytics') then a.correct_count else null end,
    'incorrect_count', case when release.level in ('score','answers','analytics') then a.incorrect_count else null end,
    'unanswered_count', case when release.level in ('score','answers','analytics') then a.unanswered_count else null end,
    'started_at', a.started_at,
    'submitted_at', a.submitted_at,
    'result_mode', p.result_mode,
    'result_release_level', release.level,
    'result_released', release.level in ('score','answers','analytics'),
    'answers_released', release.level in ('answers','analytics'),
    'analytics_released', release.level = 'analytics',
    'available_until', p.available_until
  ) order by a.created_at desc), '[]'::jsonb)
  from public.exam_attempts a
  join public.question_papers p on p.id = a.paper_id
  cross join lateral (
    select public.student_result_release_level(a.paper_id, a.student_id) as level
  ) release
  where a.student_id = auth.uid();
$$;

revoke all on function public.list_my_attempt_results() from public, anon;
grant execute on function public.list_my_attempt_results() to authenticated, service_role;

create or replace function public.get_student_test_review_v12(p_student_id uuid, p_paper_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_student uuid := coalesce(p_student_id, auth.uid());
  v_attempt_id uuid;
  v_detail jsonb;
  v_questions jsonb;
  v_release text;
begin
  if auth.uid() is null then raise exception 'Login required.' using errcode='42501'; end if;
  if not public.analytics_can_view_student_v12(v_student) then
    raise exception 'You do not have access to this student answer review.' using errcode='42501';
  end if;

  -- Result-release policy is a student-facing restriction. Authorised staff can
  -- review evidence internally, while the student cannot bypass the UI.
  if auth.uid() = v_student then
    v_release := public.student_result_release_level(p_paper_id, v_student);
    if v_release not in ('answers', 'analytics') then
      raise exception 'Answers and solutions have not been released for this assessment.' using errcode='42501';
    end if;
  end if;

  v_detail := public.get_student_test_comparison_v11(v_student, p_paper_id);

  select attempt.id into v_attempt_id
  from public.exam_attempts attempt
  where attempt.student_id = v_student
    and attempt.paper_id = p_paper_id
    and attempt.status = 'submitted'
  order by attempt.submitted_at desc nulls last, attempt.created_at desc, attempt.id desc
  limit 1;

  if v_attempt_id is null then raise exception 'No submitted attempt was found for this paper.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'question_number', paper_question.display_order,
    'paper_question_id', paper_question.id,
    'subject_name', coalesce(subject.name, paper_section.title, paper_question.question_snapshot->>'subject_name', 'General'),
    'question_text', coalesce(paper_question.question_snapshot->>'stem_text', question.stem_text, 'Question'),
    'question_type', coalesce(paper_question.question_snapshot->>'question_type', question.question_type::text, 'single_correct'),
    'difficulty', coalesce(paper_question.question_snapshot->>'difficulty', question.difficulty::text),
    'selected_keys', coalesce(response.response, '[]'::jsonb),
    'correct_keys', coalesce(paper_question.question_snapshot->'correct_answer', question.correct_answer, '[]'::jsonb),
    'status', case when response.is_correct = true then 'correct' when response.is_correct = false then 'incorrect' else 'unanswered' end,
    'marks_awarded', coalesce(response.marks_awarded, 0),
    'maximum_marks', paper_question.marks,
    'negative_marks', paper_question.negative_marks,
    'time_spent_seconds', coalesce(response.time_spent_seconds, 0),
    'marked_for_review', coalesce(response.marked_for_review, false),
    'options', coalesce(paper_question.question_snapshot->'options', '[]'::jsonb),
    'solution_text', coalesce(paper_question.question_snapshot->>'solution_text', question.solution_text)
  ) order by paper_question.display_order), '[]'::jsonb)
  into v_questions
  from public.paper_questions paper_question
  join public.paper_sections paper_section on paper_section.id = paper_question.section_id
  left join public.subjects subject on subject.id = paper_section.subject_id
  left join public.questions question on question.id = paper_question.question_id
  left join public.exam_responses response
    on response.paper_question_id = paper_question.id and response.attempt_id = v_attempt_id
  where paper_question.paper_id = p_paper_id;

  return coalesce(v_detail, '{}'::jsonb) || jsonb_build_object(
    'attempt_id', v_attempt_id,
    'questions', coalesce(v_questions, '[]'::jsonb),
    'question_count', jsonb_array_length(coalesce(v_questions, '[]'::jsonb)),
    'review_generated_at', now()
  );
end;
$$;

revoke all on function public.get_student_test_review_v12(uuid, uuid) from public, anon;
grant execute on function public.get_student_test_review_v12(uuid, uuid) to authenticated, service_role;

create or replace function public.list_post_test_reflection_queue_v13(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_release text;
begin
  select * into v_attempt from public.exam_attempts where id = p_attempt_id;
  if not found or v_attempt.student_id <> auth.uid() then raise exception 'Not allowed' using errcode='42501'; end if;
  if v_attempt.status <> 'submitted' then raise exception 'Attempt is not submitted'; end if;

  v_release := public.student_result_release_level(v_attempt.paper_id, v_attempt.student_id);
  if v_release not in ('answers', 'analytics') then
    raise exception 'Post-test reflection is available after answers are released.' using errcode='42501';
  end if;

  return jsonb_build_object('attempt_id', p_attempt_id, 'items', coalesce((
    select jsonb_agg(jsonb_build_object(
      'response_id', r.id,
      'paper_question_id', r.paper_question_id,
      'is_correct', coalesce(r.is_correct, false),
      'is_skipped', (r.response is null),
      'time_spent_seconds', r.time_spent_seconds,
      'classification', c.classification,
      'confidence_rating', c.confidence_rating,
      'note', c.note
    ) order by r.saved_at)
    from public.exam_responses r
    left join public.exam_response_self_classifications c on c.response_id = r.id
    where r.attempt_id = p_attempt_id
  ), '[]'::jsonb));
end;
$$;

revoke all on function public.list_post_test_reflection_queue_v13(uuid) from public, anon;
grant execute on function public.list_post_test_reflection_queue_v13(uuid) to authenticated, service_role;

-- The raw analytics engine is an implementation detail. Students and staff use
-- get_student_analytics_v12, which applies caller-specific policy before invoking it.
revoke all on function public.get_live_student_analytics_v12(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_live_student_analytics_v12(uuid, uuid, timestamptz, timestamptz) to service_role;

create or replace function public.get_student_analytics_v12(
  p_student_id uuid default auth.uid(),
  p_product_id uuid default null,
  p_date_from timestamptz default null,
  p_date_to timestamptz default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_requested uuid := coalesce(p_student_id, auth.uid());
  v_demo public.sales_demo_students%rowtype;
  v_actor_role text;
  v_authorized boolean := false;
  v_payload jsonb;
  v_has_restricted boolean := false;
begin
  if auth.uid() is null and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Login required.' using errcode='42501';
  end if;

  select s.* into v_demo
  from public.sales_demo_students s
  where s.id = v_requested or s.auth_user_id = v_requested
  limit 1;

  if v_demo.id is not null then
    select p.role::text into v_actor_role from public.profiles p where p.id = auth.uid();
    v_authorized :=
      coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
      or v_demo.auth_user_id = auth.uid()
      or v_actor_role in ('super_admin', 'evidara_admin')
      or exists (
        select 1 from public.organization_members m
        where m.user_id = auth.uid()
          and m.organization_id = v_demo.organization_id
          and m.is_active = true
          and m.member_role::text in ('institute_owner','institute_admin','school_owner','school_admin','teacher','school_teacher','reviewer','invigilator')
      );
    if not v_authorized then
      raise exception 'You do not have access to this student analytics profile.' using errcode='42501';
    end if;
    v_payload := public.get_sales_demo_student_analytics_v12(v_demo.id, p_date_from, p_date_to);
    return coalesce(v_payload, '{}'::jsonb) || jsonb_build_object(
      'question_evidence', public.get_sales_demo_question_evidence_v12(v_demo.id, p_date_from, p_date_to)
    );
  end if;

  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     and not public.analytics_can_view_student_v12(v_requested) then
    raise exception 'You do not have access to this student analytics profile.' using errcode='42501';
  end if;

  -- The existing V12 aggregate engine is all-or-nothing across its selected date
  -- range. Until P0.5/P0.6 replace it with organization/snapshot-scoped facts,
  -- fail closed for student self-service if any included attempt is not allowed
  -- to contribute to in-depth analytics. Authorised staff remain unaffected.
  if auth.uid() = v_requested then
    select exists (
      select 1
      from public.exam_attempts a
      join public.question_papers p on p.id = a.paper_id
      where a.student_id = v_requested
        and a.status = 'submitted'
        and a.submitted_at is not null
        and (p_date_from is null or a.submitted_at >= p_date_from)
        and (p_date_to is null or a.submitted_at <= p_date_to)
        and (p_product_id is null or exists (
          select 1 from public.product_papers pp where pp.product_id = p_product_id and pp.paper_id = a.paper_id
        ))
        and public.student_result_release_level(a.paper_id, v_requested) <> 'analytics'
    ) into v_has_restricted;

    if v_has_restricted then
      raise exception 'Detailed analytics contains assessment evidence that has not been released by your institution.' using errcode='42501';
    end if;
  end if;

  return public.get_live_student_analytics_v12(v_requested, p_product_id, p_date_from, p_date_to);
end;
$$;

revoke all on function public.get_student_analytics_v12(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_student_analytics_v12(uuid, uuid, timestamptz, timestamptz) to authenticated, service_role;
