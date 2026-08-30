-- Evidara V12 — automatic evidence analytics
-- Uses only submitted outcomes, unanswered questions, timing, taxonomy and
-- recent trends. It deliberately does not infer semantic error types, ask for
-- confidence ratings or require misconception tagging.
-- Run after 44_v12_security_foundation.sql.

begin;

create index if not exists exam_responses_paper_question_timing_idx
  on public.exam_responses(paper_question_id, is_correct, time_spent_seconds)
  where time_spent_seconds > 0;
create index if not exists exam_attempts_student_submitted_v12_idx
  on public.exam_attempts(student_id, submitted_at desc)
  where status = 'submitted';

create or replace function public.analytics_can_view_student_v12(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    auth.uid() = p_student_id
    or public.is_evidara_platform_admin()
    or exists(
      select 1
      from public.student_school_memberships membership
      where membership.student_id = p_student_id
        and membership.status = 'active'
        and (
          exists(
            select 1
            from public.organization_members manager
            where manager.organization_id = membership.organization_id
              and manager.user_id = auth.uid()
              and manager.is_active = true
              and manager.member_role::text in ('institute_owner','institute_admin','school_owner','school_admin')
          )
          or exists(
            select 1
            from public.teacher_section_assignments assignment
            join public.academic_sections section_row on section_row.id = assignment.section_id
            where assignment.teacher_id = auth.uid()
              and assignment.is_active = true
              and section_row.is_active = true
              and section_row.organization_id = membership.organization_id
              and section_row.id = membership.section_id
          )
        )
    ), false
  );
$$;

revoke all on function public.analytics_can_view_student_v12(uuid) from public, anon;
grant execute on function public.analytics_can_view_student_v12(uuid) to authenticated, service_role;

create or replace function public.list_analytics_students_v12()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;

  return jsonb_build_object(
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', membership.student_id,
        'full_name', coalesce(profile.full_name, 'Student'),
        'organization_id', membership.organization_id,
        'organization_name', organization.name,
        'academic_year', membership.academic_year,
        'grade', membership.grade,
        'section_name', coalesce(section_row.name, membership.section, 'Unassigned')
      ) order by membership.academic_year desc, membership.grade, coalesce(section_row.name,membership.section,''), lower(coalesce(profile.full_name,'')))
      from public.student_school_memberships membership
      join public.profiles profile on profile.id = membership.student_id
      join public.organizations organization on organization.id = membership.organization_id
      left join public.academic_sections section_row on section_row.id = membership.section_id
      where membership.status = 'active'
        and public.analytics_can_view_student_v12(membership.student_id)
    ), '[]'::jsonb),
    'generated_at', now()
  );
end;
$$;

revoke all on function public.list_analytics_students_v12() from public, anon;
grant execute on function public.list_analytics_students_v12() to authenticated;

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
  v_student uuid := coalesce(p_student_id, auth.uid());
  v_result jsonb;
