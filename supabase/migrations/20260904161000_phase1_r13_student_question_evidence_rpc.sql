create or replace function public.get_student_own_question_evidence_v12()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid := auth.uid();
  v_evidence jsonb;
begin
  if v_actor is null then
    raise exception 'Login required.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(evidence_row) order by evidence_row.submitted_at, evidence_row.question_no), '[]'::jsonb)
  into v_evidence
  from (
    select
      er.id::text as response_id,
      a.id::text as attempt_id,
      a.paper_id::text as paper_id,
      p.title as paper_title,
      a.submitted_at,
      q.id::text as question_id,
      pq.display_order as question_no,
      coalesce(nullif(q.stem_text, ''), nullif(pq.question_snapshot ->> 'stem_text', ''), 'Question ' || pq.display_order::text) as question_text,
      coalesce(q.difficulty::text, 'unknown') as difficulty,
      coalesce(q.subject_id, ps.subject_id)::text as subject_id,
      coalesce(s.name, 'Subject') as subject_name,
      q.chapter_id::text as chapter_id,
      coalesce(c.name, 'Chapter') as chapter_name,
      q.topic_id::text as topic_id,
      coalesce(t.name, 'Topic') as topic_name,
      case
        when er.response is null or er.response = '{}'::jsonb then 'unanswered'
        when er.is_correct is true then 'correct'
        when er.is_correct is false then 'incorrect'
        else 'unanswered'
      end as outcome,
      coalesce(pq.marks, q.marks, 0)::numeric as marks,
      coalesce(pq.negative_marks, q.negative_marks, 0)::numeric as negative_marks,
      coalesce(er.marks_awarded, 0)::numeric as marks_awarded,
      er.time_spent_seconds
    from public.exam_attempts a
    join public.question_papers p on p.id = a.paper_id
    join public.exam_responses er on er.attempt_id = a.id
    join public.paper_questions pq on pq.id = er.paper_question_id and pq.paper_id = a.paper_id
    left join public.paper_sections ps on ps.id = pq.section_id
    join public.questions q on q.id = pq.question_id
    left join public.subjects s on s.id = coalesce(q.subject_id, ps.subject_id)
    left join public.chapters c on c.id = q.chapter_id
    left join public.topics t on t.id = q.topic_id
    where a.student_id = v_actor
      and a.status = 'submitted'
      and a.submitted_at is not null
      and coalesce((public.student_result_release_state_v20(a.paper_id, v_actor) ->> 'analytics_released')::boolean, false)
  ) evidence_row;

  return v_evidence;
end;
$$;

revoke all on function public.get_student_own_question_evidence_v12() from public;
revoke all on function public.get_student_own_question_evidence_v12() from anon;
grant execute on function public.get_student_own_question_evidence_v12() to authenticated;

comment on function public.get_student_own_question_evidence_v12() is
'R13/F10: returns only the authenticated learner own submitted question-response evidence for papers whose detailed analytics are currently released. No cross-student parameter is accepted.';
