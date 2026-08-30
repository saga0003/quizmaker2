create or replace function public.get_v13_benchmark_analytics(
  p_student_no integer default 5000,
  p_run_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_run_id uuid;
  v_result jsonb;
begin
  if auth.uid() is null and coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception 'Login required.';
  end if;

  select coalesce(p_run_id, id)
    into v_run_id
  from public.v13_benchmark_runs
  where p_run_id is null or id = p_run_id
  order by created_at desc
  limit 1;

  if v_run_id is null then
    return null;
  end if;

  if not exists (
    select 1 from public.v13_benchmark_students
    where run_id = v_run_id and student_no = p_student_no
  ) then
    raise exception 'Benchmark student % does not exist for this run.', p_student_no;
  end if;

  with student_result as (
    select *
    from public.v13_benchmark_student_results
    where run_id = v_run_id and student_no = p_student_no
  ),
  response_facts as (
    select r.*, q.subject_name, q.chapter_name, q.topic_name, q.sub_concept,
      q.difficulty, q.expected_seconds,
      case when r.is_correct = true then 1 else 0 end as correct,
      case when r.is_correct = false and not r.is_skipped then 1 else 0 end as incorrect,
      case when r.is_skipped then 1 else 0 end as unanswered
    from public.v13_benchmark_responses r
    join public.v13_benchmark_questions q
      on q.run_id = r.run_id and q.question_no = r.question_no
    where r.run_id = v_run_id and r.student_no = p_student_no
  ),
  level_rows as (
    select 'subject'::text as level, subject_name as name,
      null::text as parent_name, subject_name,
      count(*)::integer as questions,
      count(*) filter (where not is_skipped)::integer as attempts,
      sum(correct)::integer as correct,
      sum(incorrect)::integer as incorrect,
      sum(unanswered)::integer as unanswered,
      round(100.0 * sum(correct) / nullif(sum(correct + incorrect), 0), 1) as accuracy,
      round(100.0 * sum(marks_awarded) / nullif(count(*) * 4, 0), 1) as average_percentage,
      round(avg(time_spent_seconds)::numeric, 1) as average_seconds,
      round(avg(expected_seconds)::numeric, 1) as cohort_median_seconds,
      round(avg(time_spent_seconds)::numeric / nullif(avg(expected_seconds), 0), 2) as pace_ratio,
      jsonb_agg(jsonb_build_object(
        'difficulty', difficulty,
        'questions', 1,
        'accuracy', case when is_correct then 100 else 0 end,
        'average_seconds', time_spent_seconds,
        'correct', correct,
        'incorrect', incorrect,
        'unanswered', unanswered
      )) as raw_difficulty
    from response_facts group by subject_name

    union all

    select 'chapter', chapter_name, subject_name, subject_name,
      count(*)::integer,
      count(*) filter (where not is_skipped)::integer,
      sum(correct)::integer,
      sum(incorrect)::integer,
      sum(unanswered)::integer,
      round(100.0 * sum(correct) / nullif(sum(correct + incorrect), 0), 1),
      round(100.0 * sum(marks_awarded) / nullif(count(*) * 4, 0), 1),
      round(avg(time_spent_seconds)::numeric, 1),
      round(avg(expected_seconds)::numeric, 1),
      round(avg(time_spent_seconds)::numeric / nullif(avg(expected_seconds), 0), 2),
      '[]'::jsonb
    from response_facts group by subject_name, chapter_name

    union all

    select 'topic', topic_name, chapter_name, subject_name,
      count(*)::integer,
      count(*) filter (where not is_skipped)::integer,
      sum(correct)::integer,
      sum(incorrect)::integer,
      sum(unanswered)::integer,
      round(100.0 * sum(correct) / nullif(sum(correct + incorrect), 0), 1),
      round(100.0 * sum(marks_awarded) / nullif(count(*) * 4, 0), 1),
      round(avg(time_spent_seconds)::numeric, 1),
      round(avg(expected_seconds)::numeric, 1),
      round(avg(time_spent_seconds)::numeric / nullif(avg(expected_seconds), 0), 2),
      '[]'::jsonb
    from response_facts group by subject_name, chapter_name, topic_name
  ),
  normalized as (
    select level,
      md5(v_run_id::text || ':' || level || ':' || coalesce(parent_name,'') || ':' || name)::uuid as id,
      name,
      case when parent_name is null then null else md5(v_run_id::text || ':' || case when level='chapter' then 'subject' else 'chapter' end || ':' || parent_name)::uuid end as parent_id,
      parent_name,
      md5(v_run_id::text || ':subject:' || subject_name)::uuid as subject_id,
      subject_name, questions, attempts, correct, incorrect, unanswered, accuracy,
      average_percentage, average_seconds, cohort_median_seconds, pace_ratio,
      null::numeric as trend_delta, null::numeric as recent_accuracy,
      null::numeric as previous_accuracy,
      case when level='subject' then (
        select coalesce(jsonb_agg(jsonb_build_object(
          'difficulty', x.difficulty,
          'questions', x.questions,
          'accuracy', x.accuracy,
          'average_seconds', x.average_seconds,
          'correct', x.correct,
          'incorrect', x.incorrect,
          'unanswered', x.unanswered
        ) order by x.sort_order), '[]'::jsonb)
        from (
          select difficulty,
            case difficulty when 'very_easy' then 1 when 'easy' then 2 when 'moderate' then 3 when 'difficult' then 4 else 5 end sort_order,
            count(*)::integer questions,
            round(100.0*sum(correct)/nullif(sum(correct+incorrect),0),1) accuracy,
            round(avg(time_spent_seconds)::numeric,1) average_seconds,
            sum(correct)::integer correct,
            sum(incorrect)::integer incorrect,
            sum(unanswered)::integer unanswered
          from response_facts f
          where f.subject_name = level_rows.subject_name
          group by difficulty
        ) x
      ) else '[]'::jsonb end as difficulty
    from level_rows
  ),
  priority_base as (
    select n.*,
      round((100 - coalesce(n.accuracy,0)) * 0.7 + greatest(coalesce(n.pace_ratio,1)-1,0)*20 + 100.0*n.unanswered/nullif(n.questions,0)*0.1,1) as priority_score
    from normalized n where level='topic'
  ),
  priorities as (
    select *, row_number() over(order by priority_score desc, questions desc, name)::integer as rank
    from priority_base
  ),
  summary as (
    select
      count(*)::integer total_questions,
      sum(correct)::integer correct,
      sum(incorrect)::integer incorrect,
      sum(unanswered)::integer unanswered,
      round(avg(time_spent_seconds)::numeric,1) avg_seconds,
      round(avg(expected_seconds)::numeric,1) expected_seconds,
      round(avg(time_spent_seconds)::numeric/nullif(avg(expected_seconds),0),2) pace_ratio,
      round(avg(confidence_rating)::numeric,2) confidence_index
    from response_facts
  )
  select jsonb_build_object(
    'demo_mode', true,
    'benchmark_run_id', v_run_id,
    'benchmark_student_no', p_student_no,
    'student', jsonb_build_object(
      'id', auth.uid(),
      'full_name', 'Benchmark Student ' || p_student_no,
      'organization_id', null,
      'organization_name', 'Evidara V13.2 Benchmark',
      'academic_year', '2026-27',
      'grade', '12',
      'section_name', '10,000 Student Load Test'
    ),
    'summary', jsonb_build_object(
      'completed_tests', 1,
      'total_questions', s.total_questions,
      'average_percentage', sr.percentage,
      'accuracy', round(100.0*s.correct/nullif(s.correct+s.incorrect,0),1),
      'percentile', sr.percentile,
      'percentile_available', true,
      'rank', sr.rank,
      'cohort_size', 10000,
      'completion_rate', round(100.0*(s.correct+s.incorrect)/nullif(s.total_questions,0),1),
      'time_management_score', round(greatest(0,least(10,10*(0.75*least(1,s.expected_seconds/nullif(s.avg_seconds,0)) + 0.25*((s.correct+s.incorrect)::numeric/nullif(s.total_questions,0))))),1),
      'time_management_label', case when s.pace_ratio <= 1.05 then 'Strong' when s.pace_ratio <= 1.25 then 'Developing' else 'Needs attention' end,
      'average_response_seconds', s.avg_seconds,
      'cohort_median_seconds', s.expected_seconds,
      'pace_ratio', s.pace_ratio,
      'consistency_score', null,
      'assessed_subjects', (select count(*) from normalized where level='subject'),
      'assessed_chapters', (select count(*) from normalized where level='chapter'),
      'assessed_topics', (select count(*) from normalized where level='topic'),
      'trend_delta', null,
      'confidence_index', s.confidence_index
    ),
    'trend', jsonb_build_array(jsonb_build_object(
      'attempt_id', v_run_id,
      'paper_id', v_run_id,
      'paper_title', 'V13.2 Benchmark Assessment',
      'submitted_at', now(),
      'percentage', sr.percentage,
      'accuracy', round(100.0*s.correct/nullif(s.correct+s.incorrect,0),1),
      'duration_minutes', round(s.avg_seconds*s.total_questions/60.0),
      'correct', s.correct,
      'incorrect', s.incorrect,
      'unanswered', s.unanswered
    )),
    'subjects', coalesce((select jsonb_agg(to_jsonb(n) order by n.name) from normalized n where level='subject'),'[]'::jsonb),
    'chapters', coalesce((select jsonb_agg(to_jsonb(n) order by n.subject_name,n.name) from normalized n where level='chapter'),'[]'::jsonb),
    'topics', coalesce((select jsonb_agg(to_jsonb(n) order by n.subject_name,n.parent_name,n.name) from normalized n where level='topic'),'[]'::jsonb),
    'priorities', coalesce((select jsonb_agg(jsonb_build_object(
      'rank', p.rank,
      'level', case when p.priority_score>=70 then 'high' when p.priority_score>=50 then 'medium' else 'watch' end,
      'subject_id', p.subject_id,
      'subject_name', p.subject_name,
      'chapter_id', p.parent_id,
      'chapter_name', p.parent_name,
      'topic_id', p.id,
      'topic_name', p.name,
      'questions', p.questions,
      'accuracy', p.accuracy,
      'unanswered_rate', round(100.0*p.unanswered/nullif(p.questions,0),1),
      'pace_ratio', p.pace_ratio,
      'trend_delta', null,
      'priority_score', p.priority_score,
      'reasons', jsonb_build_array(case when p.accuracy<60 then 'Accuracy is below 60%' else 'This topic is below the current target range' end),
      'action', 'Review recent '||p.name||' outcomes, then attempt a short targeted set.'
    ) order by p.rank) from priorities p where p.rank<=10),'[]'::jsonb),
    'history', jsonb_build_array(jsonb_build_object(
      'attempt_id', v_run_id,
      'paper_id', v_run_id,
      'paper_title', 'V13.2 Benchmark Assessment',
      'exam_type', 'Benchmark',
      'grade_level', '12',
      'submitted_at', now(),
      'score', sr.score,
      'maximum_marks', 480,
      'percentage', sr.percentage,
      'accuracy', round(100.0*s.correct/nullif(s.correct+s.incorrect,0),1),
      'duration_minutes', round(s.avg_seconds*s.total_questions/60.0),
      'correct', s.correct,
      'incorrect', s.incorrect,
      'unanswered', s.unanswered,
      'result_mode', 'score_and_solutions'
    )),
    'review_queue', coalesce((select jsonb_agg(jsonb_build_object(
      'subject_id', n.subject_id,
      'subject_name', n.subject_name,
      'chapter_id', n.parent_id,
      'chapter_name', n.parent_name,
      'topic_id', n.id,
      'topic_name', n.name,
      'incorrect', n.incorrect,
      'unanswered', n.unanswered,
      'review_count', n.incorrect+n.unanswered,
      'last_seen_at', now()
    ) order by (n.incorrect+n.unanswered) desc) from normalized n where level='topic' and (n.incorrect+n.unanswered)>0),'[]'::jsonb),
    'evidence_policy', jsonb_build_object(
      'semantic_error_types', true,
      'confidence_self_rating', true,
      'misconception_tags', false,
      'automatic_sources', jsonb_build_array('V13.2 benchmark responses','benchmark timing','benchmark taxonomy','synthetic confidence and error reasons')
    ),
    'generated_at', now()
  ) into v_result
  from student_result sr cross join summary s;

  return v_result;
end;
$$;

revoke all on function public.get_v13_benchmark_analytics(integer, uuid) from public, anon;
grant execute on function public.get_v13_benchmark_analytics(integer, uuid) to authenticated, service_role;
