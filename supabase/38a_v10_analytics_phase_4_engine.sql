-- Evidara V10 Analytics Phase 4 — scoring engine and platform command centre
-- Run after 38_v10_analytics_phase_4.sql.

begin;

do $$
begin
  if to_regprocedure('public.analytics_test_snapshot_base_v12(uuid,uuid)') is null
     and to_regprocedure('public.analytics_test_snapshot_v11(uuid,uuid)') is not null then
    execute 'alter function public.analytics_test_snapshot_v11(uuid,uuid) rename to analytics_test_snapshot_base_v12';
  end if;
  if to_regprocedure('public.analytics_subject_snapshot_base_v12(uuid,text,uuid[])') is null
     and to_regprocedure('public.analytics_subject_snapshot_v11(uuid,text,uuid[])') is not null then
    execute 'alter function public.analytics_subject_snapshot_v11(uuid,text,uuid[]) rename to analytics_subject_snapshot_base_v12';
  end if;
  if to_regprocedure('public.get_student_analytics_overview_base_v12(uuid,uuid,date,date)') is null
     and to_regprocedure('public.get_student_analytics_overview_v11(uuid,uuid,date,date)') is not null then
    execute 'alter function public.get_student_analytics_overview_v11(uuid,uuid,date,date) rename to get_student_analytics_overview_base_v12';
  end if;
  if to_regprocedure('public.get_student_test_comparison_base_v12(uuid,uuid)') is null
     and to_regprocedure('public.get_student_test_comparison_v11(uuid,uuid)') is not null then
    execute 'alter function public.get_student_test_comparison_v11(uuid,uuid) rename to get_student_test_comparison_base_v12';
  end if;
end;
$$;

create or replace function public.analytics_attempt_time_snapshot_v12(p_paper_id uuid,p_student_id uuid)
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
  v_duration integer:=0;
  v_actual integer:=0;
  v_auto boolean:=false;
  v_score numeric;
