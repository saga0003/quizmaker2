-- Evidara V10 Analytics Phase 2 — multi-metric comparison engine
-- Run after 36d_v10_analytics_100_student_demo_cohort.sql.

begin;

create or replace function public.analytics_test_snapshot_v11(
  p_paper_id uuid,
  p_student_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  with demo_exists as (
    select exists(select 1 from public.analytics_demo_test_results where paper_id=p_paper_id) as value
  ),
  latest_real as (
    select attempt.*,
      row_number() over(
        partition by attempt.student_id
        order by attempt.submitted_at desc nulls last,attempt.created_at desc,attempt.id desc
      ) as attempt_rank
    from public.exam_attempts attempt
    where attempt.paper_id=p_paper_id and attempt.status='submitted'
  ),
  values_scope as (
    select
      result.demo_student_id as participant_id,
      student.auth_user_id,
      result.percentage::numeric as percentage,
      result.accuracy_overall::numeric as accuracy,
      result.accuracy_attempted::numeric as attempted_accuracy,
      result.time_score::numeric as time_score
    from public.analytics_demo_test_results result
    join public.analytics_demo_students student on student.id=result.demo_student_id
    where result.paper_id=p_paper_id
    union all
    select
      attempt.student_id as participant_id,
      attempt.student_id as auth_user_id,
      attempt.percentage::numeric as percentage,
      round(100*attempt.correct_count::numeric/greatest(attempt.correct_count+attempt.incorrect_count+attempt.unanswered_count,1),2) as accuracy,
      round(100*attempt.correct_count::numeric/greatest(attempt.correct_count+attempt.incorrect_count,1),2) as attempted_accuracy,
      null::numeric as time_score
    from latest_real attempt
    cross join demo_exists demo
    where attempt.attempt_rank=1 and demo.value=false
  ),
  student_value as (
    select * from values_scope where auth_user_id=p_student_id limit 1
  ),
  aggregate as (
    select
      count(*)::integer as test_takers,
      avg(percentage) as percentage_average,
      min(percentage) as percentage_lowest,
      max(percentage) as percentage_highest,
      percentile_cont(0.90) within group(order by percentage) as percentage_top10,
      percentile_cont(0.95) within group(order by percentage) as percentage_top5,
      avg(accuracy) as accuracy_average,
      min(accuracy) as accuracy_lowest,
      max(accuracy) as accuracy_highest,
      percentile_cont(0.90) within group(order by accuracy) as accuracy_top10,
      percentile_cont(0.95) within group(order by accuracy) as accuracy_top5,
      avg(attempted_accuracy) as attempted_accuracy_average,
      min(attempted_accuracy) as attempted_accuracy_lowest,
      max(attempted_accuracy) as attempted_accuracy_highest,
      percentile_cont(0.90) within group(order by attempted_accuracy) as attempted_accuracy_top10,
      percentile_cont(0.95) within group(order by attempted_accuracy) as attempted_accuracy_top5,
      avg(time_score) filter(where time_score is not null) as time_average,
      min(time_score) filter(where time_score is not null) as time_lowest,
      max(time_score) filter(where time_score is not null) as time_highest,
      percentile_cont(0.90) within group(order by time_score) filter(where time_score is not null) as time_top10,
      percentile_cont(0.95) within group(order by time_score) filter(where time_score is not null) as time_top5
    from values_scope
  )
  select jsonb_build_object(
    'test_takers',aggregate.test_takers,
    'percentage_average',case when aggregate.test_takers>=2 then round(aggregate.percentage_average,1) end,
    'percentage_lowest',case when aggregate.test_takers>=2 then round(aggregate.percentage_lowest,1) end,
    'percentage_highest',case when aggregate.test_takers>=2 then round(aggregate.percentage_highest,1) end,
    'percentage_top10',case when aggregate.test_takers>=5 then round(aggregate.percentage_top10,1) end,
    'percentage_top5',case when aggregate.test_takers>=5 then round(aggregate.percentage_top5,1) end,
    'accuracy_average',case when aggregate.test_takers>=2 then round(aggregate.accuracy_average,1) end,
    'accuracy_lowest',case when aggregate.test_takers>=2 then round(aggregate.accuracy_lowest,1) end,
    'accuracy_highest',case when aggregate.test_takers>=2 then round(aggregate.accuracy_highest,1) end,
    'accuracy_top10',case when aggregate.test_takers>=5 then round(aggregate.accuracy_top10,1) end,
    'accuracy_top5',case when aggregate.test_takers>=5 then round(aggregate.accuracy_top5,1) end,
    'attempted_accuracy_average',case when aggregate.test_takers>=2 then round(aggregate.attempted_accuracy_average,1) end,
    'attempted_accuracy_lowest',case when aggregate.test_takers>=2 then round(aggregate.attempted_accuracy_lowest,1) end,
    'attempted_accuracy_highest',case when aggregate.test_takers>=2 then round(aggregate.attempted_accuracy_highest,1) end,
    'attempted_accuracy_top10',case when aggregate.test_takers>=5 then round(aggregate.attempted_accuracy_top10,1) end,
    'attempted_accuracy_top5',case when aggregate.test_takers>=5 then round(aggregate.attempted_accuracy_top5,1) end,
    'time_average',case when aggregate.test_takers>=2 then round(aggregate.time_average,1) end,
    'time_lowest',case when aggregate.test_takers>=2 then round(aggregate.time_lowest,1) end,
    'time_highest',case when aggregate.test_takers>=2 then round(aggregate.time_highest,1) end,
    'time_top10',case when aggregate.test_takers>=5 then round(aggregate.time_top10,1) end,
    'time_top5',case when aggregate.test_takers>=5 then round(aggregate.time_top5,1) end,
    'student_percentile',case when aggregate.test_takers>=2 and student.percentage is not null then round(
      100*(
        (select count(*) from values_scope lower_value where lower_value.percentage<student.percentage)
        +0.5*greatest(0,(select count(*) from values_scope equal_value where equal_value.percentage=student.percentage)-1)
      )/greatest(aggregate.test_takers-1,1),1
    ) end,
    'rank_position',case when student.percentage is not null then
      1+(select count(*) from values_scope higher_value where higher_value.percentage>student.percentage)
    end,
    'percentile_average',case when aggregate.test_takers>=2 then 50 end,
    'percentile_top10',case when aggregate.test_takers>=2 then 90 end,
    'percentile_top5',case when aggregate.test_takers>=2 then 95 end,
    'percentile_highest',case when aggregate.test_takers>=2 then 100 end
  )
  from aggregate
  left join student_value student on true;
$$;

create or replace function public.analytics_subject_snapshot_v11(
  p_student_id uuid,
  p_subject_name text,
  p_paper_ids uuid[]
)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  with values_scope as (
    select
      subject.demo_student_id,
      student.auth_user_id,
      100*sum(subject.marks)::numeric/greatest(sum(subject.maximum_marks),1) as percentage,
      100*sum(subject.correct_count)::numeric/greatest(sum(subject.correct_count+subject.incorrect_count+subject.unanswered_count),1) as accuracy,
      100*sum(subject.correct_count)::numeric/greatest(sum(subject.correct_count+subject.incorrect_count),1) as attempted_accuracy,
      avg(subject.time_score)::numeric as time_score
    from public.analytics_demo_subject_results subject
    join public.analytics_demo_students student on student.id=subject.demo_student_id
    where subject.subject_name=p_subject_name
      and subject.paper_id=any(coalesce(p_paper_ids,'{}'::uuid[]))
    group by subject.demo_student_id,student.auth_user_id
  ),
  student_value as (
    select * from values_scope where auth_user_id=p_student_id limit 1
  ),
  aggregate as (
    select
      count(*)::integer as students_compared,
      avg(percentage) as percentage_average,
      min(percentage) as percentage_lowest,
      max(percentage) as percentage_highest,
      percentile_cont(0.90) within group(order by percentage) as percentage_top10,
      percentile_cont(0.95) within group(order by percentage) as percentage_top5,
      avg(accuracy) as accuracy_average,
      min(accuracy) as accuracy_lowest,
      max(accuracy) as accuracy_highest,
      percentile_cont(0.90) within group(order by accuracy) as accuracy_top10,
      percentile_cont(0.95) within group(order by accuracy) as accuracy_top5,
      avg(attempted_accuracy) as attempted_accuracy_average,
      avg(time_score) as time_average,
      min(time_score) as time_lowest,
      max(time_score) as time_highest,
      percentile_cont(0.90) within group(order by time_score) as time_top10,
      percentile_cont(0.95) within group(order by time_score) as time_top5
    from values_scope
  )
  select jsonb_build_object(
    'cohort_size',aggregate.students_compared,
    'average_percentage',case when aggregate.students_compared>=2 then round(aggregate.percentage_average,1) end,
    'lowest_percentage',case when aggregate.students_compared>=2 then round(aggregate.percentage_lowest,1) end,
    'highest_percentage',case when aggregate.students_compared>=2 then round(aggregate.percentage_highest,1) end,
    'top10_threshold',case when aggregate.students_compared>=5 then round(aggregate.percentage_top10,1) end,
    'top5_threshold',case when aggregate.students_compared>=5 then round(aggregate.percentage_top5,1) end,
    'student_accuracy',round(student.accuracy,1),
    'student_attempted_accuracy',round(student.attempted_accuracy,1),
    'average_accuracy',case when aggregate.students_compared>=2 then round(aggregate.accuracy_average,1) end,
    'lowest_accuracy',case when aggregate.students_compared>=2 then round(aggregate.accuracy_lowest,1) end,
    'highest_accuracy',case when aggregate.students_compared>=2 then round(aggregate.accuracy_highest,1) end,
    'top10_accuracy',case when aggregate.students_compared>=5 then round(aggregate.accuracy_top10,1) end,
    'top5_accuracy',case when aggregate.students_compared>=5 then round(aggregate.accuracy_top5,1) end,
    'average_attempted_accuracy',case when aggregate.students_compared>=2 then round(aggregate.attempted_accuracy_average,1) end,
    'student_time_score',round(student.time_score,1),
    'average_time_score',case when aggregate.students_compared>=2 then round(aggregate.time_average,1) end,
    'lowest_time_score',case when aggregate.students_compared>=2 then round(aggregate.time_lowest,1) end,
    'highest_time_score',case when aggregate.students_compared>=2 then round(aggregate.time_highest,1) end,
    'top10_time_score',case when aggregate.students_compared>=5 then round(aggregate.time_top10,1) end,
    'top5_time_score',case when aggregate.students_compared>=5 then round(aggregate.time_top5,1) end
  )
  from aggregate
  left join student_value student on true;
$$;

create or replace function public.get_student_analytics_overview_v11(
  p_student_id uuid default auth.uid(),
  p_product_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_student uuid:=coalesce(p_student_id,auth.uid());
  v_payload jsonb;
  v_summary jsonb;
  v_trends jsonb:='[]'::jsonb;
  v_subjects jsonb:='[]'::jsonb;
  v_item jsonb;
  v_snapshot jsonb;
  v_paper_ids uuid[]:='{}'::uuid[];
  v_attempted_accuracy numeric;
  v_total_questions integer;
  v_comparison record;
begin
  v_payload:=public.get_student_analytics_overview_v10(v_student,p_product_id,p_from,p_to);
  v_summary:=coalesce(v_payload->'summary','{}'::jsonb);

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'trends','[]'::jsonb))
  loop
    v_snapshot:=public.analytics_test_snapshot_v11((v_item->>'paper_id')::uuid,v_student);
    v_attempted_accuracy:=nullif(v_item->>'accuracy','')::numeric;
    v_total_questions:=coalesce((v_item->>'correct')::integer,0)
      +coalesce((v_item->>'incorrect')::integer,0)
      +coalesce((v_item->>'unanswered')::integer,0);
    v_item:=v_item||coalesce(v_snapshot,'{}'::jsonb)||jsonb_build_object(
      'attempted_accuracy',v_attempted_accuracy,
      'accuracy',round(100*coalesce((v_item->>'correct')::integer,0)::numeric/greatest(v_total_questions,1),1)
    );
    v_trends:=v_trends||jsonb_build_array(v_item);
    v_paper_ids:=array_append(v_paper_ids,(v_item->>'paper_id')::uuid);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'subjects','[]'::jsonb))
  loop
    v_snapshot:=public.analytics_subject_snapshot_v11(v_student,v_item->>'subject_name',v_paper_ids);
    v_item:=v_item||coalesce(v_snapshot,'{}'::jsonb)||jsonb_build_object(
      'student_accuracy',coalesce((v_snapshot->>'student_accuracy')::numeric,
        round(100*coalesce((v_item->>'correct')::integer,0)::numeric/greatest(coalesce((v_item->>'questions')::integer,0),1),1)),
      'student_attempted_accuracy',coalesce((v_snapshot->>'student_attempted_accuracy')::numeric,
        round(100*coalesce((v_item->>'correct')::integer,0)::numeric/greatest(coalesce((v_item->>'correct')::integer,0)+coalesce((v_item->>'incorrect')::integer,0),1),1))
    );
    v_subjects:=v_subjects||jsonb_build_array(v_item);
  end loop;

  select
    max(nullif(trend->>'test_takers','')::integer) as comparison_size,
    round(avg(nullif(trend->>'percentage_average','')::numeric),1) as percentage_average,
    round(avg(nullif(trend->>'percentage_top10','')::numeric),1) as percentage_top10,
    round(avg(nullif(trend->>'percentage_top5','')::numeric),1) as percentage_top5,
    round(max(nullif(trend->>'percentage_highest','')::numeric),1) as percentage_highest,
    round(avg(nullif(trend->>'student_percentile','')::numeric),1) as student_percentile
  into v_comparison
  from jsonb_array_elements(v_trends) trend;

  v_total_questions:=coalesce((v_summary->>'correct')::integer,0)
    +coalesce((v_summary->>'incorrect')::integer,0)
    +coalesce((v_summary->>'unanswered')::integer,0);
  v_attempted_accuracy:=nullif(v_summary->>'accuracy','')::numeric;

  v_summary:=v_summary||jsonb_build_object(
    'total_questions',v_total_questions,
    'attempted_accuracy',v_attempted_accuracy,
    'accuracy',round(100*coalesce((v_summary->>'correct')::integer,0)::numeric/greatest(v_total_questions,1),1),
    'cohort_size',v_comparison.comparison_size,
    'comparison_average_percentage',v_comparison.percentage_average,
    'top10_threshold',v_comparison.percentage_top10,
    'top5_threshold',v_comparison.percentage_top5,
    'highest_percentage',v_comparison.percentage_highest,
    'average_percentile',case
      when coalesce((v_summary->>'percentile_available')::boolean,false) then v_comparison.student_percentile
      else null
    end
  );

  v_payload:=jsonb_set(v_payload,'{summary}',v_summary,true);
  v_payload:=jsonb_set(v_payload,'{trends}',v_trends,true);
  v_payload:=jsonb_set(v_payload,'{subjects}',v_subjects,true);
  return v_payload||jsonb_build_object('comparison_engine','v11');
