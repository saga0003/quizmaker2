-- Evidara V10 Analytics Phase 2 student calculation and UI support fix
-- Run after 36b_v10_analytics_phase_2_attempt_limit_hotfix.sql.
-- Uses one latest submitted attempt per student per paper and exposes simple comparison benchmarks.

begin;

create index if not exists exam_attempts_student_paper_latest_idx
  on public.exam_attempts(student_id,paper_id,status,submitted_at desc);
create index if not exists exam_attempts_paper_student_latest_idx
  on public.exam_attempts(paper_id,student_id,status,submitted_at desc);

create or replace function public.get_student_analytics_overview_v10(
  p_student_id uuid default auth.uid(),
  p_product_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student uuid := coalesce(p_student_id, auth.uid());
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.analytics_can_view_student_v10(v_student) then
    raise exception 'You do not have access to this student analytics profile.' using errcode='42501';
  end if;
  if p_from is not null and p_to is not null and p_to < p_from then
    raise exception 'The end date must be on or after the start date.';
  end if;

  with
  active_membership as (
    select membership.*, organization.name as organization_name
    from public.student_school_memberships membership
    join public.organizations organization on organization.id=membership.organization_id
    where membership.student_id=v_student and membership.status='active'
    order by membership.academic_year desc,membership.updated_at desc
    limit 1
  ),
  candidate_products as (
    select distinct product.id,product.name,product.exam_type
    from public.products product
    where product.status='published'
      and (
        exists(
          select 1
          from public.entitlements entitlement
          where entitlement.product_id=product.id
            and entitlement.status='active'
            and (entitlement.expires_at is null or entitlement.expires_at>now())
            and (
              entitlement.user_id=v_student
              or (
                entitlement.organization_id in (select organization_id from active_membership)
                and (
                  entitlement.seat_limit is null
                  or exists(
                    select 1 from public.product_seat_assignments seat
                    where seat.entitlement_id=entitlement.id
                      and seat.student_id=v_student
                      and seat.status='active'
                  )
                )
              )
            )
        )
        or exists(
          select 1
          from public.product_papers product_paper
          join public.exam_attempts attempt on attempt.paper_id=product_paper.paper_id
          where product_paper.product_id=product.id
            and attempt.student_id=v_student
        )
      )
  ),
  product_rows as (
    select
      product.id,
      product.name,
      product.exam_type,
      count(distinct product_paper.paper_id)::integer as total_tests,
      count(distinct product_paper.paper_id) filter(
        where exists(
          select 1 from public.exam_attempts completed
          where completed.paper_id=product_paper.paper_id
            and completed.student_id=v_student
            and completed.status='submitted'
        )
      )::integer as completed_tests,
      min(attempt.submitted_at)::date as first_completed_date,
      max(attempt.submitted_at)::date as last_completed_date
    from candidate_products product
    left join public.product_papers product_paper on product_paper.product_id=product.id
    left join public.exam_attempts attempt
      on attempt.paper_id=product_paper.paper_id
     and attempt.student_id=v_student
     and attempt.status='submitted'
    group by product.id,product.name,product.exam_type
  ),
  ranked_student_attempts as (
    select
      attempt.*,
      paper.title as paper_title,
      paper.exam_type,
      paper.duration_minutes,
      paper.total_questions,
      paper.total_marks,
      row_number() over(
        partition by attempt.paper_id
        order by attempt.submitted_at desc nulls last,attempt.created_at desc,attempt.id desc
      ) as attempt_rank
    from public.exam_attempts attempt
    join public.question_papers paper on paper.id=attempt.paper_id
    where attempt.student_id=v_student
      and attempt.status='submitted'
      and (p_from is null or attempt.submitted_at::date>=p_from)
      and (p_to is null or attempt.submitted_at::date<=p_to)
      and (
        p_product_id is null
        or exists(
          select 1 from public.product_papers product_paper
          where product_paper.product_id=p_product_id
            and product_paper.paper_id=attempt.paper_id
        )
      )
  ),
  selected_attempts as (
    select * from ranked_student_attempts where attempt_rank=1
  ),
  response_medians as (
    select response.attempt_id,
      percentile_cont(0.5) within group(order by response.time_spent_seconds)
        filter(where response.time_spent_seconds>0) as median_seconds
    from public.exam_responses response
    join selected_attempts attempt on attempt.id=response.attempt_id
    group by response.attempt_id
  ),
  response_pacing as (
    select
      response.attempt_id,
      count(*) filter(where response.time_spent_seconds>0) as timed_count,
      count(*) filter(
        where response.time_spent_seconds>0
          and response.time_spent_seconds<=greatest(10,coalesce(median_row.median_seconds,0)*3)
      ) as controlled_count,
      count(*) filter(
        where response.time_spent_seconds>=greatest(2,coalesce(median_row.median_seconds,0)*0.2)
      ) as non_rushed_count
    from public.exam_responses response
    join selected_attempts attempt on attempt.id=response.attempt_id
    left join response_medians median_row on median_row.attempt_id=response.attempt_id
    group by response.attempt_id
  ),
  selected_with_time as (
    select attempt.*,
      round(least(10::numeric,greatest(0::numeric,
        10*(
          0.35*least(1::numeric,(attempt.correct_count+attempt.incorrect_count)::numeric/greatest(attempt.total_questions,1))
          +0.25*case when coalesce(pacing.timed_count,0)=0 then 1
            else pacing.controlled_count::numeric/greatest(pacing.timed_count,1) end
          +0.20*case when coalesce(pacing.timed_count,0)=0 then 1
            else pacing.non_rushed_count::numeric/greatest(pacing.timed_count,1) end
          +0.20*case when attempt.submitted_at<=attempt.expires_at then 1 else 0 end
        )
      )),1) as time_score
    from selected_attempts attempt
    left join response_pacing pacing on pacing.attempt_id=attempt.id
  ),
  selected_papers as (
    select distinct paper_id from selected_attempts
  ),
  ranked_comparison_attempts as (
    select attempt.*,
      row_number() over(
        partition by attempt.paper_id,attempt.student_id
        order by attempt.submitted_at desc nulls last,attempt.created_at desc,attempt.id desc
      ) as comparison_rank
    from public.exam_attempts attempt
    where attempt.status='submitted'
      and attempt.paper_id in (select paper_id from selected_papers)
  ),
  comparison_attempts as (
    select * from ranked_comparison_attempts where comparison_rank=1
  ),
  comparison_by_paper as (
    select
      attempt.paper_id,
      count(*)::integer as comparison_size,
      avg(attempt.percentage)::numeric as average_percentage,
      max(attempt.percentage)::numeric as highest_percentage,
      min(attempt.percentage)::numeric as lowest_percentage,
      percentile_cont(0.90) within group(order by attempt.percentage)::numeric as top10_threshold,
      percentile_cont(0.95) within group(order by attempt.percentage)::numeric as top5_threshold
    from comparison_attempts attempt
    group by attempt.paper_id
  ),
  trend_rows as (
    select
      attempt.id,
      attempt.paper_id,
      attempt.paper_title,
      attempt.submitted_at,
      attempt.score,
      attempt.maximum_marks,
      attempt.percentage,
      attempt.correct_count,
      attempt.incorrect_count,
      attempt.unanswered_count,
      attempt.time_score,
      comparison.comparison_size,
      case when comparison.comparison_size>=5 then comparison.average_percentage end as average_percentage,
      case when comparison.comparison_size>=5 then comparison.highest_percentage end as highest_percentage,
      case when comparison.comparison_size>=5 then comparison.lowest_percentage end as lowest_percentage,
      case when comparison.comparison_size>=5 then comparison.top5_threshold end as top5_threshold,
      case when comparison.comparison_size>=5 then comparison.top10_threshold end as top10_threshold,
      case when comparison.comparison_size>=2 then round(
        100*(
          (select count(*) from comparison_attempts lower_attempt
            where lower_attempt.paper_id=attempt.paper_id and lower_attempt.percentage<attempt.percentage)
          +0.5*greatest(0,(select count(*) from comparison_attempts equal_attempt
            where equal_attempt.paper_id=attempt.paper_id and equal_attempt.percentage=attempt.percentage)-1)
        )/greatest(comparison.comparison_size-1,1),1
      ) end as percentile
    from selected_with_time attempt
    left join comparison_by_paper comparison on comparison.paper_id=attempt.paper_id
  ),
  student_subject as (
    select
      coalesce(subject.name,paper_section.title,question.question_snapshot->>'subject_name','General') as subject_name,
      sum(coalesce(response.marks_awarded,0))::numeric as awarded_marks,
      sum(question.marks)::numeric as maximum_marks,
      count(*)::integer as questions,
      count(*) filter(where response.is_correct=true)::integer as correct,
      count(*) filter(where response.is_correct=false)::integer as incorrect
    from selected_attempts attempt
    join public.exam_responses response on response.attempt_id=attempt.id
    join public.paper_questions question on question.id=response.paper_question_id
    join public.paper_sections paper_section on paper_section.id=question.section_id
    left join public.subjects subject on subject.id=paper_section.subject_id
    group by 1
  ),
  comparison_subject_attempt as (
    select
      comparison_attempt.id as attempt_id,
      coalesce(subject.name,paper_section.title,question.question_snapshot->>'subject_name','General') as subject_name,
      100*sum(coalesce(response.marks_awarded,0))::numeric/greatest(sum(question.marks),1) as percentage
    from comparison_attempts comparison_attempt
    join public.exam_responses response on response.attempt_id=comparison_attempt.id
    join public.paper_questions question on question.id=response.paper_question_id
    join public.paper_sections paper_section on paper_section.id=question.section_id
    left join public.subjects subject on subject.id=paper_section.subject_id
    group by comparison_attempt.id,2
  ),
  comparison_subject_stats as (
    select
      subject_name,
      count(*)::integer as comparison_size,
      avg(percentage)::numeric as average_percentage,
      max(percentage)::numeric as highest_percentage,
      min(percentage)::numeric as lowest_percentage,
      percentile_cont(0.90) within group(order by percentage)::numeric as top10_threshold,
      percentile_cont(0.95) within group(order by percentage)::numeric as top5_threshold
    from comparison_subject_attempt
    group by subject_name
  ),
  subject_rows as (
    select
      student.subject_name,
      round(100*student.awarded_marks/greatest(student.maximum_marks,1),1) as student_percentage,
      round(student.awarded_marks,1) as student_marks,
      round(student.maximum_marks,1) as maximum_marks,
      student.questions,
      student.correct,
      student.incorrect,
      comparison.comparison_size as cohort_size,
      case when comparison.comparison_size>=5 then round(comparison.average_percentage,1) end as average_percentage,
      case when comparison.comparison_size>=5 then round(comparison.highest_percentage,1) end as highest_percentage,
      case when comparison.comparison_size>=5 then round(comparison.lowest_percentage,1) end as lowest_percentage,
      case when comparison.comparison_size>=5 then round(comparison.top5_threshold,1) end as top5_threshold,
      case when comparison.comparison_size>=5 then round(comparison.top10_threshold,1) end as top10_threshold
    from student_subject student
    left join comparison_subject_stats comparison on comparison.subject_name=student.subject_name
  ),
  selected_product as (
    select * from product_rows where id=p_product_id
  ),
  summary as (
    select
      count(*)::integer as completed_tests,
      round(avg(percentage),1) as average_percentage,
      round(100*sum(correct_count)::numeric/greatest(sum(correct_count+incorrect_count),1),1) as accuracy,
      sum(correct_count)::integer as correct,
      sum(incorrect_count)::integer as incorrect,
      sum(unanswered_count)::integer as unanswered,
      round(avg(time_score),1) as time_score,
      round(avg(percentile),1) as average_percentile,
      max(comparison_size)::integer as comparison_size,
      round(avg(average_percentage),1) as comparison_average_percentage,
      round(avg(top10_threshold),1) as top10_threshold,
      round(avg(top5_threshold),1) as top5_threshold,
      round(max(highest_percentage),1) as highest_percentage,
      min(submitted_at)::date as from_date,
      max(submitted_at)::date as to_date
    from trend_rows
  )
  select jsonb_build_object(
    'student',(
      select jsonb_build_object(
        'id',profile.id,
        'full_name',coalesce(profile.full_name,'Student'),
        'organization_id',membership.organization_id,
        'organization_name',membership.organization_name,
        'academic_year',membership.academic_year,
        'grade',membership.grade,
        'section_id',membership.section_id,
        'section_name',coalesce(section_row.name,membership.section,'Unassigned'),
        'board',membership.board,
        'tracks',membership.tracks
      )
      from public.profiles profile
      left join active_membership membership on true
      left join public.academic_sections section_row on section_row.id=membership.section_id
      where profile.id=v_student
    ),
    'products',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',product.id,
        'name',product.name,
        'exam_type',product.exam_type,
        'total_tests',product.total_tests,
        'completed_tests',product.completed_tests,
        'first_completed_date',product.first_completed_date,
        'last_completed_date',product.last_completed_date,
        'percentile_available',product.total_tests>0 and product.completed_tests>=product.total_tests
      ) order by product.name)
      from product_rows product
    ),'[]'::jsonb),
    'selected_product',(
      select jsonb_build_object(
        'id',product.id,
        'name',product.name,
        'exam_type',product.exam_type,
        'total_tests',product.total_tests,
        'completed_tests',product.completed_tests,
        'first_completed_date',product.first_completed_date,
        'last_completed_date',product.last_completed_date,
        'percentile_available',product.total_tests>0 and product.completed_tests>=product.total_tests
      ) from selected_product product
    ),
    'summary',(
      select jsonb_build_object(
        'completed_tests',coalesce(summary.completed_tests,0),
        'average_percentage',summary.average_percentage,
        'accuracy',summary.accuracy,
        'correct',coalesce(summary.correct,0),
        'incorrect',coalesce(summary.incorrect,0),
        'unanswered',coalesce(summary.unanswered,0),
        'time_score',summary.time_score,
        'average_percentile',case
          when p_product_id is not null
           and exists(select 1 from selected_product product where product.total_tests>0 and product.completed_tests>=product.total_tests)
          then summary.average_percentile else null end,
        'percentile_available',p_product_id is not null
          and exists(select 1 from selected_product product where product.total_tests>0 and product.completed_tests>=product.total_tests),
        'cohort_size',summary.comparison_size,
        'comparison_average_percentage',summary.comparison_average_percentage,
        'top10_threshold',summary.top10_threshold,
        'top5_threshold',summary.top5_threshold,
        'highest_percentage',summary.highest_percentage,
        'from_date',summary.from_date,
        'to_date',summary.to_date
      ) from summary
    ),
    'subjects',coalesce((
      select jsonb_agg(to_jsonb(subject) order by subject.subject_name)
      from subject_rows subject
    ),'[]'::jsonb),
    'trends',coalesce((
      select jsonb_agg(jsonb_build_object(
        'attempt_id',trend.id,
        'paper_id',trend.paper_id,
        'paper_title',trend.paper_title,
        'submitted_at',trend.submitted_at,
        'score',trend.score,
        'maximum_marks',trend.maximum_marks,
        'percentage',round(trend.percentage,1),
        'percentile',trend.percentile,
        'accuracy',round(100*trend.correct_count::numeric/greatest(trend.correct_count+trend.incorrect_count,1),1),
        'time_score',trend.time_score,
        'correct',trend.correct_count,
        'incorrect',trend.incorrect_count,
        'unanswered',trend.unanswered_count,
        'cohort_size',trend.comparison_size,
        'average_percentage',round(trend.average_percentage,1),
        'highest_percentage',round(trend.highest_percentage,1),
        'lowest_percentage',round(trend.lowest_percentage,1),
        'top5_threshold',round(trend.top5_threshold,1),
        'top10_threshold',round(trend.top10_threshold,1)
      ) order by trend.submitted_at)
      from trend_rows trend
    ),'[]'::jsonb),
    'timeline',case
      when p_product_id is not null then coalesce((
        select jsonb_agg(jsonb_build_object(
          'paper_id',product_paper.paper_id,
          'display_name',product_paper.display_name,
          'display_order',product_paper.display_order,
          'completed',attempt.id is not null,
          'submitted_at',attempt.submitted_at,
          'percentage',attempt.percentage
        ) order by product_paper.display_order)
        from public.product_papers product_paper
        left join lateral(
          select selected.id,selected.submitted_at,selected.percentage
          from public.exam_attempts selected
          where selected.paper_id=product_paper.paper_id
            and selected.student_id=v_student
            and selected.status='submitted'
          order by selected.submitted_at desc nulls last,selected.created_at desc,selected.id desc
          limit 1
        ) attempt on true
        where product_paper.product_id=p_product_id
      ),'[]'::jsonb)
      else coalesce((
        select jsonb_agg(jsonb_build_object(
          'paper_id',trend.paper_id,
          'display_name',trend.paper_title,
          'completed',true,
          'submitted_at',trend.submitted_at,
          'percentage',trend.percentage
        ) order by trend.submitted_at)
        from trend_rows trend
      ),'[]'::jsonb)
    end,
    'generated_at',now()
  ) into v_result;

  return coalesce(v_result,jsonb_build_object(
    'student',null,
    'products','[]'::jsonb,
    'selected_product',null,
    'summary',jsonb_build_object('completed_tests',0,'percentile_available',false),
    'subjects','[]'::jsonb,
    'trends','[]'::jsonb,
    'timeline','[]'::jsonb,
    'generated_at',now()
  ));
end;
$$;

grant execute on function public.get_student_analytics_overview_v10(uuid,uuid,date,date) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.student_calculation_ui_fixed','system','36c_v10_analytics_student_calculation_ui_fix',
  jsonb_build_object(
    'latest_attempt_per_test',true,
    'comparison_latest_attempt_per_student',true,
    'comparison_average',true,
    'top10_score',true,
    'top5_score',true,
    'highest_score',true
  ));

commit;
