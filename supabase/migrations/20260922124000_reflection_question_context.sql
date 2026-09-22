create or replace function public.list_post_test_reflection_queue_v13(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_release jsonb;
  v_answers_released boolean := false;
  v_shuffle_options boolean := false;
begin
  select * into v_attempt
  from public.exam_attempts
  where id=p_attempt_id;

  if not found or v_attempt.student_id<>auth.uid() then raise exception 'Not allowed'; end if;
  if v_attempt.status<>'submitted' then raise exception 'Attempt is not submitted'; end if;

  select coalesce(paper.shuffle_options,false) into v_shuffle_options
  from public.question_papers paper where paper.id=v_attempt.paper_id;

  v_release := public.student_result_release_state_v20(v_attempt.paper_id,v_attempt.student_id);
  v_answers_released := coalesce((v_release->>'answers_released')::boolean,false);

  return jsonb_build_object(
    'attempt_id',p_attempt_id,
    'answers_released',v_answers_released,
    'shuffle_options',v_shuffle_options,
    'items',coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'response_id',r.id,
          'paper_question_id',r.paper_question_id,
          'question_number',coalesce(array_position(v_attempt.question_order,r.paper_question_id),pq.display_order + 1),
          'question_type',pq.question_snapshot->>'question_type',
          'stem_text',pq.question_snapshot->>'stem_text',
          'stem_latex',pq.question_snapshot->>'stem_latex',
          'passage_text',pq.question_snapshot->>'passage_text',
          'question_image_url',pq.question_snapshot->>'question_image_url',
          'options',case
            when v_answers_released then coalesce(pq.question_snapshot->'options','[]'::jsonb)
            else coalesce((select jsonb_agg(opt - 'is_correct' order by coalesce((opt->>'display_order')::integer,0)) from jsonb_array_elements(coalesce(pq.question_snapshot->'options','[]'::jsonb)) opt),'[]'::jsonb)
          end,
          'response',r.response,
          'correct_answer',case when v_answers_released then pq.question_snapshot->'correct_answer' else null end,
          'answers_released',v_answers_released,
          'shuffle_options',v_shuffle_options,
          'is_correct',coalesce(r.is_correct,false),
          'is_skipped',(r.response is null),
          'time_spent_seconds',r.time_spent_seconds,
          'classification',c.classification,
          'confidence_rating',c.confidence_rating,
          'note',c.note
        ) order by coalesce(array_position(v_attempt.question_order,r.paper_question_id),pq.display_order + 1)
      )
      from public.exam_responses r
      join public.paper_questions pq on pq.id=r.paper_question_id
      left join public.exam_response_self_classifications c on c.response_id=r.id
      where r.attempt_id=p_attempt_id
    ),'[]'::jsonb)
  );
end $$;

revoke all on function public.list_post_test_reflection_queue_v13(uuid) from public;
grant execute on function public.list_post_test_reflection_queue_v13(uuid) to authenticated;
