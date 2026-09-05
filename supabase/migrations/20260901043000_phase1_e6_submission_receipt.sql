-- Phase 1 E6: replay-safe final submission with durable server receipt.
-- The existing submit path already serializes per-attempt submission via FOR UPDATE.
-- This revision persists a stable receipt identity on the attempt so retries return
-- the same confirmation rather than creating a second logical submission.

create or replace function public.submit_exam_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
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
  v_receipt_id uuid;
  v_submission_confirmed_at timestamptz;
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
      if v_response is null or v_response = 'null'::jsonb or v_response = '[]'::jsonb or v_response = '\"\"'::jsonb then
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

    v_receipt_id := gen_random_uuid();
    v_submission_confirmed_at := now();

    update public.exam_attempts
      set status = 'submitted',
          submitted_at = v_submission_confirmed_at,
          score = v_score,
          percentage = v_percentage,
          correct_count = v_correct_count,
          incorrect_count = v_incorrect,
          unanswered_count = v_unanswered,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
            'submission_receipt_id', v_receipt_id::text,
            'submission_receipt_version', 1,
            'submission_confirmed_at', v_submission_confirmed_at
          )
    where id = v_attempt.id
    returning * into v_attempt;
  else
    begin
      v_receipt_id := nullif(v_attempt.metadata->>'submission_receipt_id', '')::uuid;
    exception when invalid_text_representation then
      v_receipt_id := null;
    end;

    if v_receipt_id is null then
      -- Legacy submitted attempts receive one durable receipt on first replay.
      v_receipt_id := gen_random_uuid();
      v_submission_confirmed_at := coalesce(v_attempt.submitted_at, now());
      update public.exam_attempts
        set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'submission_receipt_id', v_receipt_id::text,
          'submission_receipt_version', 1,
          'submission_confirmed_at', v_submission_confirmed_at
        )
      where id = v_attempt.id
      returning * into v_attempt;
    end if;
  end if;

  if v_receipt_id is null then
    begin
      v_receipt_id := nullif(v_attempt.metadata->>'submission_receipt_id', '')::uuid;
    exception when invalid_text_representation then
      v_receipt_id := null;
    end;
  end if;
  v_submission_confirmed_at := coalesce(
    nullif(v_attempt.metadata->>'submission_confirmed_at', '')::timestamptz,
    v_attempt.submitted_at
  );

  v_release := public.student_result_release_level(v_attempt.paper_id, v_attempt.student_id);
  v_released := v_release in ('score', 'answers', 'analytics');

  return jsonb_build_object(
    'attempt_id', v_attempt.id,
    'paper_id', v_attempt.paper_id,
    'paper_title', v_paper.title,
    'status', v_attempt.status,
    'submission_receipt_id', v_receipt_id,
    'submission_confirmed_at', v_submission_confirmed_at,
    'submission_receipt', jsonb_build_object(
      'receipt_id', v_receipt_id,
      'attempt_id', v_attempt.id,
      'paper_id', v_attempt.paper_id,
      'paper_title', v_paper.title,
      'submitted_at', v_attempt.submitted_at,
      'confirmed_at', v_submission_confirmed_at,
      'status', 'confirmed'
    ),
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
$function$;

revoke all on function public.submit_exam_attempt(uuid) from public;
revoke all on function public.submit_exam_attempt(uuid) from anon;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;
