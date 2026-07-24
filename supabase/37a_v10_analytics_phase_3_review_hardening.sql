-- Evidara V10 Analytics Phase 3 question-review hardening
-- Run immediately after 37_v10_analytics_phase_3.sql.

begin;

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
  v_attempt uuid;
  v_detail jsonb;
  v_questions jsonb;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.analytics_can_view_student_v10(v_student) then
    raise exception 'You do not have access to this student answer review.' using errcode='42501';
  end if;

  v_detail:=public.get_student_test_comparison_v11(v_student,p_paper_id);

  select attempt.id into v_attempt
  from public.exam_attempts attempt
  where attempt.student_id=v_student and attempt.paper_id=p_paper_id and attempt.status='submitted'
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
    'selected_answer',coalesce((
      select string_agg(coalesce(option_row.value->>'option_key','')||'. '||coalesce(option_row.value->>'content_text',''),'; ' order by coalesce((option_row.value->>'display_order')::integer,0))
      from jsonb_array_elements(coalesce(paper_question.question_snapshot->'options','[]'::jsonb)) as option_row(value)
      where option_row.value->>'option_key' in (
        select selected.value from jsonb_array_elements_text(coalesce(response.response,'[]'::jsonb)) as selected(value)
      )
    ),case when response.response is null then 'Not answered' else response.response::text end),
    'correct_keys',coalesce(paper_question.question_snapshot->'correct_answer',question.correct_answer,'[]'::jsonb),
    'correct_answer',coalesce((
      select string_agg(coalesce(option_row.value->>'option_key','')||'. '||coalesce(option_row.value->>'content_text',''),'; ' order by coalesce((option_row.value->>'display_order')::integer,0))
      from jsonb_array_elements(coalesce(paper_question.question_snapshot->'options','[]'::jsonb)) as option_row(value)
      where option_row.value->>'option_key' in (
        select correct.value from jsonb_array_elements_text(coalesce(paper_question.question_snapshot->'correct_answer',question.correct_answer,'[]'::jsonb)) as correct(value)
      )
    ),coalesce(paper_question.question_snapshot->'correct_answer',question.correct_answer,'[]'::jsonb)::text),
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
  left join public.exam_responses response on response.paper_question_id=paper_question.id and response.attempt_id=v_attempt
  where paper_question.paper_id=p_paper_id;

  return coalesce(v_detail,'{}'::jsonb)||jsonb_build_object(
    'attempt_id',v_attempt,
    'questions',coalesce(v_questions,'[]'::jsonb),
    'question_count',jsonb_array_length(coalesce(v_questions,'[]'::jsonb)),
    'review_generated_at',now()
  );
end;
$$;

grant execute on function public.get_student_test_review_v12(uuid,uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.phase3.review_hardened','system','37a_v10_analytics_phase_3_review_hardening',
  jsonb_build_object('selected_answer_labels',true,'correct_answer_labels',true,'question_table',true));

commit;