begin
  if auth.uid() is null and coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' then
    raise exception 'Login required.';
  end if;
  if coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' and not public.analytics_can_view_student_v12(v_student) then
    raise exception 'You do not have access to this student analytics profile.' using errcode='42501';
  end if;
  if p_date_from is not null and p_date_to is not null and p_date_to < p_date_from then
    raise exception 'The end date must be on or after the start date.';
  end if;

  with
  active_membership as (
    select membership.*, organization.name as organization_name,
      coalesce(section_row.name, membership.section, 'Unassigned') as section_name
    from public.student_school_memberships membership
    join public.organizations organization on organization.id = membership.organization_id
    left join public.academic_sections section_row on section_row.id = membership.section_id
    where membership.student_id = v_student and membership.status = 'active'
    order by membership.academic_year desc, membership.updated_at desc
    limit 1
  ),
  selected_attempts_base as (
    select attempt.*, paper.title as paper_title, paper.exam_type, paper.grade_level,
      paper.result_mode::text as result_mode, paper.duration_minutes,
      row_number() over(order by attempt.submitted_at desc, attempt.id) as recent_rank
    from public.exam_attempts attempt
    join public.question_papers paper on paper.id = attempt.paper_id
    where attempt.student_id = v_student
      and attempt.status = 'submitted'
      and attempt.submitted_at is not null
      and (p_date_from is null or attempt.submitted_at >= p_date_from)
      and (p_date_to is null or attempt.submitted_at <= p_date_to)
      and (
        p_product_id is null
        or exists(
          select 1 from public.product_papers product_paper
          where product_paper.product_id = p_product_id
            and product_paper.paper_id = attempt.paper_id
        )
      )
  ),
  selected_attempts as (
    select * from selected_attempts_base
  ),
  cohort_correct_medians as (
    select response.paper_question_id,
      percentile_cont(0.5) within group(order by response.time_spent_seconds)::numeric as median_seconds,
      count(*)::integer as sample_size
    from public.exam_responses response
    join public.exam_attempts cohort_attempt on cohort_attempt.id = response.attempt_id
    where cohort_attempt.status = 'submitted'
      and response.is_correct = true
      and response.time_spent_seconds > 0
      and cohort_attempt.paper_id in (select paper_id from selected_attempts)
    group by response.paper_question_id
    having count(*) >= 3
  ),
  facts as (
    select
      attempt.id as attempt_id,
      attempt.paper_id,
      attempt.paper_title,
      attempt.submitted_at,
      attempt.recent_rank,
      paper_question.id as paper_question_id,
      coalesce(question.subject_id, section_row.subject_id) as subject_id,
      coalesce(subject.name, section_subject.name, paper_question.question_snapshot->>'subject_name', section_row.title, 'General') as subject_name,
      question.chapter_id,
      coalesce(chapter.name, paper_question.question_snapshot->>'chapter_name', 'Unassigned chapter') as chapter_name,
      question.topic_id,
      coalesce(topic.name, paper_question.question_snapshot->>'topic_name', 'Unassigned topic') as topic_name,
      coalesce(question.difficulty::text, paper_question.question_snapshot->>'difficulty', 'moderate') as difficulty,
      paper_question.marks,
      coalesce(response.marks_awarded, 0)::numeric as marks_awarded,
      case when response.is_correct = true then 1 else 0 end as correct,
      case when response.is_correct = false then 1 else 0 end as incorrect,
      case when response.id is null or response.is_correct is null then 1 else 0 end as unanswered,
      case when response.time_spent_seconds > 0 then response.time_spent_seconds end as time_spent_seconds,
      median_row.median_seconds as cohort_median_seconds,
      response.marked_for_review,
      response.id is not null as response_recorded
    from selected_attempts attempt
    join public.paper_questions paper_question on paper_question.paper_id = attempt.paper_id
    join public.paper_sections section_row on section_row.id = paper_question.section_id
    left join public.questions question on question.id = paper_question.question_id
    left join public.subjects subject on subject.id = question.subject_id
    left join public.subjects section_subject on section_subject.id = section_row.subject_id
    left join public.chapters chapter on chapter.id = question.chapter_id
    left join public.topics topic on topic.id = question.topic_id
    left join public.exam_responses response
      on response.attempt_id = attempt.id
     and response.paper_question_id = paper_question.id
    left join cohort_correct_medians median_row on median_row.paper_question_id = paper_question.id
  ),
  expanded as (
    select 'subject'::text as level, fact.subject_id as id, fact.subject_name as name,
      null::uuid as parent_id, null::text as parent_name,
      fact.subject_id, fact.subject_name, fact.attempt_id, fact.paper_id, fact.paper_title,
      fact.submitted_at, fact.recent_rank, fact.paper_question_id, fact.difficulty,
      fact.marks, fact.marks_awarded, fact.correct, fact.incorrect, fact.unanswered,
      fact.time_spent_seconds, fact.cohort_median_seconds, fact.marked_for_review, fact.response_recorded
    from facts fact where fact.subject_id is not null
    union all
    select 'chapter', fact.chapter_id, fact.chapter_name,
      fact.subject_id, fact.subject_name,
      fact.subject_id, fact.subject_name, fact.attempt_id, fact.paper_id, fact.paper_title,
      fact.submitted_at, fact.recent_rank, fact.paper_question_id, fact.difficulty,
      fact.marks, fact.marks_awarded, fact.correct, fact.incorrect, fact.unanswered,
      fact.time_spent_seconds, fact.cohort_median_seconds, fact.marked_for_review, fact.response_recorded
    from facts fact where fact.chapter_id is not null
    union all
    select 'topic', fact.topic_id, fact.topic_name,
      fact.chapter_id, fact.chapter_name,
      fact.subject_id, fact.subject_name, fact.attempt_id, fact.paper_id, fact.paper_title,
      fact.submitted_at, fact.recent_rank, fact.paper_question_id, fact.difficulty,
      fact.marks, fact.marks_awarded, fact.correct, fact.incorrect, fact.unanswered,
      fact.time_spent_seconds, fact.cohort_median_seconds, fact.marked_for_review, fact.response_recorded
    from facts fact where fact.topic_id is not null
  ),
  taxonomy_base as (
    select level, id, name, parent_id, parent_name, subject_id, subject_name,
      count(*)::integer as questions,
      count(*) filter(where response_recorded)::integer as attempts,
      sum(correct)::integer as correct,
      sum(incorrect)::integer as incorrect,
      sum(unanswered)::integer as unanswered,
      round(100 * sum(correct)::numeric / greatest(sum(correct + incorrect),1), 1) as accuracy,
      round(100 * sum(marks_awarded)::numeric / greatest(sum(marks),1), 1) as average_percentage,
      round(avg(time_spent_seconds) filter(where time_spent_seconds is not null), 1) as average_seconds,
      round(avg(cohort_median_seconds) filter(where cohort_median_seconds is not null), 1) as cohort_median_seconds,
      round(
        avg(time_spent_seconds) filter(where time_spent_seconds is not null and cohort_median_seconds is not null)
        / nullif(avg(cohort_median_seconds) filter(where time_spent_seconds is not null and cohort_median_seconds is not null),0),
        2
      ) as pace_ratio,
      round(100 * sum(correct) filter(where recent_rank <= 3)::numeric
        / nullif(sum(correct + incorrect) filter(where recent_rank <= 3),0), 1) as recent_accuracy,
      round(100 * sum(correct) filter(where recent_rank between 4 and 6)::numeric
        / nullif(sum(correct + incorrect) filter(where recent_rank between 4 and 6),0), 1) as previous_accuracy,
      max(submitted_at) as last_seen_at
    from expanded
    group by level, id, name, parent_id, parent_name, subject_id, subject_name
  ),
  taxonomy_rows as (
    select taxonomy.*,
      case when taxonomy.recent_accuracy is not null and taxonomy.previous_accuracy is not null
        then round(taxonomy.recent_accuracy - taxonomy.previous_accuracy,1)
        else null end as trend_delta,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'difficulty', difficulty_row.difficulty,
          'questions', difficulty_row.questions,
          'accuracy', difficulty_row.accuracy,
          'average_seconds', difficulty_row.average_seconds,
          'correct', difficulty_row.correct,
          'incorrect', difficulty_row.incorrect,
          'unanswered', difficulty_row.unanswered
        ) order by difficulty_row.sort_order)
        from (
          select expanded_row.difficulty,
            case expanded_row.difficulty
              when 'very_easy' then 1 when 'easy' then 2 when 'moderate' then 3
              when 'difficult' then 4 when 'very_difficult' then 5 else 6 end as sort_order,
            count(*)::integer as questions,
            round(100 * sum(expanded_row.correct)::numeric / greatest(sum(expanded_row.correct + expanded_row.incorrect),1),1) as accuracy,
            round(avg(expanded_row.time_spent_seconds) filter(where expanded_row.time_spent_seconds is not null),1) as average_seconds,
            sum(expanded_row.correct)::integer as correct,
            sum(expanded_row.incorrect)::integer as incorrect,
            sum(expanded_row.unanswered)::integer as unanswered
          from expanded expanded_row
          where expanded_row.level = taxonomy.level and expanded_row.id = taxonomy.id
          group by expanded_row.difficulty
        ) difficulty_row
      ), '[]'::jsonb) as difficulty
    from taxonomy_base taxonomy
  ),
  attempt_cohort as (
    select selected.id as attempt_id,
      count(cohort.id)::integer as cohort_size,
      count(cohort.id) filter(where cohort.percentage < selected.percentage)::integer as below_count
    from selected_attempts selected
    join public.exam_attempts cohort
      on cohort.paper_id = selected.paper_id
     and cohort.status = 'submitted'
    group by selected.id
  ),
  product_completion as (
    select
      count(distinct product_paper.paper_id)::integer as total_papers,
      count(distinct selected.paper_id)::integer as completed_papers,
      min(cohort.cohort_size)::integer as minimum_cohort
    from public.product_papers product_paper
    left join selected_attempts selected on selected.paper_id = product_paper.paper_id
    left join attempt_cohort cohort on cohort.attempt_id = selected.id
    where p_product_id is not null and product_paper.product_id = p_product_id
  ),
  summary_facts as (
    select
      count(*)::integer as total_questions,
      sum(correct)::integer as correct,
      sum(incorrect)::integer as incorrect,
      sum(unanswered)::integer as unanswered,
      round(avg(time_spent_seconds) filter(where time_spent_seconds is not null),1) as average_response_seconds,
      round(avg(cohort_median_seconds) filter(where cohort_median_seconds is not null),1) as cohort_median_seconds,
      round(
        avg(time_spent_seconds) filter(where time_spent_seconds is not null and cohort_median_seconds is not null)
        / nullif(avg(cohort_median_seconds) filter(where time_spent_seconds is not null and cohort_median_seconds is not null),0),
        2
      ) as pace_ratio,
      count(*) filter(where time_spent_seconds is not null and cohort_median_seconds is not null)::integer as paced_samples,
      avg(least(1::numeric, cohort_median_seconds / nullif(time_spent_seconds,0)))
        filter(where time_spent_seconds is not null and cohort_median_seconds is not null) as pace_efficiency,
      avg(case when time_spent_seconds >= cohort_median_seconds * 0.20 then 1 else 0 end)
        filter(where time_spent_seconds is not null and cohort_median_seconds is not null) as non_rushed_rate
    from facts
  ),
  summary_attempts as (
    select count(*)::integer as completed_tests,
      round(avg(percentage),1) as average_percentage,
      round(stddev_pop(percentage),2) as percentage_stddev,
      round(avg(
        case when cohort.cohort_size >= 5
          then 100 * cohort.below_count::numeric / greatest(cohort.cohort_size - 1,1)
          else null end
      ),1) as average_percentile,
      round(
        avg(percentage) filter(where recent_rank <= 3)
        - avg(percentage) filter(where recent_rank between 4 and 6), 1
      ) as trend_delta
    from selected_attempts selected
    left join attempt_cohort cohort on cohort.attempt_id = selected.id
  ),
  priorities_unranked as (
    select taxonomy.*,
      round(
        (100 - taxonomy.accuracy) * 0.55
        + (100 * taxonomy.unanswered::numeric / greatest(taxonomy.questions,1)) * 0.20
        + greatest(coalesce(taxonomy.pace_ratio,1) - 1,0) * 25
        + greatest(-coalesce(taxonomy.trend_delta,0),0) * 1.5,
        1
      ) as priority_score,
      round(100 * taxonomy.unanswered::numeric / greatest(taxonomy.questions,1),1) as unanswered_rate
    from taxonomy_rows taxonomy
    where taxonomy.level = 'topic' and taxonomy.questions >= 3
  ),
  priority_rows as (
    select priority.*,
      row_number() over(order by priority.priority_score desc, priority.questions desc, priority.name)::integer as rank
    from priorities_unranked priority
  ),
  review_rows as (
    select topic_id, topic_name, chapter_id, chapter_name, subject_id, subject_name,
      sum(incorrect)::integer as incorrect,
      sum(unanswered)::integer as unanswered,
      sum(incorrect + unanswered)::integer as review_count,
      max(submitted_at) as last_seen_at
    from facts
    where topic_id is not null and (incorrect = 1 or unanswered = 1)
    group by topic_id, topic_name, chapter_id, chapter_name, subject_id, subject_name
  )
  select jsonb_build_object(
    'student', jsonb_build_object(
      'id', profile.id,
      'full_name', coalesce(profile.full_name,'Student'),
      'organization_id', membership.organization_id,
      'organization_name', membership.organization_name,
      'academic_year', membership.academic_year,
      'grade', membership.grade,
      'section_name', membership.section_name
    ),
    'summary', jsonb_build_object(
      'completed_tests', coalesce(attempt_summary.completed_tests,0),
      'total_questions', coalesce(fact_summary.total_questions,0),
      'average_percentage', coalesce(attempt_summary.average_percentage,0),
      'accuracy', round(100 * coalesce(fact_summary.correct,0)::numeric / greatest(coalesce(fact_summary.correct,0) + coalesce(fact_summary.incorrect,0),1),1),
      'percentile', case
        when p_product_id is not null
         and completion.total_papers > 0
         and completion.completed_papers >= completion.total_papers
         and completion.minimum_cohort >= 5
        then attempt_summary.average_percentile else null end,
      'percentile_available', coalesce(
        p_product_id is not null
        and completion.total_papers > 0
        and completion.completed_papers >= completion.total_papers
        and completion.minimum_cohort >= 5, false),
      'completion_rate', round(100 * (coalesce(fact_summary.correct,0) + coalesce(fact_summary.incorrect,0))::numeric / greatest(coalesce(fact_summary.total_questions,0),1),1),
      'time_management_score', case when fact_summary.paced_samples >= 5 then round(10 * (
        0.65 * coalesce(fact_summary.pace_efficiency,0)
        + 0.25 * ((coalesce(fact_summary.correct,0) + coalesce(fact_summary.incorrect,0))::numeric / greatest(coalesce(fact_summary.total_questions,0),1))
        + 0.10 * coalesce(fact_summary.non_rushed_rate,0)
      ),1) else null end,
      'time_management_label', case
        when fact_summary.paced_samples < 5 then 'Building evidence'
        when 10 * (0.65 * coalesce(fact_summary.pace_efficiency,0) + 0.25 * ((coalesce(fact_summary.correct,0)+coalesce(fact_summary.incorrect,0))::numeric/greatest(coalesce(fact_summary.total_questions,0),1)) + 0.10 * coalesce(fact_summary.non_rushed_rate,0)) >= 8 then 'Strong'
        when 10 * (0.65 * coalesce(fact_summary.pace_efficiency,0) + 0.25 * ((coalesce(fact_summary.correct,0)+coalesce(fact_summary.incorrect,0))::numeric/greatest(coalesce(fact_summary.total_questions,0),1)) + 0.10 * coalesce(fact_summary.non_rushed_rate,0)) >= 6 then 'Developing'
        else 'Needs attention' end,
      'average_response_seconds', fact_summary.average_response_seconds,
      'cohort_median_seconds', fact_summary.cohort_median_seconds,
      'pace_ratio', fact_summary.pace_ratio,
      'consistency_score', case when attempt_summary.completed_tests >= 2
        then round(greatest(0, least(10, 10 - coalesce(attempt_summary.percentage_stddev,0) / 3)),1)
        else null end,
      'assessed_subjects', (select count(*) from taxonomy_rows where level='subject'),
      'assessed_chapters', (select count(*) from taxonomy_rows where level='chapter'),
      'assessed_topics', (select count(*) from taxonomy_rows where level='topic'),
      'trend_delta', attempt_summary.trend_delta
    ),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attempt_id', attempt.id,
        'paper_id', attempt.paper_id,
        'paper_title', attempt.paper_title,
        'submitted_at', attempt.submitted_at,
        'percentage', round(attempt.percentage,1),
        'accuracy', round(100 * attempt.correct_count::numeric / greatest(attempt.correct_count + attempt.incorrect_count,1),1),
        'duration_minutes', greatest(0,round(extract(epoch from (attempt.submitted_at - attempt.started_at))/60.0)),
        'correct', attempt.correct_count,
        'incorrect', attempt.incorrect_count,
        'unanswered', attempt.unanswered_count
      ) order by attempt.submitted_at)
      from selected_attempts attempt
    ), '[]'::jsonb),
    'subjects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', row.id, 'name', row.name, 'parent_id', row.parent_id, 'parent_name', row.parent_name,
        'subject_id', row.subject_id, 'subject_name', row.subject_name,
        'questions', row.questions, 'attempts', row.attempts, 'accuracy', row.accuracy,
        'average_percentage', row.average_percentage, 'average_seconds', row.average_seconds,
        'cohort_median_seconds', row.cohort_median_seconds, 'pace_ratio', row.pace_ratio,
        'trend_delta', row.trend_delta, 'recent_accuracy', row.recent_accuracy,
        'previous_accuracy', row.previous_accuracy, 'correct', row.correct,
        'incorrect', row.incorrect, 'unanswered', row.unanswered, 'difficulty', row.difficulty
      ) order by row.name) from taxonomy_rows row where row.level='subject'
    ), '[]'::jsonb),
    'chapters', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', row.id, 'name', row.name, 'parent_id', row.parent_id, 'parent_name', row.parent_name,
        'subject_id', row.subject_id, 'subject_name', row.subject_name,
        'questions', row.questions, 'attempts', row.attempts, 'accuracy', row.accuracy,
        'average_percentage', row.average_percentage, 'average_seconds', row.average_seconds,
        'cohort_median_seconds', row.cohort_median_seconds, 'pace_ratio', row.pace_ratio,
        'trend_delta', row.trend_delta, 'recent_accuracy', row.recent_accuracy,
        'previous_accuracy', row.previous_accuracy, 'correct', row.correct,
        'incorrect', row.incorrect, 'unanswered', row.unanswered, 'difficulty', row.difficulty
      ) order by row.subject_name,row.name) from taxonomy_rows row where row.level='chapter'
    ), '[]'::jsonb),
    'topics', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', row.id, 'name', row.name, 'parent_id', row.parent_id, 'parent_name', row.parent_name,
        'subject_id', row.subject_id, 'subject_name', row.subject_name,
        'questions', row.questions, 'attempts', row.attempts, 'accuracy', row.accuracy,
        'average_percentage', row.average_percentage, 'average_seconds', row.average_seconds,
        'cohort_median_seconds', row.cohort_median_seconds, 'pace_ratio', row.pace_ratio,
        'trend_delta', row.trend_delta, 'recent_accuracy', row.recent_accuracy,
        'previous_accuracy', row.previous_accuracy, 'correct', row.correct,
        'incorrect', row.incorrect, 'unanswered', row.unanswered, 'difficulty', row.difficulty
      ) order by row.subject_name,row.parent_name,row.name) from taxonomy_rows row where row.level='topic'
    ), '[]'::jsonb),
    'priorities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', priority.rank,
        'level', case when priority.priority_score >= 70 then 'high' when priority.priority_score >= 50 then 'medium' else 'watch' end,
        'subject_id', priority.subject_id,
        'subject_name', priority.subject_name,
        'chapter_id', priority.parent_id,
        'chapter_name', priority.parent_name,
        'topic_id', priority.id,
        'topic_name', priority.name,
        'questions', priority.questions,
        'accuracy', priority.accuracy,
        'unanswered_rate', priority.unanswered_rate,
        'pace_ratio', priority.pace_ratio,
        'trend_delta', priority.trend_delta,
        'priority_score', priority.priority_score,
        'reasons', to_jsonb(array_remove(array[
          case when priority.accuracy < 60 then 'Accuracy is below 60%' when priority.accuracy < 70 then 'Accuracy is below the current target range' end,
          case when priority.unanswered_rate >= 10 then 'A meaningful share of questions was unanswered' end,
          case when priority.pace_ratio > 1.20 then 'Response time is above the correct-response cohort median' end,
          case when priority.trend_delta < -2 then 'Recent performance declined' end
        ], null)),
        'action', case
          when priority.accuracy < 60 then 'Review recent incorrect and unanswered ' || priority.name || ' questions, then attempt a short targeted set.'
          when priority.pace_ratio > 1.20 then 'Redo recent ' || priority.name || ' questions without a timer, then attempt a short timed set.'
          else 'Review the latest ' || priority.name || ' outcomes and schedule a short mixed-difficulty revision set.' end
      ) order by priority.rank)
      from priority_rows priority where priority.rank <= 10
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attempt_id', attempt.id,
        'paper_id', attempt.paper_id,
        'paper_title', attempt.paper_title,
        'exam_type', attempt.exam_type,
        'grade_level', attempt.grade_level,
        'submitted_at', attempt.submitted_at,
        'score', attempt.score,
        'maximum_marks', attempt.maximum_marks,
        'percentage', round(attempt.percentage,1),
        'accuracy', round(100 * attempt.correct_count::numeric / greatest(attempt.correct_count + attempt.incorrect_count,1),1),
        'duration_minutes', greatest(0,round(extract(epoch from (attempt.submitted_at - attempt.started_at))/60.0)),
        'correct', attempt.correct_count,
        'incorrect', attempt.incorrect_count,
        'unanswered', attempt.unanswered_count,
        'result_mode', attempt.result_mode
      ) order by attempt.submitted_at desc)
      from selected_attempts attempt
    ), '[]'::jsonb),
    'review_queue', coalesce((
      select jsonb_agg(jsonb_build_object(
        'subject_id', review.subject_id,
        'subject_name', review.subject_name,
        'chapter_id', review.chapter_id,
        'chapter_name', review.chapter_name,
        'topic_id', review.topic_id,
        'topic_name', review.topic_name,
        'incorrect', review.incorrect,
        'unanswered', review.unanswered,
        'review_count', review.review_count,
        'last_seen_at', review.last_seen_at
      ) order by review.review_count desc, review.topic_name)
      from review_rows review
    ), '[]'::jsonb),
    'evidence_policy', jsonb_build_object(
      'semantic_error_types', false,
      'confidence_self_rating', false,
      'misconception_tags', false,
      'automatic_sources', jsonb_build_array(
        'submitted attempt outcomes',
        'correct, incorrect and unanswered responses',
        'response time compared with cohort median correct time',
        'subject, chapter and topic taxonomy',
        'recent assessment trends'
      )
    ),
    'generated_at', now()
  ) into v_result
  from public.profiles profile
  left join active_membership membership on true
  cross join summary_facts fact_summary
  cross join summary_attempts attempt_summary
  left join product_completion completion on true
  where profile.id = v_student;

  return coalesce(v_result, jsonb_build_object(
    'student', jsonb_build_object('id',v_student,'full_name','Student','organization_id',null,'organization_name',null,'academic_year',null,'grade',null,'section_name',null),
    'summary', jsonb_build_object(
      'completed_tests',0,'total_questions',0,'average_percentage',0,'accuracy',0,
      'percentile',null,'percentile_available',false,'completion_rate',0,
      'time_management_score',null,'time_management_label','Building evidence',
      'average_response_seconds',null,'cohort_median_seconds',null,'pace_ratio',null,
      'consistency_score',null,'assessed_subjects',0,'assessed_chapters',0,'assessed_topics',0,'trend_delta',null
    ),
    'trend','[]'::jsonb,'subjects','[]'::jsonb,'chapters','[]'::jsonb,'topics','[]'::jsonb,
    'priorities','[]'::jsonb,'history','[]'::jsonb,'review_queue','[]'::jsonb,
    'evidence_policy',jsonb_build_object(
      'semantic_error_types',false,'confidence_self_rating',false,'misconception_tags',false,
      'automatic_sources',jsonb_build_array('submitted attempt outcomes','response timing','taxonomy','recent trends')
    ),
    'generated_at',now()
  ));
end;
$$;

revoke all on function public.get_student_analytics_v12(uuid,uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.get_student_analytics_v12(uuid,uuid,timestamptz,timestamptz) to authenticated, service_role;

-- Retired analytics RPCs remain in historical migrations but are no longer
-- callable by authenticated users. This closes the old arbitrary-student data
-- path while preserving migration traceability.
do $$
begin
  if to_regprocedure('public.analytics_attempt_time_snapshot_v12(uuid,uuid)') is not null then
    execute 'revoke execute on function public.analytics_attempt_time_snapshot_v12(uuid,uuid) from authenticated';
  end if;
exception when undefined_function then null;
end $$;

insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
values(null, 'evidara.v12.evidence_analytics_ready', 'system', '45_v12_evidence_analytics',
  jsonb_build_object(
    'automatic_evidence', true,
    'semantic_error_inference', false,
    'confidence_input', false,
    'misconception_tagging', false,
    'student_and_teacher_workspace', true
  ));

notify pgrst, 'reload schema';
commit;
