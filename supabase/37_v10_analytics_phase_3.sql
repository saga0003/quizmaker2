-- Evidara V10 Analytics Phase 3
-- Run after 36g_v10_analytics_comparison_hardening.sql.
-- Adds school-wide analytics, interventions, detailed answer review and report-ready payloads.

begin;

create table if not exists public.analytics_interventions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid references public.profiles(id) on delete cascade,
  demo_student_id uuid references public.analytics_demo_students(id) on delete cascade,
  title text not null,
  note text,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  status text not null default 'open' check (status in ('open','in_progress','resolved','dismissed')),
  due_date date,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (student_id is not null or demo_student_id is not null),
  check (length(btrim(title)) between 2 and 160)
);

create index if not exists analytics_interventions_scope_idx
  on public.analytics_interventions(organization_id,status,priority,due_date);
create index if not exists analytics_interventions_student_idx
  on public.analytics_interventions(student_id,demo_student_id,status);

alter table public.analytics_interventions enable row level security;

drop policy if exists analytics_interventions_read_v12 on public.analytics_interventions;
create policy analytics_interventions_read_v12
on public.analytics_interventions for select to authenticated
using (public.analytics_is_school_admin_v10(organization_id));

revoke insert,update,delete on public.analytics_interventions from authenticated;
grant select on public.analytics_interventions to authenticated;

create or replace function public.upsert_analytics_intervention_v12(
  p_intervention_id uuid,
  p_organization_id uuid,
  p_student_id uuid default null,
  p_demo_student_id uuid default null,
  p_title text default 'Academic follow-up',
  p_note text default null,
  p_priority text default 'medium',
  p_status text default 'open',
  p_due_date date default null,
  p_assigned_to uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.analytics_is_school_admin_v10(p_organization_id) then
    raise exception 'School Admin, Evidara Admin or Super Admin access required.' using errcode='42501';
  end if;
  if p_student_id is null and p_demo_student_id is null then
    raise exception 'Choose a student for this follow-up.';
  end if;
  if p_priority not in ('low','medium','high','urgent') then raise exception 'Invalid priority.'; end if;
  if p_status not in ('open','in_progress','resolved','dismissed') then raise exception 'Invalid intervention status.'; end if;
  if length(btrim(coalesce(p_title,'')))<2 then raise exception 'Follow-up title is required.'; end if;

  if p_intervention_id is null then
    insert into public.analytics_interventions(
      organization_id,student_id,demo_student_id,title,note,priority,status,due_date,assigned_to,created_by,resolved_at
    ) values(
      p_organization_id,p_student_id,p_demo_student_id,btrim(p_title),nullif(btrim(coalesce(p_note,'')),''),
      p_priority,p_status,p_due_date,p_assigned_to,auth.uid(),case when p_status='resolved' then now() end
    ) returning id into v_id;
  else
    update public.analytics_interventions
    set title=btrim(p_title),note=nullif(btrim(coalesce(p_note,'')),''),priority=p_priority,status=p_status,
        due_date=p_due_date,assigned_to=p_assigned_to,updated_at=now(),
        resolved_at=case when p_status='resolved' then coalesce(resolved_at,now()) else null end
    where id=p_intervention_id and organization_id=p_organization_id
    returning id into v_id;
    if v_id is null then raise exception 'Follow-up record not found.'; end if;
  end if;

  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),p_organization_id,'analytics.intervention.saved','analytics_intervention',v_id::text,
    jsonb_build_object('priority',p_priority,'status',p_status,'student_id',p_student_id,'demo_student_id',p_demo_student_id));
  return v_id;
end;
$$;

