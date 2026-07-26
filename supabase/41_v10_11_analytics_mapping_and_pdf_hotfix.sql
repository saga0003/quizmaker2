-- Evidara V10.11 analytics mapping and PDF hotfix
-- Run after 40b_v10_demo_cohort_statement_timeout_hotfix.sql.
--
-- Fixes PostgreSQL "record v_attempt is not assigned yet" for generated
-- students. The previous function referenced v_attempt.correct_count inside
-- the return expression even when the demo-result branch had been selected
-- and the v_attempt record had never been populated.

begin;

create or replace function public.analytics_attempt_time_snapshot_v12(
  p_paper_id uuid,
  p_student_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_demo record;
  v_attempt record;
  v_total integer:=0;
  v_attempted integer:=0;
  v_correct integer:=0;
  v_duration integer:=0;
  v_actual integer:=0;
  v_auto boolean:=false;
  v_score numeric;
begin
  select result.*,student.auth_user_id into v_demo
  from public.analytics_demo_test_results result
  join public.analytics_demo_students student on student.id=result.demo_student_id
  where result.paper_id=p_paper_id and student.auth_user_id=p_student_id
  order by result.submitted_at desc
  limit 1;

  if found then
    v_correct:=coalesce(v_demo.correct_count,0);
    v_total:=v_correct+coalesce(v_demo.incorrect_count,0)+coalesce(v_demo.unanswered_count,0);
    v_attempted:=v_correct+coalesce(v_demo.incorrect_count,0);
    v_duration:=coalesce(v_demo.duration_minutes,0);
    v_actual:=coalesce(v_demo.actual_time_seconds,0);
    v_auto:=coalesce(v_demo.ended_automatically,false);
  else
    select attempt.*,paper.duration_minutes into v_attempt
    from public.exam_attempts attempt
    join public.question_papers paper on paper.id=attempt.paper_id
    where attempt.paper_id=p_paper_id
      and attempt.student_id=p_student_id
      and attempt.status='submitted'
    order by attempt.submitted_at desc nulls last,attempt.created_at desc,attempt.id desc
    limit 1;

    if not found then return null; end if;

    v_correct:=coalesce(v_attempt.correct_count,0);
    v_total:=v_correct+coalesce(v_attempt.incorrect_count,0)+coalesce(v_attempt.unanswered_count,0);
    v_attempted:=v_correct+coalesce(v_attempt.incorrect_count,0);
    v_duration:=coalesce(v_attempt.duration_minutes,0);
    v_actual:=greatest(0,extract(epoch from (v_attempt.submitted_at-v_attempt.started_at))::integer);
    v_auto:=coalesce((v_attempt.metadata->>'ended_automatically')::boolean,false)
      or lower(coalesce(v_attempt.metadata->>'submission_reason','')) in ('timeout','auto','auto_submit','expired')
      or (v_attempt.expires_at is not null and v_attempt.submitted_at>=v_attempt.expires_at-interval '5 seconds');
  end if;

  v_score:=public.analytics_time_management_score_v12(
    v_total,
    v_attempted,
    v_correct,
    v_duration,
    v_actual,
    v_auto
  );

  return jsonb_build_object(
    'score',v_score,
    'rating',public.analytics_time_management_rating_v12(v_score),
    'total_questions',v_total,
    'attempted_questions',v_attempted,
    'correct_answers',v_correct,
    'duration_minutes',v_duration,
    'actual_time_seconds',v_actual,
    'actual_time_minutes',round(v_actual::numeric/60,1),
    'ended_automatically',v_auto,
    'insight',public.analytics_time_management_insight_v12(v_score,v_attempted,v_total,v_auto),
    'supporting_indicator',true,
    'scientific_measurement',false
  );
end;
$$;

grant execute on function public.analytics_attempt_time_snapshot_v12(uuid,uuid) to authenticated;

-- Re-apply the hardened review function so PDF/report preparation and Test
-- History always use a scalar UUID attempt id, never an uninitialised record.
create or replace function public.get_student_test_review_v12(
  p_student_id uuid,
  p_paper_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_student uuid:=coalesce(p_student_id,auth.uid());
  v_attempt_id uuid;
  v_detail jsonb;
  v_questions jsonb;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.analytics_can_view_student_v10(v_student) then
    raise exception 'You do not have access to this student answer review.' using errcode='42501';
  end if;

  v_detail:=public.get_student_test_comparison_v11(v_student,p_paper_id);

  select attempt.id into v_attempt_id
  from public.exam_attempts attempt
  where attempt.student_id=v_student
    and attempt.paper_id=p_paper_id
    and attempt.status='submitted'
  order by attempt.submitted_at desc nulls last,attempt.created_at desc,attempt.id desc
  limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'question_number',paper_question.display_order,
    'paper_question_id',paper_question.id,
    'subject_name',coalesce(subject.name,paper_section.title,paper_question.question_snapshot->>'subject_name','General'),
    'question_text',coalesce(paper_question.question_snapshot->>'stem_text',question.stem_text,'Question'),
    'question_type',coalesce(paper_question.question_snapshot->>'question_type',question.question_type::text,'single_correct'),
    'difficulty',coalesce(paper_question.question_snapshot->>'difficulty',question.difficulty::text),
    'selected_keys',coalesce(response.response,'[]'::jsonb),
    'correct_keys',coalesce(paper_question.question_snapshot->'correct_answer',question.correct_answer,'[]'::jsonb),
    'status',case when response.is_correct=true then 'correct' when response.is_correct=false then 'incorrect' else 'unanswered' end,
    'marks_awarded',coalesce(response.marks_awarded,0),
    'maximum_marks',paper_question.marks,
    'negative_marks',paper_question.negative_marks,
    'time_spent_seconds',coalesce(response.time_spent_seconds,0),
    'marked_for_review',coalesce(response.marked_for_review,false),
    'options',coalesce(paper_question.question_snapshot->'options','[]'::jsonb),
    'solution_text',coalesce(paper_question.question_snapshot->>'solution_text',question.solution_text)
  ) order by paper_question.display_order),'[]'::jsonb)
  into v_questions
  from public.paper_questions paper_question
  join public.paper_sections paper_section on paper_section.id=paper_question.section_id
  left join public.subjects subject on subject.id=paper_section.subject_id
  left join public.questions question on question.id=paper_question.question_id
  left join public.exam_responses response
    on response.paper_question_id=paper_question.id
   and response.attempt_id=v_attempt_id
  where paper_question.paper_id=p_paper_id;

  return coalesce(v_detail,'{}'::jsonb)||jsonb_build_object(
    'attempt_id',v_attempt_id,
    'questions',coalesce(v_questions,'[]'::jsonb),
    'question_count',jsonb_array_length(coalesce(v_questions,'[]'::jsonb)),
    'review_generated_at',now()
  );
end;
$$;

grant execute on function public.get_student_test_review_v12(uuid,uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(
  null,
  'analytics.v10.11.mapping_pdf_hotfix',
  'system',
  '41_v10_11_analytics_mapping_and_pdf_hotfix',
  jsonb_build_object(
    'demo_attempt_mapping_fixed',true,
    'pdf_report_fixed',true,
    'test_review_attempt_id_scalar',true
  )
);

commit;