begin
  select result.*,student.auth_user_id into v_demo
  from public.analytics_demo_test_results result
  join public.analytics_demo_students student on student.id=result.demo_student_id
  where result.paper_id=p_paper_id and student.auth_user_id=p_student_id
  order by result.submitted_at desc limit 1;

  if v_demo.id is not null then
    v_total:=v_demo.correct_count+v_demo.incorrect_count+v_demo.unanswered_count;
    v_attempted:=v_demo.correct_count+v_demo.incorrect_count;
    v_duration:=v_demo.duration_minutes;
    v_actual:=v_demo.actual_time_seconds;
    v_auto:=v_demo.ended_automatically;
    v_score:=public.analytics_time_management_score_v12(v_total,v_attempted,v_demo.correct_count,v_duration,v_actual,v_auto);
  else
    select attempt.*,paper.duration_minutes into v_attempt
    from public.exam_attempts attempt
    join public.question_papers paper on paper.id=attempt.paper_id
    where attempt.paper_id=p_paper_id and attempt.student_id=p_student_id and attempt.status='submitted'
    order by attempt.submitted_at desc nulls last,attempt.created_at desc,attempt.id desc limit 1;
    if v_attempt.id is null then return null; end if;
    v_total:=coalesce(v_attempt.correct_count,0)+coalesce(v_attempt.incorrect_count,0)+coalesce(v_attempt.unanswered_count,0);
    v_attempted:=coalesce(v_attempt.correct_count,0)+coalesce(v_attempt.incorrect_count,0);
    v_duration:=coalesce(v_attempt.duration_minutes,0);
    v_actual:=greatest(0,extract(epoch from (v_attempt.submitted_at-v_attempt.started_at))::integer);
    v_auto:=coalesce((v_attempt.metadata->>'ended_automatically')::boolean,false)
      or lower(coalesce(v_attempt.metadata->>'submission_reason','')) in ('timeout','auto','auto_submit','expired')
      or (v_attempt.expires_at is not null and v_attempt.submitted_at>=v_attempt.expires_at-interval '5 seconds');
    v_score:=public.analytics_time_management_score_v12(v_total,v_attempted,v_attempt.correct_count,v_duration,v_actual,v_auto);
  end if;

  return jsonb_build_object(
    'score',v_score,
    'rating',public.analytics_time_management_rating_v12(v_score),
    'total_questions',v_total,
    'attempted_questions',v_attempted,
    'correct_answers',case when v_demo.id is not null then v_demo.correct_count else v_attempt.correct_count end,
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

create or replace function public.analytics_test_snapshot_v11(p_paper_id uuid,p_student_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_base jsonb;
  v_time record;
begin
  v_base:=coalesce(public.analytics_test_snapshot_base_v12(p_paper_id,p_student_id),'{}'::jsonb);

  with demo_exists as (
    select exists(select 1 from public.analytics_demo_test_results where paper_id=p_paper_id) value
  ), latest_real as (
    select attempt.*,paper.duration_minutes,
      row_number() over(partition by attempt.student_id order by attempt.submitted_at desc nulls last,attempt.created_at desc,attempt.id desc) rn
    from public.exam_attempts attempt join public.question_papers paper on paper.id=attempt.paper_id
    where attempt.paper_id=p_paper_id and attempt.status='submitted'
  ), time_values as (
    select result.demo_student_id::text participant,
      public.analytics_time_management_score_v12(
        result.correct_count+result.incorrect_count+result.unanswered_count,
        result.correct_count+result.incorrect_count,result.correct_count,
        result.duration_minutes,result.actual_time_seconds,result.ended_automatically
      ) score
    from public.analytics_demo_test_results result where result.paper_id=p_paper_id
    union all
    select attempt.student_id::text,
      public.analytics_time_management_score_v12(
        attempt.correct_count+attempt.incorrect_count+attempt.unanswered_count,
        attempt.correct_count+attempt.incorrect_count,attempt.correct_count,
        attempt.duration_minutes,
        greatest(0,extract(epoch from(attempt.submitted_at-attempt.started_at))::integer),
        coalesce((attempt.metadata->>'ended_automatically')::boolean,false)
          or lower(coalesce(attempt.metadata->>'submission_reason','')) in ('timeout','auto','auto_submit','expired')
          or (attempt.expires_at is not null and attempt.submitted_at>=attempt.expires_at-interval '5 seconds')
      )
    from latest_real attempt cross join demo_exists demo where attempt.rn=1 and demo.value=false
  )
  select count(*)::integer students,avg(score) average,min(score) lowest,max(score) highest,
    percentile_cont(.90) within group(order by score) top10,
    percentile_cont(.95) within group(order by score) top5
  into v_time from time_values;

  return v_base||jsonb_build_object(
    'time_average',case when v_time.students>=2 then round(v_time.average::numeric,1) end,
    'time_lowest',case when v_time.students>=2 then round(v_time.lowest::numeric,1) end,
    'time_highest',case when v_time.students>=2 then round(v_time.highest::numeric,1) end,
    'time_top10',case when v_time.students>=5 then round(v_time.top10::numeric,1) end,
    'time_top5',case when v_time.students>=5 then round(v_time.top5::numeric,1) end
  );
end;
$$;

grant execute on function public.analytics_test_snapshot_v11(uuid,uuid) to authenticated;
revoke execute on function public.analytics_test_snapshot_base_v12(uuid,uuid) from authenticated;

create or replace function public.analytics_subject_snapshot_v11(p_student_id uuid,p_subject_name text,p_paper_ids uuid[])
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_base jsonb;
  v_time record;
  v_student_score numeric;
begin
  v_base:=coalesce(public.analytics_subject_snapshot_base_v12(p_student_id,p_subject_name,p_paper_ids),'{}'::jsonb);

  with demo_exists as (
    select exists(select 1 from public.analytics_demo_subject_results where subject_name=p_subject_name and paper_id=any(coalesce(p_paper_ids,'{}'::uuid[]))) value
  ), demo_values as (
    select result.demo_student_id::text participant,student.auth_user_id,
      avg(test.time_score)::numeric score
    from public.analytics_demo_subject_results result
    join public.analytics_demo_students student on student.id=result.demo_student_id
    join public.analytics_demo_test_results test on test.demo_student_id=result.demo_student_id and test.paper_id=result.paper_id
    where result.subject_name=p_subject_name and result.paper_id=any(coalesce(p_paper_ids,'{}'::uuid[]))
    group by result.demo_student_id,student.auth_user_id
  ), latest_real as (
    select attempt.*,paper.duration_minutes,
      row_number() over(partition by attempt.student_id,attempt.paper_id order by attempt.submitted_at desc nulls last,attempt.created_at desc,attempt.id desc) rn
    from public.exam_attempts attempt
    join public.question_papers paper on paper.id=attempt.paper_id
    where attempt.paper_id=any(coalesce(p_paper_ids,'{}'::uuid[])) and attempt.status='submitted'
      and exists(select 1 from public.paper_sections section where section.paper_id=attempt.paper_id and lower(section.title)=lower(p_subject_name))
  ), real_values as (
    select attempt.student_id::text participant,attempt.student_id auth_user_id,
      avg(public.analytics_time_management_score_v12(
        attempt.correct_count+attempt.incorrect_count+attempt.unanswered_count,
        attempt.correct_count+attempt.incorrect_count,attempt.correct_count,attempt.duration_minutes,
        greatest(0,extract(epoch from(attempt.submitted_at-attempt.started_at))::integer),
        coalesce((attempt.metadata->>'ended_automatically')::boolean,false)
          or lower(coalesce(attempt.metadata->>'submission_reason','')) in ('timeout','auto','auto_submit','expired')
          or (attempt.expires_at is not null and attempt.submitted_at>=attempt.expires_at-interval '5 seconds')
      ))::numeric score
    from latest_real attempt cross join demo_exists demo where attempt.rn=1 and demo.value=false
    group by attempt.student_id
  ), values_scope as (
    select * from demo_values union all select * from real_values
  )
  select count(*)::integer students,avg(score) average,min(score) lowest,max(score) highest,
    percentile_cont(.90) within group(order by score) top10,
    percentile_cont(.95) within group(order by score) top5,
    max(score) filter(where auth_user_id=p_student_id) student_score
  into v_time from values_scope;

  v_student_score:=v_time.student_score;
  return v_base||jsonb_build_object(
    'student_time_score',case when v_student_score is not null then round(v_student_score,1) end,
    'average_time_score',case when v_time.students>=2 then round(v_time.average::numeric,1) end,
    'lowest_time_score',case when v_time.students>=2 then round(v_time.lowest::numeric,1) end,
    'highest_time_score',case when v_time.students>=2 then round(v_time.highest::numeric,1) end,
    'top10_time_score',case when v_time.students>=5 then round(v_time.top10::numeric,1) end,
    'top5_time_score',case when v_time.students>=5 then round(v_time.top5::numeric,1) end
  );
end;
$$;

grant execute on function public.analytics_subject_snapshot_v11(uuid,text,uuid[]) to authenticated;
revoke execute on function public.analytics_subject_snapshot_base_v12(uuid,text,uuid[]) from authenticated;

create or replace function public.get_student_analytics_overview_v11(
  p_student_id uuid default auth.uid(),p_product_id uuid default null,p_from date default null,p_to date default null
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
  v_time jsonb;
  v_average numeric;
  v_complete boolean;
begin
  v_payload:=public.get_student_analytics_overview_base_v12(v_student,p_product_id,p_from,p_to);
  v_summary:=coalesce(v_payload->'summary','{}'::jsonb);
  v_complete:=p_product_id is null or coalesce((v_summary->>'percentile_available')::boolean,false);

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'trends','[]'::jsonb)) loop
    v_time:=public.analytics_attempt_time_snapshot_v12((v_item->>'paper_id')::uuid,v_student);
    if v_time is not null then
      v_item:=v_item||jsonb_build_object(
        'time_score',(v_time->>'score')::numeric,
        'time_rating',v_time->>'rating',
        'time_duration_minutes',(v_time->>'duration_minutes')::integer,
        'time_used_minutes',(v_time->>'actual_time_minutes')::numeric,
        'ended_automatically',(v_time->>'ended_automatically')::boolean,
        'time_insight',v_time->>'insight'
      );
    end if;
    v_trends:=v_trends||jsonb_build_array(v_item);
  end loop;

  select round(avg((item->>'time_score')::numeric),1) into v_average
  from jsonb_array_elements(v_trends) item where nullif(item->>'time_score','') is not null;

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'subjects','[]'::jsonb)) loop
    if p_product_id is not null and not v_complete then
      v_item:=v_item-jsonb_build_array('student_time_score','average_time_score','lowest_time_score','highest_time_score','top10_time_score','top5_time_score');
      v_item:=v_item||jsonb_build_object('time_score_available',false,'time_score_lock_reason','Complete every compulsory test in the selected series.');
    else
      v_item:=v_item||jsonb_build_object('time_score_available',true);
    end if;
    v_subjects:=v_subjects||jsonb_build_array(v_item);
  end loop;

  v_summary:=v_summary||jsonb_build_object(
    'time_score',case when v_complete then v_average else null end,
    'time_score_available',v_complete,
    'time_score_rating',case when v_complete and v_average is not null then public.analytics_time_management_rating_v12(v_average) end,
    'time_score_supporting_indicator',true,
    'time_score_scientific_measurement',false,
    'time_score_formula','50% completion + 30% answered-question accuracy + 20% time control',
    'time_score_lock_reason',case when not v_complete then 'Complete all compulsory tests in the selected series to display the overall score.' end
  );

  return jsonb_set(jsonb_set(jsonb_set(v_payload,'{summary}',v_summary,true),'{trends}',v_trends,true),'{subjects}',v_subjects,true)
    ||jsonb_build_object('time_management_engine','v12-simple');
