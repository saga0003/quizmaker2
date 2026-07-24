-- Evidara V10 Analytics Phase 2
-- Run after supabase/35_v10_analytics_phase_1.sql.
-- Adds teacher aggregate analytics and an isolated Super-Admin demo-data laboratory.

begin;

create table if not exists public.analytics_demo_batches (
  id uuid primary key default gen_random_uuid(),
  target_student_id uuid not null references public.profiles(id) on delete cascade,
  target_email text not null,
  organization_id uuid references public.organizations(id) on delete set null,
  membership_id uuid references public.student_school_memberships(id) on delete set null,
  section_id uuid references public.academic_sections(id) on delete set null,
  requested_evidence_rows integer not null check (requested_evidence_rows between 10000 and 50000),
  generated_attempts integer not null default 0,
  generated_responses integer not null default 0,
  generated_papers integer not null default 0,
  generated_products integer not null default 0,
  organization_created boolean not null default false,
  membership_created boolean not null default false,
  previous_section_id uuid,
  previous_section_text text,
  status text not null default 'generating' check (status in ('generating','ready','resetting','reset','failed')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  reset_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists analytics_demo_batches_email_idx
  on public.analytics_demo_batches(lower(target_email), status, created_at desc);

alter table public.analytics_demo_batches enable row level security;
drop policy if exists analytics_demo_batches_super_admin_read_v10 on public.analytics_demo_batches;
create policy analytics_demo_batches_super_admin_read_v10
on public.analytics_demo_batches for select to authenticated
using (public.is_evidara_super_admin());

revoke insert, update, delete on public.analytics_demo_batches from authenticated;
grant select on public.analytics_demo_batches to authenticated;

create or replace function public.get_teacher_analytics_overview_v10(
  p_section_id uuid default null,
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
  v_user uuid := auth.uid();
  v_role text;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  if p_from is not null and p_to is not null and p_to < p_from then
    raise exception 'The end date must be on or after the start date.';
  end if;
  select role::text into v_role from public.profiles where id=v_user;
  if v_role not in ('teacher','reviewer','invigilator','school_teacher','institute_owner','institute_admin','school_admin','school_owner','evidara_admin','admin','platform_admin','super_admin') then
    raise exception 'Teacher or administrator analytics access required.' using errcode='42501';
  end if;

  return (
    with visible_sections as (
      select distinct section_row.*
      from public.academic_sections section_row
      where section_row.is_active=true
        and (p_section_id is null or section_row.id=p_section_id)
        and (
          public.analytics_is_platform_admin_v10()
          or public.analytics_is_school_admin_v10(section_row.organization_id)
          or exists(
            select 1 from public.teacher_section_assignments assignment
            where assignment.section_id=section_row.id
              and assignment.teacher_id=v_user
              and assignment.is_active=true
          )
        )
    ),
    visible_students as (
      select membership.student_id,membership.id as membership_id,membership.section_id,
        membership.organization_id,membership.grade,membership.academic_year,
        coalesce(profile.full_name,'Student') as full_name,
        section_row.name as section_name
      from public.student_school_memberships membership
      join visible_sections section_row on section_row.id=membership.section_id
      join public.profiles profile on profile.id=membership.student_id
      where membership.status='active'
    ),
    attempts as (
      select attempt.*,student.section_id,student.full_name,student.grade,student.section_name,
        paper.title as paper_title
      from public.exam_attempts attempt
      join visible_students student on student.student_id=attempt.student_id
      join public.question_papers paper on paper.id=attempt.paper_id
      where attempt.status='submitted'
        and coalesce((attempt.metadata->>'demo_cohort_only')::boolean,false)=false
        and (p_from is null or attempt.submitted_at::date>=p_from)
        and (p_to is null or attempt.submitted_at::date<=p_to)
    ),
    student_stats as (
      select student.student_id,student.membership_id,student.section_id,student.full_name,
        student.grade,student.section_name,
        count(attempt.id)::integer as completed_tests,
        round(avg(attempt.percentage),1) as average_percentage,
        round(100*sum(attempt.correct_count)::numeric/greatest(sum(attempt.correct_count+attempt.incorrect_count),1),1) as accuracy,
        min(attempt.submitted_at) as first_test_at,
        max(attempt.submitted_at) as latest_test_at,
        (array_agg(attempt.percentage order by attempt.submitted_at asc) filter(where attempt.id is not null))[1] as first_percentage,
        (array_agg(attempt.percentage order by attempt.submitted_at desc) filter(where attempt.id is not null))[1] as latest_percentage
      from visible_students student
      left join attempts attempt on attempt.student_id=student.student_id
      group by student.student_id,student.membership_id,student.section_id,student.full_name,student.grade,student.section_name
    ),
    student_rows as (
      select stats.*,
        round(coalesce(stats.latest_percentage,0)-coalesce(stats.first_percentage,0),1) as improvement,
        case
          when stats.completed_tests=0 then 'not_started'
          when coalesce(stats.average_percentage,0)<50 or coalesce(stats.accuracy,0)<55 then 'needs_attention'
          when coalesce(stats.latest_percentage,0)-coalesce(stats.first_percentage,0)>=5 then 'improving'
          when coalesce(stats.average_percentage,0)>=80 and coalesce(stats.accuracy,0)>=80 then 'strong'
          else 'steady'
        end as performance_status
      from student_stats stats
    ),
    section_rows as (
      select section_row.id,section_row.organization_id,section_row.academic_year,section_row.grade,
        section_row.name,organization.name as organization_name,
        count(distinct student.student_id)::integer as students,
        count(attempt.id)::integer as completed_tests,
        round(avg(attempt.percentage),1) as average_percentage,
        round(100*sum(attempt.correct_count)::numeric/greatest(sum(attempt.correct_count+attempt.incorrect_count),1),1) as accuracy
      from visible_sections section_row
      join public.organizations organization on organization.id=section_row.organization_id
      left join visible_students student on student.section_id=section_row.id
      left join attempts attempt on attempt.student_id=student.student_id
      group by section_row.id,section_row.organization_id,section_row.academic_year,section_row.grade,section_row.name,organization.name
    ),
    subject_rows as (
      select coalesce(subject.name,paper_section.title,question.question_snapshot->>'subject_name','General') as subject_name,
        count(*)::integer as responses,
        count(*) filter(where response.is_correct=true)::integer as correct,
        count(*) filter(where response.is_correct=false)::integer as incorrect,
        round(100*count(*) filter(where response.is_correct=true)::numeric/
          greatest(count(*) filter(where response.is_correct is not null),1),1) as accuracy,
        round(100*sum(coalesce(response.marks_awarded,0))::numeric/greatest(sum(question.marks),1),1) as average_percentage
      from attempts attempt
      join public.exam_responses response on response.attempt_id=attempt.id
      join public.paper_questions question on question.id=response.paper_question_id
      join public.paper_sections paper_section on paper_section.id=question.section_id
      left join public.subjects subject on subject.id=paper_section.subject_id
      group by 1
    ),
    trend_rows as (
      select attempt.submitted_at::date as date,
        count(*)::integer as completed_tests,
        count(distinct attempt.student_id)::integer as active_students,
        round(avg(attempt.percentage),1) as average_percentage,
        round(100*sum(attempt.correct_count)::numeric/greatest(sum(attempt.correct_count+attempt.incorrect_count),1),1) as accuracy
      from attempts attempt
      group by attempt.submitted_at::date
      order by attempt.submitted_at::date
    ),
    summary as (
      select
        (select count(*) from visible_students)::integer as total_students,
        count(distinct attempts.student_id)::integer as active_students,
        count(attempts.id)::integer as completed_tests,
        round(avg(attempts.percentage),1) as average_percentage,
        round(100*sum(attempts.correct_count)::numeric/greatest(sum(attempts.correct_count+attempts.incorrect_count),1),1) as accuracy,
        round(100*count(distinct attempts.student_id)::numeric/greatest((select count(*) from visible_students),1),1) as participation,
        count(*) filter(where student_rows.performance_status='needs_attention')::integer as needs_attention,
        count(*) filter(where student_rows.performance_status='improving')::integer as improving,
        count(*) filter(where student_rows.performance_status='strong')::integer as strong
      from attempts
      right join student_rows on student_rows.student_id=attempts.student_id
    )
    select jsonb_build_object(
      'summary',(select to_jsonb(summary) from summary),
      'sections',coalesce((select jsonb_agg(to_jsonb(section_rows) order by organization_name,grade,name) from section_rows),'[]'::jsonb),
      'students',coalesce((select jsonb_agg(to_jsonb(student_rows) order by performance_status,average_percentage,full_name) from student_rows),'[]'::jsonb),
      'subjects',coalesce((select jsonb_agg(to_jsonb(subject_rows) order by average_percentage) from subject_rows),'[]'::jsonb),
      'trends',coalesce((select jsonb_agg(to_jsonb(trend_rows) order by date) from trend_rows),'[]'::jsonb),
      'generated_at',now()
    )
  );
end;
$$;

grant execute on function public.get_teacher_analytics_overview_v10(uuid,date,date) to authenticated;

create or replace function public.get_analytics_demo_status_v10(
  p_email text default 'sales.student@demo.evidara.app'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_student uuid;
begin
  if not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can inspect generated demo data.' using errcode='42501';
  end if;
  select id into v_student from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
  return jsonb_build_object(
    'email',lower(btrim(p_email)),
    'student_id',v_student,
    'account_found',v_student is not null,
    'active_batch',(
      select jsonb_build_object(
        'id',batch.id,'status',batch.status,'requested_evidence_rows',batch.requested_evidence_rows,
        'attempts',batch.generated_attempts,'responses',batch.generated_responses,
        'papers',batch.generated_papers,'products',batch.generated_products,
        'created_at',batch.created_at,'completed_at',batch.completed_at
      )
      from public.analytics_demo_batches batch
      where lower(batch.target_email)=lower(btrim(p_email)) and batch.status in ('generating','ready','failed')
      order by batch.created_at desc limit 1
    )
  );
end;
$$;

grant execute on function public.get_analytics_demo_status_v10(text) to authenticated;

create or replace function public.generate_analytics_demo_data_v10(
  p_email text default 'sales.student@demo.evidara.app',
  p_evidence_rows integer default 25000
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_actor uuid := auth.uid();
  v_student uuid;
  v_org uuid;
  v_membership public.student_school_memberships%rowtype;
  v_section uuid;
  v_batch uuid;
  v_org_created boolean := false;
  v_membership_created boolean := false;
  v_attempt_target integer;
  v_product_ids uuid[] := '{}';
  v_version_ids uuid[] := '{}';
  v_subject_ids uuid[] := '{}';
  v_question_ids uuid[] := '{}';
  v_paper_ids uuid[] := '{}';
  v_section_ids uuid[];
  v_product uuid;
  v_version uuid;
  v_subject uuid;
  v_question uuid;
  v_paper uuid;
  v_paper_section uuid;
  v_code text;
  i integer;
  j integer;
  v_attempts integer;
  v_responses integer;
  v_completed_papers uuid[] := '{}';
begin
  if not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can generate analytics demo data.' using errcode='42501';
  end if;
  if p_evidence_rows not between 10000 and 50000 then
    raise exception 'Choose between 10,000 and 50,000 evidence rows.';
  end if;
  if exists(select 1 from public.analytics_demo_batches where lower(target_email)=lower(btrim(p_email)) and status in ('generating','ready')) then
    raise exception 'Reset the existing generated dataset before creating another one.';
  end if;
  select id into v_student from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
  if v_student is null then raise exception 'The target email does not exist in Supabase Auth. Create or sign in with this account first.'; end if;
  if not exists(select 1 from public.profiles where id=v_student) then
    raise exception 'The target account has no Evidara profile yet. Sign in once before generating data.';
  end if;

  select * into v_membership
  from public.student_school_memberships
  where student_id=v_student and status='active'
  order by academic_year desc,created_at desc limit 1;

  if v_membership.id is null then
    insert into public.organizations(name,slug,school_type,city,state,phone,student_count_range,status,created_by,board)
    values('Evidara Analytics Demo School','evidara-analytics-demo-'||substr(replace(gen_random_uuid()::text,'-',''),1,8),
      'Demo School','Bengaluru','Karnataka','0000000000','1-100','active',v_student,'ISC')
    returning id into v_org;
    v_org_created := true;
    insert into public.student_school_memberships(
      organization_id,student_id,academic_year,grade,section,board,tracks,status,parent_name,parent_phone
    ) values(v_org,v_student,'2026-27',11,'Analytics Demo A','ISC',array['NEET'],'active','Demo Parent','0000000000')
    returning * into v_membership;
    v_membership_created := true;
  else
    v_org := v_membership.organization_id;
  end if;

  insert into public.analytics_demo_batches(
    target_student_id,target_email,organization_id,membership_id,requested_evidence_rows,
    organization_created,membership_created,previous_section_id,previous_section_text,created_by
  ) values(
    v_student,lower(btrim(p_email)),v_org,v_membership.id,p_evidence_rows,
    v_org_created,v_membership_created,v_membership.section_id,v_membership.section,v_actor
  ) returning id into v_batch;

  v_code := 'DEMO-'||upper(substr(replace(v_batch::text,'-',''),1,8));
  insert into public.academic_sections(organization_id,academic_year,grade,name,code,is_active,created_by)
  values(v_org,v_membership.academic_year,v_membership.grade,'Analytics Demo A',v_code,true,v_actor)
  on conflict(organization_id,academic_year,grade,lower(name))
  do update set is_active=true,updated_at=now()
  returning id into v_section;

  update public.student_school_memberships set section_id=v_section,section='Analytics Demo A',updated_at=now()
  where id=v_membership.id;
  update public.analytics_demo_batches set section_id=v_section where id=v_batch;

  insert into public.teacher_section_assignments(section_id,teacher_id,subject_label,is_active,assigned_by)
  select v_section,member.user_id,'All subjects',true,v_actor
  from public.organization_members member
  where member.organization_id=v_org and member.is_active=true and member.member_role in ('teacher','reviewer','invigilator')
  on conflict(section_id,teacher_id,subject_label) do update set is_active=true,updated_at=now();

  for i in 1..5 loop
    insert into public.subjects(organization_id,code,name,exam_types,is_active,created_by)
    values(null,v_code||'-S'||i,
      (array['Physics','Chemistry','Mathematics','Biology','Logical Reasoning'])[i],
      array['NEET','JEE Main','Foundation'],true,v_actor)
    returning id into v_subject;
    v_subject_ids := array_append(v_subject_ids,v_subject);
  end loop;

  for i in 1..100 loop
    insert into public.questions(
      organization_id,created_by,updated_by,subject_id,question_type,status,difficulty,
      stem_text,solution_text,marks,negative_marks,estimated_seconds,correct_answer,
      exam_types,class_level,source,language,tags,metadata,approved_at
    ) values(
      null,v_student,v_actor,v_subject_ids[((i-1)%5)+1],'single_correct','approved',
      (array['very_easy','easy','moderate','difficult','very_difficult']::public.question_difficulty[])[((i-1)%5)+1],
      'Demo analytics question '||i||' — generated evidence only.',
      'Generated solution for analytics calculation validation.',1,0.25,45,'["A"]'::jsonb,
      array['NEET','JEE Main','Foundation'],'Grade 11','Evidara analytics demo','English',
      array['analytics-demo',v_code],jsonb_build_object('demo_batch_id',v_batch,'demo_sequence',i),now()
    ) returning id into v_question;
    v_question_ids := array_append(v_question_ids,v_question);
    insert into public.question_options(question_id,option_key,content_text,is_correct,display_order)
    values(v_question,'A','Correct generated option',true,1),(v_question,'B','Generated distractor',false,2),
      (v_question,'C','Generated distractor',false,3),(v_question,'D','Generated distractor',false,4);
  end loop;

  for i in 1..3 loop
    insert into public.products(
      name,slug,short_description,description,product_type,audience,exam_type,status,is_featured,created_by,updated_by,commerce_settings,grade_levels
    ) values(
      case i when 1 then 'Demo Foundation Complete Series' when 2 then 'Demo NEET Incomplete Series' else 'Demo Mixed Mastery Series' end,
      lower(v_code)||'-product-'||i,'Generated analytics validation product',
      'Isolated Super Admin generated product for validating Evidara calculations.','test_series','student',
      case i when 1 then 'Foundation' when 2 then 'NEET' else 'Mixed' end,'published',false,v_actor,v_actor,
      jsonb_build_object('demo_batch_id',v_batch,'generated',true),array['Grade 11']
    ) returning id into v_product;
    v_product_ids := array_append(v_product_ids,v_product);
    insert into public.product_versions(product_id,version_number,mrp_paise,selling_price_paise,access_days,max_attempts,features,is_current,created_by)
    values(v_product,1,19900,19900,365,1000,jsonb_build_array('Generated analytics evidence','Calculation validation'),true,v_actor)
    returning id into v_version;
    v_version_ids := array_append(v_version_ids,v_version);
    insert into public.entitlements(user_id,product_id,product_version_id,source,status,starts_at,expires_at,attempts_limit,granted_by,commerce_metadata)
    values(v_student,v_product,v_version,'analytics_demo','active',now(),now()+interval '365 days',1000,v_actor,jsonb_build_object('demo_batch_id',v_batch));
  end loop;

  for i in 1..30 loop
    insert into public.question_papers(
      organization_id,created_by,updated_by,title,code,description,exam_type,status,duration_minutes,
      instructions,access_mode,attempt_limit,shuffle_questions,shuffle_options,result_mode,total_marks,total_questions,
      settings,published_at,grade_level,test_type,open_forever
    ) values(
      null,v_student,v_actor,'Generated Analytics Test '||lpad(i::text,2,'0'),v_code||'-P'||lpad(i::text,2,'0'),
      'Generated paper for testing percentage, percentile, accuracy, pacing, trends and subject calculations.',
      case when i<=10 then 'Foundation' when i<=20 then 'NEET' else 'Mixed' end,
      'published',180,'Generated demo assessment.','public',1000,false,false,'in_depth_analytics',100,100,
      jsonb_build_object('demo_batch_id',v_batch,'demo_sequence',i),now(),'Grade 11','full_length_mock',true
    ) returning id into v_paper;
    v_paper_ids := array_append(v_paper_ids,v_paper);
    v_section_ids := '{}';
    for j in 1..5 loop
      insert into public.paper_sections(paper_id,title,subject_id,instructions,questions_to_attempt,display_order)
      values(v_paper,(array['Physics','Chemistry','Mathematics','Biology','Logical Reasoning'])[j],v_subject_ids[j],null,20,j)
      returning id into v_paper_section;
      v_section_ids := array_append(v_section_ids,v_paper_section);
    end loop;
    for j in 1..100 loop
      insert into public.paper_questions(paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot)
      values(v_paper,v_section_ids[((j-1)%5)+1],v_question_ids[j],j,1,0.25,true,
        jsonb_build_object('id',v_question_ids[j],'stem_text','Generated analytics question '||j,
          'question_type','single_correct','difficulty','moderate','marks',1,'negative_marks',0.25,
          'subject_name',(array['Physics','Chemistry','Mathematics','Biology','Logical Reasoning'])[((j-1)%5)+1],
          'correct_answer',jsonb_build_array('A'),'options',jsonb_build_array(
            jsonb_build_object('option_key','A','content_text','Correct generated option','is_correct',true,'display_order',1),
            jsonb_build_object('option_key','B','content_text','Generated distractor','is_correct',false,'display_order',2),
            jsonb_build_object('option_key','C','content_text','Generated distractor','is_correct',false,'display_order',3),
            jsonb_build_object('option_key','D','content_text','Generated distractor','is_correct',false,'display_order',4)
          )));
    end loop;
    insert into public.product_papers(product_id,paper_id,display_name,display_order,created_by)
    values(v_product_ids[((i-1)/10)+1],v_paper,'Test '||(((i-1)%10)+1),((i-1)%10)+1,v_actor);
    if not (i between 18 and 20) then v_completed_papers:=array_append(v_completed_papers,v_paper); end if;
  end loop;

  v_attempt_target := greatest(100,ceil(p_evidence_rows/100.0)::integer);
  insert into public.exam_attempts(
    paper_id,student_id,organization_id,attempt_number,status,started_at,expires_at,submitted_at,
    question_order,score,maximum_marks,percentage,correct_count,incorrect_count,unanswered_count,violation_count,metadata
  )
  select
    v_completed_papers[((series_no-1)%array_length(v_completed_papers,1))+1],v_student,v_org,
    row_number() over(partition by v_completed_papers[((series_no-1)%array_length(v_completed_papers,1))+1] order by series_no)::integer,
    'submitted',
    now()-((v_attempt_target-series_no)*interval '6 hours'),
    now()-((v_attempt_target-series_no)*interval '6 hours')+interval '180 minutes',
    now()-((v_attempt_target-series_no)*interval '6 hours')+make_interval(mins=>75+((series_no*13)%80)),
    '{}'::uuid[],
    round(greatest(28,least(97,48+(series_no%34)+8*sin(series_no/7.0)))::numeric,2),100,
    round(greatest(28,least(97,48+(series_no%34)+8*sin(series_no/7.0)))::numeric,2),
    greatest(20,least(94,round(48+(series_no%38)+6*sin(series_no/5.0))::integer)),
    greatest(2,least(45,round(28-(series_no%18)+4*cos(series_no/8.0))::integer)),
    0,case when series_no%29=0 then 1 else 0 end,
    jsonb_build_object('demo_batch_id',v_batch,'generated',true,'series_no',series_no)
  from generate_series(1,v_attempt_target) series_no;

  update public.exam_attempts
  set unanswered_count=greatest(0,100-correct_count-incorrect_count)
  where metadata->>'demo_batch_id'=v_batch::text;

  insert into public.exam_responses(
    attempt_id,paper_question_id,response,marked_for_review,visited,time_spent_seconds,is_correct,marks_awarded,saved_at
  )
  select attempt.id,item.id,
    case when item.position<=attempt.correct_count then '["A"]'::jsonb
         when item.position<=attempt.correct_count+attempt.incorrect_count then '["B"]'::jsonb else null end,
    item.position%17=0,true,8+((attempt.attempt_number*7+item.position*11)%105),
    case when item.position<=attempt.correct_count then true
         when item.position<=attempt.correct_count+attempt.incorrect_count then false else null end,
    case when item.position<=attempt.correct_count then 1
         when item.position<=attempt.correct_count+attempt.incorrect_count then -0.25 else 0 end,
    attempt.submitted_at
  from public.exam_attempts attempt
  join lateral (
    select question.id,row_number() over(order by question.display_order,question.id)::integer as position
    from public.paper_questions question where question.paper_id=attempt.paper_id
  ) item on true
  where attempt.metadata->>'demo_batch_id'=v_batch::text;

  select count(*) into v_attempts from public.exam_attempts where metadata->>'demo_batch_id'=v_batch::text;
  select count(*) into v_responses from public.exam_responses response
    join public.exam_attempts attempt on attempt.id=response.attempt_id
    where attempt.metadata->>'demo_batch_id'=v_batch::text;

  update public.analytics_demo_batches
  set generated_attempts=v_attempts,generated_responses=v_responses,generated_papers=30,generated_products=3,
      status='ready',completed_at=now(),metadata=jsonb_build_object('subject_count',5,'question_count',100,'section_code',v_code)
  where id=v_batch;

  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(v_actor,v_org,'analytics.demo.generated','analytics_demo_batch',v_batch::text,
    jsonb_build_object('email',lower(btrim(p_email)),'attempts',v_attempts,'responses',v_responses,'papers',30,'products',3));

  return jsonb_build_object('batch_id',v_batch,'email',lower(btrim(p_email)),'attempts',v_attempts,
    'responses',v_responses,'papers',30,'products',3,'status','ready');
exception when others then
  if v_batch is not null then update public.analytics_demo_batches set status='failed',completed_at=now(),metadata=metadata||jsonb_build_object('error',sqlerrm) where id=v_batch; end if;
  raise;
end;
$$;

grant execute on function public.generate_analytics_demo_data_v10(text,integer) to authenticated;

create or replace function public.reset_analytics_demo_data_v10(
  p_email text,
  p_confirm_email text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_actor uuid:=auth.uid();
  v_batch public.analytics_demo_batches%rowtype;
  v_attempts integer:=0;
  v_responses integer:=0;
  v_products integer:=0;
  v_papers integer:=0;
  v_questions integer:=0;
begin
  if not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can reset generated demo data.' using errcode='42501';
  end if;
  if lower(btrim(p_email))<>lower(btrim(p_confirm_email)) then
    raise exception 'The confirmation email does not match the target account.';
  end if;
  if p_confirmation<>'RESET DEMO ANALYTICS' then
    raise exception 'Type RESET DEMO ANALYTICS exactly to confirm the second deletion step.';
  end if;
  select * into v_batch from public.analytics_demo_batches
  where lower(target_email)=lower(btrim(p_email)) and status in ('ready','failed','generating')
  order by created_at desc limit 1 for update;
  if v_batch.id is null then raise exception 'No generated demo dataset exists for this email.'; end if;

  update public.analytics_demo_batches set status='resetting' where id=v_batch.id;
  select count(*) into v_responses from public.exam_responses response join public.exam_attempts attempt on attempt.id=response.attempt_id where attempt.metadata->>'demo_batch_id'=v_batch.id::text;
  select count(*) into v_attempts from public.exam_attempts where metadata->>'demo_batch_id'=v_batch.id::text;
  select count(*) into v_products from public.products where commerce_settings->>'demo_batch_id'=v_batch.id::text;
  select count(*) into v_papers from public.question_papers where settings->>'demo_batch_id'=v_batch.id::text;
  select count(*) into v_questions from public.questions where metadata->>'demo_batch_id'=v_batch.id::text;

  delete from public.exam_attempts where metadata->>'demo_batch_id'=v_batch.id::text;
  delete from public.products where commerce_settings->>'demo_batch_id'=v_batch.id::text;
  delete from public.question_papers where settings->>'demo_batch_id'=v_batch.id::text;
  delete from public.questions where metadata->>'demo_batch_id'=v_batch.id::text;
  delete from public.subjects where code like 'DEMO-'||upper(substr(replace(v_batch.id::text,'-',''),1,8))||'-%';

  if v_batch.membership_id is not null and not v_batch.membership_created then
    update public.student_school_memberships
    set section_id=v_batch.previous_section_id,section=v_batch.previous_section_text,updated_at=now()
    where id=v_batch.membership_id;
  end if;
  if v_batch.section_id is not null then delete from public.academic_sections where id=v_batch.section_id; end if;
  if v_batch.membership_created and v_batch.membership_id is not null then delete from public.student_school_memberships where id=v_batch.membership_id; end if;
  if v_batch.organization_created and v_batch.organization_id is not null then delete from public.organizations where id=v_batch.organization_id; end if;

  update public.analytics_demo_batches set status='reset',reset_at=now() where id=v_batch.id;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_actor,'analytics.demo.reset','analytics_demo_batch',v_batch.id::text,
    jsonb_build_object('email',lower(btrim(p_email)),'attempts',v_attempts,'responses',v_responses,
      'products',v_products,'papers',v_papers,'questions',v_questions,'double_confirmation',true));

  return jsonb_build_object('batch_id',v_batch.id,'status','reset','attempts_deleted',v_attempts,
    'responses_deleted',v_responses,'products_deleted',v_products,'papers_deleted',v_papers,'questions_deleted',v_questions);
end;
$$;

grant execute on function public.reset_analytics_demo_data_v10(text,text,text) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.phase2.schema_ready','system','36_v10_analytics_phase_2',
  jsonb_build_object('teacher_dashboard',true,'demo_data_generator',true,'double_confirmation_reset',true));

commit;