grant execute on function public.upsert_analytics_intervention_v12(uuid,uuid,uuid,uuid,text,text,text,text,date,uuid) to authenticated;

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
      select string_agg(coalesce(option_row->>'option_key','')||'. '||coalesce(option_row->>'content_text',''),'; ' order by coalesce((option_row->>'display_order')::integer,0))
      from jsonb_array_elements(coalesce(paper_question.question_snapshot->'options','[]'::jsonb)) option_row
      where option_row->>'option_key' in (
        select selected_key from jsonb_array_elements_text(coalesce(response.response,'[]'::jsonb)) selected_key
      )
    ),case when response.response is null then 'Not answered' else response.response::text end),
    'correct_keys',coalesce(paper_question.question_snapshot->'correct_answer',question.correct_answer,'[]'::jsonb),
    'correct_answer',coalesce((
      select string_agg(coalesce(option_row->>'option_key','')||'. '||coalesce(option_row->>'content_text',''),'; ' order by coalesce((option_row->>'display_order')::integer,0))
      from jsonb_array_elements(coalesce(paper_question.question_snapshot->'options','[]'::jsonb)) option_row
      where option_row->>'option_key' in (
        select correct_key from jsonb_array_elements_text(coalesce(paper_question.question_snapshot->'correct_answer',question.correct_answer,'[]'::jsonb)) correct_key
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

create or replace function public.get_school_analytics_overview_v12(
  p_organization_id uuid,
  p_academic_year text default null,
  p_grade integer default null,
  p_section_id uuid default null,
  p_product_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.analytics_is_school_admin_v10(p_organization_id) then
    raise exception 'You do not have access to this school analytics workspace.' using errcode='42501';
  end if;

  with
  ready_demo_batches as (
    select batch.*
    from public.analytics_demo_batches batch
    where batch.organization_id=p_organization_id and batch.status='ready'
  ),
  real_memberships as (
    select membership.student_id,membership.academic_year,membership.grade,membership.section_id,
      coalesce(section_row.name,membership.section,'Unassigned') as section_name,
      coalesce(profile.full_name,'Student') as full_name,
      coalesce(membership.tracks,'{}'::text[]) as tracks
    from public.student_school_memberships membership
    join public.profiles profile on profile.id=membership.student_id
    left join public.academic_sections section_row on section_row.id=membership.section_id
    where membership.organization_id=p_organization_id and membership.status='active'
      and (p_academic_year is null or membership.academic_year=p_academic_year)
      and (p_grade is null or membership.grade=p_grade)
      and (p_section_id is null or membership.section_id=p_section_id)
      and not exists(
        select 1 from public.analytics_demo_students demo_student
        join ready_demo_batches batch on batch.id=demo_student.batch_id
        where demo_student.auth_user_id=membership.student_id
      )
  ),
  demo_membership as (
    select membership.academic_year,membership.grade,batch.section_id
    from ready_demo_batches batch
    left join public.student_school_memberships membership on membership.id=batch.membership_id
    order by batch.created_at desc limit 1
  ),
  demo_students as (
    select demo_student.auth_user_id as student_id,demo_student.id as demo_student_id,
      coalesce(demo_membership.academic_year,'2026-27') as academic_year,
      coalesce(demo_membership.grade,11) as grade,
      demo_membership.section_id,
      demo_student.section_label as section_name,
      demo_student.full_name,
      array[demo_student.track]::text[] as tracks
    from public.analytics_demo_students demo_student
    join ready_demo_batches batch on batch.id=demo_student.batch_id
    left join demo_membership on true
    where (p_academic_year is null or coalesce(demo_membership.academic_year,'2026-27')=p_academic_year)
      and (p_grade is null or coalesce(demo_membership.grade,11)=p_grade)
      and (p_section_id is null or demo_membership.section_id=p_section_id)
  ),
  participants as (
    select ('real:'||membership.student_id::text) as participant_key,membership.student_id,null::uuid as demo_student_id,
      membership.academic_year,membership.grade,membership.section_id,membership.section_name,membership.full_name,membership.tracks
    from real_memberships membership
    union all
    select ('demo:'||demo.demo_student_id::text),demo.student_id,demo.demo_student_id,demo.academic_year,demo.grade,
      demo.section_id,demo.section_name,demo.full_name,demo.tracks
    from demo_students demo
  ),
  ranked_real_attempts as (
    select attempt.*,product.id as product_id,product.name as product_name,paper.title as paper_title,
      row_number() over(partition by attempt.student_id,attempt.paper_id order by attempt.submitted_at desc nulls last,attempt.created_at desc,attempt.id desc) as attempt_rank
    from public.exam_attempts attempt
    join real_memberships membership on membership.student_id=attempt.student_id
    join public.question_papers paper on paper.id=attempt.paper_id
    left join public.product_papers product_paper on product_paper.paper_id=attempt.paper_id
    left join public.products product on product.id=product_paper.product_id
    where attempt.status='submitted'
      and (p_product_id is null or product.id=p_product_id)
      and not exists(select 1 from public.analytics_demo_test_results demo_result where demo_result.paper_id=attempt.paper_id)
  ),
  real_results as (
    select ('real:'||attempt.student_id::text) as participant_key,attempt.student_id,null::uuid as demo_student_id,
      attempt.product_id,attempt.product_name,attempt.paper_id,attempt.paper_title,attempt.submitted_at,
      attempt.score,attempt.maximum_marks,attempt.percentage,attempt.correct_count,attempt.incorrect_count,attempt.unanswered_count,
      round(100*attempt.correct_count::numeric/greatest(attempt.correct_count+attempt.incorrect_count+attempt.unanswered_count,1),2) as accuracy,
      null::numeric as time_score
    from ranked_real_attempts attempt where attempt.attempt_rank=1
  ),
  demo_results as (
    select ('demo:'||result.demo_student_id::text) as participant_key,student.auth_user_id as student_id,result.demo_student_id,
      result.product_id,product.name as product_name,result.paper_id,paper.title as paper_title,result.submitted_at,
      result.score,result.maximum_marks,result.percentage,result.correct_count,result.incorrect_count,result.unanswered_count,
      result.accuracy_overall as accuracy,result.time_score
    from public.analytics_demo_test_results result
    join public.analytics_demo_students student on student.id=result.demo_student_id
    join ready_demo_batches batch on batch.id=result.batch_id
    join public.products product on product.id=result.product_id
    join public.question_papers paper on paper.id=result.paper_id
    where (p_product_id is null or result.product_id=p_product_id)
  ),
  result_rows as (
    select * from real_results
    union all
    select * from demo_results
  ),
  real_subject_rows as (
    select ('real:'||attempt.student_id::text) as participant_key,
      coalesce(subject.name,paper_section.title,paper_question.question_snapshot->>'subject_name','General') as subject_name,
      sum(coalesce(response.marks_awarded,0))::numeric as marks,
      sum(paper_question.marks)::numeric as maximum_marks,
      count(*) filter(where response.is_correct=true)::integer as correct_count,
      count(*) filter(where response.is_correct=false)::integer as incorrect_count,
      count(*) filter(where response.is_correct is null)::integer as unanswered_count,
      null::numeric as time_score
    from ranked_real_attempts attempt
    join public.exam_responses response on response.attempt_id=attempt.id
    join public.paper_questions paper_question on paper_question.id=response.paper_question_id
    join public.paper_sections paper_section on paper_section.id=paper_question.section_id
    left join public.subjects subject on subject.id=paper_section.subject_id
    where attempt.attempt_rank=1
    group by attempt.student_id,2
  ),
  demo_subject_rows as (
    select ('demo:'||subject_result.demo_student_id::text) as participant_key,subject_result.subject_name,
      sum(subject_result.marks)::numeric as marks,sum(subject_result.maximum_marks)::numeric as maximum_marks,
      sum(subject_result.correct_count)::integer as correct_count,sum(subject_result.incorrect_count)::integer as incorrect_count,
      sum(subject_result.unanswered_count)::integer as unanswered_count,avg(subject_result.time_score)::numeric as time_score
    from public.analytics_demo_subject_results subject_result
    join ready_demo_batches batch on batch.id=subject_result.batch_id
    where (p_product_id is null or subject_result.product_id=p_product_id)
    group by subject_result.demo_student_id,subject_result.subject_name
  ),
  subject_result_rows as (
    select * from real_subject_rows
    union all
    select * from demo_subject_rows
  ),
  student_totals as (
    select participant.participant_key,participant.student_id,participant.demo_student_id,participant.full_name,
      participant.academic_year,participant.grade,participant.section_id,participant.section_name,participant.tracks,
      count(result.paper_id)::integer as completed_tests,
      round(sum(result.score),1) as total_marks,round(sum(result.maximum_marks),1) as maximum_marks,
      round(100*sum(result.score)/greatest(sum(result.maximum_marks),1),1) as percentage,
      round(100*sum(result.correct_count)::numeric/greatest(sum(result.correct_count+result.incorrect_count+result.unanswered_count),1),1) as accuracy,
      sum(result.correct_count)::integer as correct_count,sum(result.incorrect_count)::integer as incorrect_count,
      sum(result.unanswered_count)::integer as unanswered_count,round(avg(result.time_score),1) as time_score,
      min(result.submitted_at) as first_test_at,max(result.submitted_at) as latest_test_at,
      (array_agg(result.percentage order by result.submitted_at asc))[1] as first_percentage,
      (array_agg(result.percentage order by result.submitted_at desc))[1] as latest_percentage
    from participants participant
    left join result_rows result on result.participant_key=participant.participant_key
    group by participant.participant_key,participant.student_id,participant.demo_student_id,participant.full_name,
      participant.academic_year,participant.grade,participant.section_id,participant.section_name,participant.tracks
  ),
  student_subject_json as (
    select subject.participant_key,jsonb_object_agg(subject.subject_name,jsonb_build_object(
      'marks',round(subject.marks,1),'maximum_marks',round(subject.maximum_marks,1),
      'percentage',round(100*subject.marks/greatest(subject.maximum_marks,1),1),
      'accuracy',round(100*subject.correct_count::numeric/greatest(subject.correct_count+subject.incorrect_count+subject.unanswered_count,1),1),
      'correct',subject.correct_count,'incorrect',subject.incorrect_count,'unanswered',subject.unanswered_count,
      'time_score',round(subject.time_score,1)
    ) order by subject.subject_name) as subjects
    from subject_result_rows subject group by subject.participant_key
  ),
  grade_rows as (
    select total.grade,count(*)::integer as students,count(*) filter(where total.completed_tests>0)::integer as active_students,
      sum(total.completed_tests)::integer as completed_tests,
      round(avg(total.percentage) filter(where total.completed_tests>0),1) as average_percentage,
      round(avg(total.accuracy) filter(where total.completed_tests>0),1) as accuracy,
      round(100*count(*) filter(where total.completed_tests>0)::numeric/greatest(count(*),1),1) as participation
    from student_totals total group by total.grade
  ),
  section_rows as (
    select total.section_id,total.grade,total.section_name,count(*)::integer as students,
      count(*) filter(where total.completed_tests>0)::integer as active_students,sum(total.completed_tests)::integer as completed_tests,
      round(avg(total.percentage) filter(where total.completed_tests>0),1) as average_percentage,
      round(avg(total.accuracy) filter(where total.completed_tests>0),1) as accuracy,
      round(100*count(*) filter(where total.completed_tests>0)::numeric/greatest(count(*),1),1) as participation
    from student_totals total group by total.section_id,total.grade,total.section_name
  ),
  subject_rows as (
    select subject.subject_name,count(distinct subject.participant_key)::integer as students,
      round(100*sum(subject.marks)/greatest(sum(subject.maximum_marks),1),1) as average_percentage,
      round(100*sum(subject.correct_count)::numeric/greatest(sum(subject.correct_count+subject.incorrect_count+subject.unanswered_count),1),1) as accuracy,
      round(avg(subject.time_score),1) as time_score,
      sum(subject.correct_count)::integer as correct_count,sum(subject.incorrect_count)::integer as incorrect_count,
      sum(subject.unanswered_count)::integer as unanswered_count
    from subject_result_rows subject group by subject.subject_name
  ),
  test_rows as (
    select result.paper_id,max(result.paper_title) as paper_title,result.product_id,max(result.product_name) as product_name,
      count(*)::integer as test_takers,round(avg(result.percentage),1) as average_percentage,
      round(min(result.percentage),1) as lowest_percentage,round(max(result.percentage),1) as highest_percentage,
      round((percentile_cont(0.90) within group(order by result.percentage))::numeric,1) as top10_threshold,
      round((percentile_cont(0.95) within group(order by result.percentage))::numeric,1) as top5_threshold,
      round(avg(result.accuracy),1) as accuracy,round(avg(result.time_score),1) as time_score,
      max(result.submitted_at) as latest_submission
    from result_rows result group by result.paper_id,result.product_id
  ),
  teacher_rows as (
    select assignment.teacher_id,coalesce(profile.full_name,'Teacher') as teacher_name,assignment.subject_label,
      section_row.id as section_id,section_row.grade,section_row.name as section_name,
      coalesce(section_summary.students,0) as students,coalesce(section_summary.active_students,0) as active_students,
      section_summary.average_percentage,section_summary.accuracy
    from public.teacher_section_assignments assignment
    join public.academic_sections section_row on section_row.id=assignment.section_id
    join public.profiles profile on profile.id=assignment.teacher_id
    left join section_rows section_summary on section_summary.section_id=section_row.id
    where assignment.is_active=true and section_row.organization_id=p_organization_id
      and (p_academic_year is null or section_row.academic_year=p_academic_year)
      and (p_grade is null or section_row.grade=p_grade)
      and (p_section_id is null or section_row.id=p_section_id)
  ),
  distribution_rows as (
    select bucket,count(*)::integer as students from (
      select case when total.completed_tests=0 then 'Not started'
        when total.percentage<40 then 'Below 40%'
        when total.percentage<60 then '40–59%'
        when total.percentage<75 then '60–74%'
        when total.percentage<90 then '75–89%'
        else '90% and above' end as bucket
      from student_totals total
    ) distribution group by bucket
  ),
  summary as (
    select count(*)::integer as total_students,count(*) filter(where completed_tests>0)::integer as active_students,
      sum(completed_tests)::integer as completed_tests,
      round(avg(percentage) filter(where completed_tests>0),1) as average_percentage,
      round(avg(accuracy) filter(where completed_tests>0),1) as accuracy,
      round(avg(time_score) filter(where completed_tests>0),1) as time_score,
      round(100*count(*) filter(where completed_tests>0)::numeric/greatest(count(*),1),1) as participation,
      count(*) filter(where completed_tests>0 and percentage<50)::integer as needs_attention,
      count(*) filter(where completed_tests>0 and percentage>=75)::integer as strong_students,
      count(*) filter(where completed_tests>0 and coalesce(latest_percentage,0)-coalesce(first_percentage,0)>=5)::integer as improving_students,
      sum(correct_count)::integer as correct_count,sum(incorrect_count)::integer as incorrect_count,
      sum(unanswered_count)::integer as unanswered_count
    from student_totals
  )
  select jsonb_build_object(
    'organization',(select jsonb_build_object('id',organization.id,'name',organization.name,'board',organization.board,'city',organization.city,'state',organization.state) from public.organizations organization where organization.id=p_organization_id),
    'filters',jsonb_build_object('academic_year',p_academic_year,'grade',p_grade,'section_id',p_section_id,'product_id',p_product_id),
    'academic_years',coalesce((select jsonb_agg(year_value order by year_value desc) from (select distinct membership.academic_year as year_value from public.student_school_memberships membership where membership.organization_id=p_organization_id) years),'[]'::jsonb),
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',product.id,'name',product.name,'exam_type',product.exam_type,'total_tests',(select count(*) from public.product_papers product_paper where product_paper.product_id=product.id)) order by product.name)
      from public.products product where exists(select 1 from result_rows result where result.product_id=product.id)),'[]'::jsonb),
    'summary',(select to_jsonb(summary) from summary),
    'grades',coalesce((select jsonb_agg(to_jsonb(grade_rows) order by grade) from grade_rows),'[]'::jsonb),
    'sections',coalesce((select jsonb_agg(to_jsonb(section_rows) order by grade,section_name) from section_rows),'[]'::jsonb),
    'subjects',coalesce((select jsonb_agg(to_jsonb(subject_rows) order by subject_name) from subject_rows),'[]'::jsonb),
    'tests',coalesce((select jsonb_agg(to_jsonb(test_rows) order by latest_submission desc,paper_title) from test_rows),'[]'::jsonb),
    'teachers',coalesce((select jsonb_agg(to_jsonb(teacher_rows) order by grade,section_name,teacher_name) from teacher_rows),'[]'::jsonb),
    'distribution',coalesce((select jsonb_agg(to_jsonb(distribution_rows) order by bucket) from distribution_rows),'[]'::jsonb),
    'students',coalesce((select jsonb_agg(to_jsonb(total)||jsonb_build_object(
      'subjects',coalesce(subject_json.subjects,'{}'::jsonb),
      'improvement',round(coalesce(total.latest_percentage,0)-coalesce(total.first_percentage,0),1),
      'status',case when total.completed_tests=0 then 'not_started' when total.percentage<50 then 'needs_attention' when total.percentage>=75 then 'strong' when coalesce(total.latest_percentage,0)-coalesce(total.first_percentage,0)>=5 then 'improving' else 'steady' end
    ) order by total.percentage desc nulls last,total.full_name) from student_totals total left join student_subject_json subject_json on subject_json.participant_key=total.participant_key),'[]'::jsonb),
    'interventions',coalesce((select jsonb_agg(jsonb_build_object(
      'id',intervention.id,'student_id',intervention.student_id,'demo_student_id',intervention.demo_student_id,
      'title',intervention.title,'note',intervention.note,'priority',intervention.priority,'status',intervention.status,
      'due_date',intervention.due_date,'assigned_to',intervention.assigned_to,'created_at',intervention.created_at
    ) order by case intervention.priority when 'urgent' then 1 when 'high' then 2 when 'medium' then 3 else 4 end,intervention.due_date nulls last)
      from public.analytics_interventions intervention where intervention.organization_id=p_organization_id and intervention.status in ('open','in_progress')),'[]'::jsonb),
    'generated_at',now()
  ) into v_result;

  return coalesce(v_result,jsonb_build_object('summary',jsonb_build_object('total_students',0),'students','[]'::jsonb,'generated_at',now()));
end;
$$;

grant execute on function public.get_school_analytics_overview_v12(uuid,text,integer,uuid,uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.phase3.schema_ready','system','37_v10_analytics_phase_3',jsonb_build_object(
  'school_dashboard',true,'grade_comparison',true,'section_comparison',true,'teacher_comparison',true,
  'subject_heatmap',true,'test_monitoring',true,'intervention_tracker',true,'answer_review',true,'report_payload',true
));

commit;