end;
$$;

grant execute on function public.get_student_analytics_overview_v11(uuid,uuid,date,date) to authenticated;
revoke execute on function public.get_student_analytics_overview_base_v12(uuid,uuid,date,date) from authenticated;

create or replace function public.get_student_test_comparison_v11(p_student_id uuid,p_paper_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_payload jsonb;
  v_time jsonb;
  v_snapshot jsonb;
begin
  v_payload:=public.get_student_test_comparison_base_v12(p_student_id,p_paper_id);
  v_time:=public.analytics_attempt_time_snapshot_v12(p_paper_id,p_student_id);
  v_snapshot:=public.analytics_test_snapshot_v11(p_paper_id,p_student_id);
  if v_time is not null then
    v_payload:=jsonb_set(v_payload,'{student}',coalesce(v_payload->'student','{}'::jsonb)||jsonb_build_object(
      'time_score',(v_time->>'score')::numeric,'time_rating',v_time->>'rating',
      'duration_minutes',(v_time->>'duration_minutes')::integer,'actual_time_minutes',(v_time->>'actual_time_minutes')::numeric,
      'ended_automatically',(v_time->>'ended_automatically')::boolean,'time_insight',v_time->>'insight'
    ),true);
  end if;
  v_payload:=jsonb_set(v_payload,'{time_score}',jsonb_build_object(
    'average',(v_snapshot->>'time_average')::numeric,'lowest',(v_snapshot->>'time_lowest')::numeric,
    'highest',(v_snapshot->>'time_highest')::numeric,'top10',(v_snapshot->>'time_top10')::numeric,'top5',(v_snapshot->>'time_top5')::numeric
  ),true);
  return v_payload||jsonb_build_object('time_management_engine','v12-simple');
end;
$$;

grant execute on function public.get_student_test_comparison_v11(uuid,uuid) to authenticated;
revoke execute on function public.get_student_test_comparison_base_v12(uuid,uuid) from authenticated;

create or replace function public.get_platform_analytics_overview_v12()
returns jsonb
language plpgsql
volatile
security definer
set search_path=public
as $$
begin
  if not public.analytics_is_platform_admin_v10() then raise exception 'Evidara Admin or Super Admin access required.' using errcode='42501'; end if;

  return (
    with latest_real as (
      select attempt.*,row_number() over(partition by attempt.student_id,attempt.paper_id order by attempt.submitted_at desc nulls last,attempt.created_at desc,attempt.id desc) rn
      from public.exam_attempts attempt where attempt.status='submitted' and not(attempt.metadata?'demo_batch_id')
    ), result_rows as (
      select attempt.organization_id,attempt.student_id::text participant_id,attempt.paper_id,attempt.submitted_at,
        attempt.percentage::numeric percentage,
        round(100*attempt.correct_count::numeric/greatest(attempt.correct_count+attempt.incorrect_count+attempt.unanswered_count,1),2) accuracy,
        public.analytics_time_management_score_v12(
          attempt.correct_count+attempt.incorrect_count+attempt.unanswered_count,attempt.correct_count+attempt.incorrect_count,attempt.correct_count,
          paper.duration_minutes,greatest(0,extract(epoch from(attempt.submitted_at-attempt.started_at))::integer),
          coalesce((attempt.metadata->>'ended_automatically')::boolean,false)
            or lower(coalesce(attempt.metadata->>'submission_reason','')) in ('timeout','auto','auto_submit','expired')
            or (attempt.expires_at is not null and attempt.submitted_at>=attempt.expires_at-interval '5 seconds')
        ) time_score
      from latest_real attempt join public.question_papers paper on paper.id=attempt.paper_id where attempt.rn=1
      union all
      select batch.organization_id,result.demo_student_id::text,result.paper_id,result.submitted_at,result.percentage,result.accuracy_overall,result.time_score
      from public.analytics_demo_test_results result join public.analytics_demo_batches batch on batch.id=result.batch_id and batch.status='ready'
    ), membership_counts as (
      select organization_id,count(distinct student_id)::integer students,
        count(distinct student_id) filter(where section_id is not null)::integer section_assigned
      from public.student_school_memberships where status='active' group by organization_id
    ), demo_counts as (
      select organization_id,max(generated_students)::integer students from public.analytics_demo_batches where status='ready' group by organization_id
    ), school_metrics as (
      select organization.id,organization.name,organization.city,organization.state,organization.board,
        greatest(coalesce(membership.students,0),coalesce(demo.students,0))::integer total_students,
        count(distinct result.participant_id) filter(where result.submitted_at>=now()-interval '30 days')::integer active_students,
        count(result.paper_id)::integer completed_tests,
        round(avg(result.percentage),1) average_percentage,
        round(avg(result.accuracy),1) accuracy,
        round(avg(result.time_score),1) time_score,
        max(result.submitted_at) last_activity,
        coalesce(membership.section_assigned,0)::integer section_assigned
      from public.organizations organization
      left join membership_counts membership on membership.organization_id=organization.id
      left join demo_counts demo on demo.organization_id=organization.id
      left join result_rows result on result.organization_id=organization.id
      where organization.status='active'
      group by organization.id,organization.name,organization.city,organization.state,organization.board,membership.students,demo.students,membership.section_assigned
    ), schools as (
      select school.*,
        case when school.total_students>0 then round(100*school.active_students::numeric/school.total_students,1) else 0 end participation,
        round(least(100,
          case when school.total_students>0 then 50*school.active_students::numeric/school.total_students else 0 end
          +case when school.total_students>0 then 50*least(1,school.completed_tests::numeric/greatest(school.total_students*3,1)) else 0 end
        ),1) adoption_score,
        (case when school.total_students>0 and school.section_assigned<school.total_students then 1 else 0 end
          +case when school.last_activity is null or school.last_activity<now()-interval '30 days' then 1 else 0 end
          +case when school.completed_tests=0 then 1 else 0 end)::integer data_quality_warnings
      from school_metrics school
    ), summary as (
      select count(*)::integer schools,sum(total_students)::integer students,sum(active_students)::integer active_students,
        sum(completed_tests)::integer completed_tests,round(avg(average_percentage),1) average_percentage,
        round(avg(accuracy),1) accuracy,round(avg(time_score),1) time_score,
        sum(data_quality_warnings)::integer data_quality_warnings
      from schools
    ), chapter_school as (
      select batch.organization_id,chapter.id,chapter.subject_name,chapter.name,
        100*sum(result.marks)/greatest(sum(result.maximum_marks),1) percentage
      from public.analytics_demo_topic_results_v12 result
      join public.analytics_demo_chapters_v12 chapter on chapter.id=result.chapter_id
      join public.analytics_demo_batches batch on batch.id=result.batch_id and batch.status='ready'
      group by batch.organization_id,chapter.id,chapter.subject_name,chapter.name
    ), chapter_benchmark as (
      select id,subject_name,name,count(*)::integer schools_compared,round(avg(percentage),1) average,
        round(min(percentage),1) lowest,round(max(percentage),1) highest
      from chapter_school group by id,subject_name,name
    ), topic_school as (
      select batch.organization_id,topic.id,topic.subject_name,chapter.name chapter_name,topic.name,
        100*sum(result.marks)/greatest(sum(result.maximum_marks),1) percentage
      from public.analytics_demo_topic_results_v12 result
      join public.analytics_demo_topics_v12 topic on topic.id=result.topic_id
      join public.analytics_demo_chapters_v12 chapter on chapter.id=topic.chapter_id
      join public.analytics_demo_batches batch on batch.id=result.batch_id and batch.status='ready'
      group by batch.organization_id,topic.id,topic.subject_name,chapter.name,topic.name
    ), topic_benchmark as (
      select id,subject_name,chapter_name,name,count(*)::integer schools_compared,round(avg(percentage),1) average,
        round(min(percentage),1) lowest,round(max(percentage),1) highest
      from topic_school group by id,subject_name,chapter_name,name
    )
    select jsonb_build_object(
      'summary',(select to_jsonb(summary) from summary),
      'schools',coalesce((select jsonb_agg(to_jsonb(schools) order by adoption_score desc,name) from schools),'[]'::jsonb),
      'chapters',coalesce((select jsonb_agg(to_jsonb(chapter_benchmark) order by average,subject_name,name) from chapter_benchmark),'[]'::jsonb),
      'topics',coalesce((select jsonb_agg(to_jsonb(topic_benchmark) order by average,subject_name,chapter_name,name) from topic_benchmark),'[]'::jsonb),
      'data_quality',coalesce((select jsonb_agg(jsonb_build_object(
        'organization_id',school.id,'school_name',school.name,'warning_count',school.data_quality_warnings,
        'missing_section_assignments',greatest(0,school.total_students-school.section_assigned),
        'no_recent_activity',school.last_activity is null or school.last_activity<now()-interval '30 days',
        'no_completed_tests',school.completed_tests=0
      ) order by school.data_quality_warnings desc,school.name) from schools school where school.data_quality_warnings>0),'[]'::jsonb),
      'recent_governance',coalesce((select jsonb_agg(jsonb_build_object('action',audit.action,'entity_type',audit.entity_type,'entity_id',audit.entity_id,'created_at',audit.created_at,'metadata',audit.metadata) order by audit.created_at desc) from (select * from public.audit_logs where action like 'analytics.%' order by created_at desc limit 30) audit),'[]'::jsonb),
      'generated_at',now(),'cache_seconds',0,'anonymous_benchmarks',true
    )
  );
end;
$$;

grant execute on function public.get_platform_analytics_overview_v12() to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.phase4.engine_ready','system','38a_v10_analytics_phase_4_engine',jsonb_build_object('platform_command_centre',true,'time_formula','v12-simple','question_target_times',false,'chapter_topic_benchmarks',true));

commit;