end;
$$;

grant execute on function public.get_student_analytics_overview_v11(uuid,uuid,date,date) to authenticated;

create or replace function public.get_student_test_comparison_v11(
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
  v_snapshot jsonb;
  v_result record;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.analytics_can_view_student_v10(v_student) then
    raise exception 'You do not have access to this student test comparison.' using errcode='42501';
  end if;

  v_snapshot:=public.analytics_test_snapshot_v11(p_paper_id,v_student);

  select
    paper.title,
    product.id as product_id,
    product.name as product_name,
    coalesce(demo.submitted_at,attempt.submitted_at) as submitted_at,
    coalesce(demo.score,attempt.score) as score,
    coalesce(demo.maximum_marks,attempt.maximum_marks) as maximum_marks,
    coalesce(demo.percentage,attempt.percentage) as percentage,
    coalesce(demo.correct_count,attempt.correct_count) as correct_count,
    coalesce(demo.incorrect_count,attempt.incorrect_count) as incorrect_count,
    coalesce(demo.unanswered_count,attempt.unanswered_count) as unanswered_count,
    coalesce(demo.accuracy_overall,
      round(100*attempt.correct_count::numeric/greatest(attempt.correct_count+attempt.incorrect_count+attempt.unanswered_count,1),1)) as accuracy,
    coalesce(demo.accuracy_attempted,
      round(100*attempt.correct_count::numeric/greatest(attempt.correct_count+attempt.incorrect_count,1),1)) as attempted_accuracy,
    demo.time_score
  into v_result
  from public.question_papers paper
  left join public.product_papers product_paper on product_paper.paper_id=paper.id
  left join public.products product on product.id=product_paper.product_id
  left join lateral(
    select result.*
    from public.analytics_demo_test_results result
    join public.analytics_demo_students student on student.id=result.demo_student_id
    where result.paper_id=paper.id and student.auth_user_id=v_student
    limit 1
  ) demo on true
  left join lateral(
    select selected.*
    from public.exam_attempts selected
    where selected.paper_id=paper.id and selected.student_id=v_student and selected.status='submitted'
    order by selected.submitted_at desc nulls last,selected.created_at desc,selected.id desc
    limit 1
  ) attempt on true
  where paper.id=p_paper_id
  limit 1;

  if v_result.title is null then raise exception 'Test not found.'; end if;

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'paper_title',v_result.title,
    'product_id',v_result.product_id,
    'product_name',v_result.product_name,
    'submitted_at',v_result.submitted_at,
    'completed',v_result.percentage is not null,
    'test_takers',coalesce((v_snapshot->>'test_takers')::integer,0),
    'rank_position',(v_snapshot->>'rank_position')::integer,
    'student_percentile',(v_snapshot->>'student_percentile')::numeric,
    'student',jsonb_build_object(
      'score',v_result.score,
      'maximum_marks',v_result.maximum_marks,
      'percentage',v_result.percentage,
      'correct',coalesce(v_result.correct_count,0),
      'incorrect',coalesce(v_result.incorrect_count,0),
      'unanswered',coalesce(v_result.unanswered_count,0),
      'accuracy',v_result.accuracy,
      'attempted_accuracy',v_result.attempted_accuracy,
      'time_score',v_result.time_score
    ),
    'percentage',jsonb_build_object(
      'average',(v_snapshot->>'percentage_average')::numeric,
      'lowest',(v_snapshot->>'percentage_lowest')::numeric,
      'highest',(v_snapshot->>'percentage_highest')::numeric,
      'top10',(v_snapshot->>'percentage_top10')::numeric,
      'top5',(v_snapshot->>'percentage_top5')::numeric
    ),
    'accuracy',jsonb_build_object(
      'average',(v_snapshot->>'accuracy_average')::numeric,
      'lowest',(v_snapshot->>'accuracy_lowest')::numeric,
      'highest',(v_snapshot->>'accuracy_highest')::numeric,
      'top10',(v_snapshot->>'accuracy_top10')::numeric,
      'top5',(v_snapshot->>'accuracy_top5')::numeric
    ),
    'attempted_accuracy',jsonb_build_object(
      'average',(v_snapshot->>'attempted_accuracy_average')::numeric,
      'lowest',(v_snapshot->>'attempted_accuracy_lowest')::numeric,
      'highest',(v_snapshot->>'attempted_accuracy_highest')::numeric,
      'top10',(v_snapshot->>'attempted_accuracy_top10')::numeric,
      'top5',(v_snapshot->>'attempted_accuracy_top5')::numeric
    ),
    'time_score',jsonb_build_object(
      'average',(v_snapshot->>'time_average')::numeric,
      'lowest',(v_snapshot->>'time_lowest')::numeric,
      'highest',(v_snapshot->>'time_highest')::numeric,
      'top10',(v_snapshot->>'time_top10')::numeric,
      'top5',(v_snapshot->>'time_top5')::numeric
    )
  );
end;
$$;

grant execute on function public.get_student_test_comparison_v11(uuid,uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.comparison_engine_v11_ready','system','36e_v10_analytics_comparison_engine',
  jsonb_build_object(
    'percentage',true,'overall_accuracy',true,'attempted_accuracy',true,'time_score',true,
    'top10',true,'top5',true,'highest',true,'lowest',true,'test_detail_popup',true
  ));

commit;
