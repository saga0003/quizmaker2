-- Evidara V10 Analytics Phase 2 — 100-student PCM/PCB demo cohort
-- Run after 36c_v10_analytics_student_calculation_ui_fix.sql.
-- Replaces the single-student generator with one real demo login plus 99 synthetic comparison students.

begin;

alter table public.analytics_demo_batches
  add column if not exists generated_students integer not null default 0,
  add column if not exists generated_test_results integer not null default 0,
  add column if not exists generated_subject_results integer not null default 0;

create table if not exists public.analytics_demo_students (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.analytics_demo_batches(id) on delete cascade,
  auth_user_id uuid references public.profiles(id) on delete set null,
  sequence_no integer not null,
  roll_number text not null,
  full_name text not null,
  track text not null check (track in ('PCM','PCB')),
  section_label text not null,
  created_at timestamptz not null default now(),
  unique(batch_id,sequence_no),
  unique(batch_id,roll_number)
);

create table if not exists public.analytics_demo_test_results (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.analytics_demo_batches(id) on delete cascade,
  demo_student_id uuid not null references public.analytics_demo_students(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  submitted_at timestamptz not null,
  score numeric(10,2) not null default 0,
  maximum_marks numeric(10,2) not null default 100,
  percentage numeric(7,2) not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unanswered_count integer not null default 0,
  accuracy_overall numeric(7,2) not null default 0,
  accuracy_attempted numeric(7,2) not null default 0,
  time_score numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(demo_student_id,paper_id)
);

create table if not exists public.analytics_demo_subject_results (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.analytics_demo_batches(id) on delete cascade,
  demo_student_id uuid not null references public.analytics_demo_students(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  subject_name text not null,
  marks numeric(10,2) not null default 0,
  maximum_marks numeric(10,2) not null,
  percentage numeric(7,2) not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unanswered_count integer not null default 0,
  accuracy_overall numeric(7,2) not null default 0,
  accuracy_attempted numeric(7,2) not null default 0,
  time_score numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  unique(demo_student_id,paper_id,subject_name)
);

create index if not exists analytics_demo_students_batch_track_idx
  on public.analytics_demo_students(batch_id,track,sequence_no);
create index if not exists analytics_demo_test_results_paper_idx
  on public.analytics_demo_test_results(batch_id,paper_id,demo_student_id);
create index if not exists analytics_demo_test_results_product_idx
  on public.analytics_demo_test_results(batch_id,product_id,demo_student_id);
create index if not exists analytics_demo_subject_results_scope_idx
  on public.analytics_demo_subject_results(batch_id,product_id,subject_name,demo_student_id);

alter table public.analytics_demo_students enable row level security;
alter table public.analytics_demo_test_results enable row level security;
alter table public.analytics_demo_subject_results enable row level security;

drop policy if exists analytics_demo_students_super_admin_v11 on public.analytics_demo_students;
create policy analytics_demo_students_super_admin_v11 on public.analytics_demo_students
for select to authenticated using (public.is_evidara_super_admin());
drop policy if exists analytics_demo_test_results_super_admin_v11 on public.analytics_demo_test_results;
create policy analytics_demo_test_results_super_admin_v11 on public.analytics_demo_test_results
for select to authenticated using (public.is_evidara_super_admin());
drop policy if exists analytics_demo_subject_results_super_admin_v11 on public.analytics_demo_subject_results;
create policy analytics_demo_subject_results_super_admin_v11 on public.analytics_demo_subject_results
for select to authenticated using (public.is_evidara_super_admin());

revoke insert,update,delete on public.analytics_demo_students,public.analytics_demo_test_results,public.analytics_demo_subject_results from authenticated;
grant select on public.analytics_demo_students,public.analytics_demo_test_results,public.analytics_demo_subject_results to authenticated;

create or replace function public.get_analytics_demo_status_v10(
  p_email text default 'sales.student@demo.evidara.app'
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
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
        'id',batch.id,
        'status',batch.status,
        'requested_evidence_rows',batch.requested_evidence_rows,
        'attempts',batch.generated_attempts,
        'responses',batch.generated_responses,
        'papers',batch.generated_papers,
        'products',batch.generated_products,
        'students',batch.generated_students,
        'test_results',batch.generated_test_results,
        'subject_results',batch.generated_subject_results,
        'created_at',batch.created_at,
        'completed_at',batch.completed_at
      )
      from public.analytics_demo_batches batch
      where lower(batch.target_email)=lower(btrim(p_email))
        and batch.status in ('generating','ready','failed')
      order by batch.created_at desc
      limit 1
    )
  );
end;
$$;

grant execute on function public.get_analytics_demo_status_v10(text) to authenticated;

create or replace function public.generate_analytics_demo_data_v10(
  p_email text default 'sales.student@demo.evidara.app',
  p_evidence_rows integer default 10000
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth,extensions
as $$
declare
  v_actor uuid:=auth.uid();
  v_student uuid;
  v_org uuid;
  v_membership public.student_school_memberships%rowtype;
  v_section uuid;
  v_section_name text;
  v_batch uuid;
  v_code text;
  v_org_created boolean:=false;
  v_membership_created boolean:=false;
  v_phy uuid;
  v_che uuid;
  v_mat uuid;
  v_bio uuid;
  v_product uuid;
  v_version uuid;
  v_paper uuid;
  v_sec1 uuid;
  v_sec2 uuid;
  v_sec3 uuid;
  v_attempt uuid;
  v_track text;
  v_exam text;
  v_third_subject text;
  v_third_subject_id uuid;
  v_series integer;
  v_test integer;
  v_i integer;
  v_question uuid;
  v_target_demo_student uuid;
  v_counts record;
  v_result record;
  v_subject_result record;
begin
  if not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can generate analytics demo data.' using errcode='42501';
  end if;
  if p_evidence_rows not between 10000 and 50000 then
    raise exception 'Choose between 10,000 and 50,000 evidence rows.';
  end if;
  if exists(
    select 1 from public.analytics_demo_batches
    where lower(target_email)=lower(btrim(p_email)) and status in ('generating','ready')
  ) then
    raise exception 'Reset the existing generated dataset before creating another one.';
  end if;

  select id into v_student from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
  if v_student is null then
    raise exception 'The target email does not exist in Supabase Auth. Create or sign in with this account first.';
  end if;
  if not exists(select 1 from public.profiles where id=v_student) then
    raise exception 'The target account has no Evidara profile yet. Sign in once before generating data.';
  end if;

  select * into v_membership
  from public.student_school_memberships
  where student_id=v_student and status='active'
  order by academic_year desc,created_at desc
  limit 1;

  if v_membership.id is null then
    insert into public.organizations(
      name,slug,school_type,city,state,phone,student_count_range,status,created_by,board
    ) values(
      'Evidara Analytics Demo School',
      'evidara-analytics-demo-'||substr(replace(gen_random_uuid()::text,'-',''),1,8),
      'Demo School','Bengaluru','Karnataka','0000000000','1-100','active',v_student,'CBSE'
    ) returning id into v_org;
    v_org_created:=true;

    insert into public.student_school_memberships(
      organization_id,student_id,academic_year,grade,section,board,tracks,status,parent_name,parent_phone
    ) values(
      v_org,v_student,'2026-27',11,'Analytics Demo Cohort','CBSE',array['JEE Main'],'active','Demo Parent','0000000000'
    ) returning * into v_membership;
    v_membership_created:=true;
  else
    v_org:=v_membership.organization_id;
  end if;

  insert into public.analytics_demo_batches(
    target_student_id,target_email,organization_id,membership_id,requested_evidence_rows,
    organization_created,membership_created,previous_section_id,previous_section_text,created_by
  ) values(
    v_student,lower(btrim(p_email)),v_org,v_membership.id,p_evidence_rows,
    v_org_created,v_membership_created,v_membership.section_id,v_membership.section,v_actor
  ) returning id into v_batch;

  v_code:='DEMO-'||upper(substr(replace(v_batch::text,'-',''),1,8));

  insert into public.academic_sections(
    organization_id,academic_year,grade,name,code,is_active,created_by
  ) values(
    v_org,v_membership.academic_year,v_membership.grade,'Analytics Demo Cohort',v_code,true,v_actor
  ) returning id,name into v_section,v_section_name;

  update public.student_school_memberships
  set section_id=v_section,section=v_section_name,tracks=array['JEE Main'],updated_at=now()
  where id=v_membership.id;
  update public.analytics_demo_batches set section_id=v_section where id=v_batch;

  insert into public.teacher_section_assignments(section_id,teacher_id,subject_label,is_active,assigned_by)
  select v_section,member.user_id,'PCM and PCB analytics',true,v_actor
  from public.organization_members member
  where member.organization_id=v_org
    and member.is_active=true
    and member.member_role in ('teacher','reviewer','invigilator')
  on conflict(section_id,teacher_id,subject_label)
  do update set is_active=true,updated_at=now();

  insert into public.subjects(organization_id,code,name,exam_types,is_active,created_by)
  values(null,v_code||'-PHY','Physics',array['JEE Main','NEET'],true,v_actor)
  returning id into v_phy;
  insert into public.subjects(organization_id,code,name,exam_types,is_active,created_by)
  values(null,v_code||'-CHE','Chemistry',array['JEE Main','NEET'],true,v_actor)
  returning id into v_che;
  insert into public.subjects(organization_id,code,name,exam_types,is_active,created_by)
  values(null,v_code||'-MAT','Mathematics',array['JEE Main'],true,v_actor)
  returning id into v_mat;
  insert into public.subjects(organization_id,code,name,exam_types,is_active,created_by)
  values(null,v_code||'-BIO','Biology',array['NEET'],true,v_actor)
  returning id into v_bio;

  for v_i in 1..100 loop
    insert into public.questions(
      organization_id,created_by,updated_by,subject_id,question_type,status,difficulty,
      stem_text,solution_text,marks,negative_marks,estimated_seconds,correct_answer,
      exam_types,class_level,source,language,tags,metadata,approved_at
    ) values(
      null,v_student,v_actor,v_phy,'single_correct','approved',
      (array['very_easy','easy','moderate','difficult','very_difficult']::public.question_difficulty[])[((v_i-1)%5)+1],
      'Physics analytics demo question '||v_i,'Generated comparison solution.',1,0.25,45,'["A"]'::jsonb,
      array['JEE Main','NEET'],'Grade 11','Evidara analytics cohort','English',array['analytics-demo',v_code],
      jsonb_build_object('demo_batch_id',v_batch,'demo_subject','Physics','demo_sequence',v_i),now()
    ) returning id into v_question;
    insert into public.question_options(question_id,option_key,content_text,is_correct,display_order)
    values(v_question,'A','Correct generated option',true,1),(v_question,'B','Generated distractor',false,2),
      (v_question,'C','Generated distractor',false,3),(v_question,'D','Generated distractor',false,4);

    insert into public.questions(
      organization_id,created_by,updated_by,subject_id,question_type,status,difficulty,
      stem_text,solution_text,marks,negative_marks,estimated_seconds,correct_answer,
      exam_types,class_level,source,language,tags,metadata,approved_at
    ) values(
      null,v_student,v_actor,v_che,'single_correct','approved',
      (array['very_easy','easy','moderate','difficult','very_difficult']::public.question_difficulty[])[((v_i+1)%5)+1],
      'Chemistry analytics demo question '||v_i,'Generated comparison solution.',1,0.25,45,'["A"]'::jsonb,
      array['JEE Main','NEET'],'Grade 11','Evidara analytics cohort','English',array['analytics-demo',v_code],
      jsonb_build_object('demo_batch_id',v_batch,'demo_subject','Chemistry','demo_sequence',v_i),now()
    ) returning id into v_question;
    insert into public.question_options(question_id,option_key,content_text,is_correct,display_order)
    values(v_question,'A','Correct generated option',true,1),(v_question,'B','Generated distractor',false,2),
      (v_question,'C','Generated distractor',false,3),(v_question,'D','Generated distractor',false,4);

    insert into public.questions(
      organization_id,created_by,updated_by,subject_id,question_type,status,difficulty,
      stem_text,solution_text,marks,negative_marks,estimated_seconds,correct_answer,
      exam_types,class_level,source,language,tags,metadata,approved_at
    ) values(
      null,v_student,v_actor,v_mat,'single_correct','approved',
      (array['very_easy','easy','moderate','difficult','very_difficult']::public.question_difficulty[])[((v_i+2)%5)+1],
      'Mathematics analytics demo question '||v_i,'Generated comparison solution.',1,0.25,50,'["A"]'::jsonb,
      array['JEE Main'],'Grade 11','Evidara analytics cohort','English',array['analytics-demo',v_code],
      jsonb_build_object('demo_batch_id',v_batch,'demo_subject','Mathematics','demo_sequence',v_i),now()
    ) returning id into v_question;
    insert into public.question_options(question_id,option_key,content_text,is_correct,display_order)
    values(v_question,'A','Correct generated option',true,1),(v_question,'B','Generated distractor',false,2),
      (v_question,'C','Generated distractor',false,3),(v_question,'D','Generated distractor',false,4);

    insert into public.questions(
      organization_id,created_by,updated_by,subject_id,question_type,status,difficulty,
      stem_text,solution_text,marks,negative_marks,estimated_seconds,correct_answer,
      exam_types,class_level,source,language,tags,metadata,approved_at
    ) values(
      null,v_student,v_actor,v_bio,'single_correct','approved',
      (array['very_easy','easy','moderate','difficult','very_difficult']::public.question_difficulty[])[((v_i+3)%5)+1],
      'Biology analytics demo question '||v_i,'Generated comparison solution.',1,0.25,40,'["A"]'::jsonb,
      array['NEET'],'Grade 11','Evidara analytics cohort','English',array['analytics-demo',v_code],
      jsonb_build_object('demo_batch_id',v_batch,'demo_subject','Biology','demo_sequence',v_i),now()
    ) returning id into v_question;
    insert into public.question_options(question_id,option_key,content_text,is_correct,display_order)
    values(v_question,'A','Correct generated option',true,1),(v_question,'B','Generated distractor',false,2),
      (v_question,'C','Generated distractor',false,3),(v_question,'D','Generated distractor',false,4);
  end loop;

  for v_series in 1..6 loop
    v_track:=case when v_series<=3 then 'PCM' else 'PCB' end;
    v_exam:=case when v_track='PCM' then 'JEE Main' else 'NEET' end;
    v_third_subject:=case when v_track='PCM' then 'Mathematics' else 'Biology' end;
    v_third_subject_id:=case when v_track='PCM' then v_mat else v_bio end;

    insert into public.products(
      name,slug,short_description,description,product_type,audience,exam_type,status,is_featured,
      created_by,updated_by,commerce_settings,grade_levels
    ) values(
      'Demo '||case when v_track='PCM' then 'JEE' else 'NEET' end||' Series '||case when v_track='PCM' then v_series else v_series-3 end,
      lower(v_code)||'-'||lower(v_track)||'-series-'||v_series,
      '100-student analytics comparison series',
      'Ten-paper generated series for validating product completion, percentile and subject comparisons.',
      'test_series','student',v_exam,'published',false,v_actor,v_actor,
      jsonb_build_object('demo_batch_id',v_batch,'generated',true,'demo_track',v_track,'demo_series',case when v_track='PCM' then v_series else v_series-3 end),
      array['Grade 11']
    ) returning id into v_product;

    insert into public.product_versions(
      product_id,version_number,mrp_paise,selling_price_paise,access_days,max_attempts,features,is_current,created_by
    ) values(
      v_product,1,19900,19900,365,100,jsonb_build_array('100-student comparison cohort','Ten tests per series'),true,v_actor
    ) returning id into v_version;

    if v_track='PCM' then
      insert into public.entitlements(
        user_id,product_id,product_version_id,source,status,starts_at,expires_at,attempts_limit,granted_by,commerce_metadata
      ) values(
        v_student,v_product,v_version,'analytics_demo','active',now(),now()+interval '365 days',100,v_actor,
        jsonb_build_object('demo_batch_id',v_batch,'demo_track',v_track)
      );
    end if;

    for v_test in 1..10 loop
      insert into public.question_papers(
        organization_id,created_by,updated_by,title,code,description,exam_type,status,duration_minutes,
        instructions,access_mode,attempt_limit,shuffle_questions,shuffle_options,result_mode,total_marks,total_questions,
        settings,published_at,grade_level,test_type,open_forever
      ) values(
        null,v_student,v_actor,
        'Demo '||case when v_track='PCM' then 'JEE' else 'NEET' end||' Series '||case when v_track='PCM' then v_series else v_series-3 end||' · Test '||v_test,
        v_code||'-'||v_track||'-S'||v_series||'-T'||lpad(v_test::text,2,'0'),
        'Generated 100-question paper for comparison analytics.',v_exam,'published',180,
        'Generated demo assessment.','public',100,false,false,'in_depth_analytics',100,100,
        jsonb_build_object('demo_batch_id',v_batch,'demo_track',v_track,'demo_series',case when v_track='PCM' then v_series else v_series-3 end,'demo_test',v_test),
        now(),'Grade 11','full_length_mock',true
      ) returning id into v_paper;

      insert into public.paper_sections(paper_id,title,subject_id,instructions,questions_to_attempt,display_order)
      values(v_paper,'Physics',v_phy,null,34,1) returning id into v_sec1;
      insert into public.paper_sections(paper_id,title,subject_id,instructions,questions_to_attempt,display_order)
      values(v_paper,'Chemistry',v_che,null,33,2) returning id into v_sec2;
      insert into public.paper_sections(paper_id,title,subject_id,instructions,questions_to_attempt,display_order)
      values(v_paper,v_third_subject,v_third_subject_id,null,33,3) returning id into v_sec3;

      insert into public.paper_questions(
        paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot
      )
      select v_paper,v_sec1,question.id,row_number() over(order by (question.metadata->>'demo_sequence')::integer),1,0.25,true,
        jsonb_build_object(
          'id',question.id,'stem_text',question.stem_text,'question_type','single_correct','difficulty',question.difficulty,
          'marks',1,'negative_marks',0.25,'subject_name','Physics','correct_answer',jsonb_build_array('A'),
          'options',jsonb_build_array(
            jsonb_build_object('option_key','A','content_text','Correct generated option','is_correct',true,'display_order',1),
            jsonb_build_object('option_key','B','content_text','Generated distractor','is_correct',false,'display_order',2),
            jsonb_build_object('option_key','C','content_text','Generated distractor','is_correct',false,'display_order',3),
            jsonb_build_object('option_key','D','content_text','Generated distractor','is_correct',false,'display_order',4)
          )
        )
      from public.questions question
      where question.subject_id=v_phy and question.metadata->>'demo_batch_id'=v_batch::text
      order by (question.metadata->>'demo_sequence')::integer
      limit 34;

      insert into public.paper_questions(
        paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot
      )
      select v_paper,v_sec2,question.id,34+row_number() over(order by (question.metadata->>'demo_sequence')::integer),1,0.25,true,
        jsonb_build_object(
          'id',question.id,'stem_text',question.stem_text,'question_type','single_correct','difficulty',question.difficulty,
          'marks',1,'negative_marks',0.25,'subject_name','Chemistry','correct_answer',jsonb_build_array('A'),
          'options',jsonb_build_array(
            jsonb_build_object('option_key','A','content_text','Correct generated option','is_correct',true,'display_order',1),
            jsonb_build_object('option_key','B','content_text','Generated distractor','is_correct',false,'display_order',2),
            jsonb_build_object('option_key','C','content_text','Generated distractor','is_correct',false,'display_order',3),
            jsonb_build_object('option_key','D','content_text','Generated distractor','is_correct',false,'display_order',4)
          )
        )
      from public.questions question
      where question.subject_id=v_che and question.metadata->>'demo_batch_id'=v_batch::text
      order by (question.metadata->>'demo_sequence')::integer
      limit 33;

      insert into public.paper_questions(
        paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot
      )
      select v_paper,v_sec3,question.id,67+row_number() over(order by (question.metadata->>'demo_sequence')::integer),1,0.25,true,
        jsonb_build_object(
          'id',question.id,'stem_text',question.stem_text,'question_type','single_correct','difficulty',question.difficulty,
          'marks',1,'negative_marks',0.25,'subject_name',v_third_subject,'correct_answer',jsonb_build_array('A'),
          'options',jsonb_build_array(
            jsonb_build_object('option_key','A','content_text','Correct generated option','is_correct',true,'display_order',1),
            jsonb_build_object('option_key','B','content_text','Generated distractor','is_correct',false,'display_order',2),
            jsonb_build_object('option_key','C','content_text','Generated distractor','is_correct',false,'display_order',3),
            jsonb_build_object('option_key','D','content_text','Generated distractor','is_correct',false,'display_order',4)
          )
        )
      from public.questions question
      where question.subject_id=v_third_subject_id and question.metadata->>'demo_batch_id'=v_batch::text
      order by (question.metadata->>'demo_sequence')::integer
      limit 33;

      insert into public.product_papers(product_id,paper_id,display_name,display_order,created_by)
      values(v_product,v_paper,'Test '||v_test,v_test,v_actor);
    end loop;
  end loop;

  insert into public.analytics_demo_students(
    batch_id,auth_user_id,sequence_no,roll_number,full_name,track,section_label
  ) values(
    v_batch,v_student,1,'PCM-001','Sales Demo Student','PCM','PCM-A'
  ) returning id into v_target_demo_student;

  insert into public.analytics_demo_students(
    batch_id,sequence_no,roll_number,full_name,track,section_label
  )
  select v_batch,sequence_no,'PCM-'||lpad(sequence_no::text,3,'0'),
    'Demo PCM Student '||lpad(sequence_no::text,3,'0'),'PCM','PCM-A'
  from generate_series(2,50) sequence_no;

  insert into public.analytics_demo_students(
    batch_id,sequence_no,roll_number,full_name,track,section_label
  )
  select v_batch,50+sequence_no,'PCB-'||lpad(sequence_no::text,3,'0'),
    'Demo PCB Student '||lpad(sequence_no::text,3,'0'),'PCB','PCB-A'
  from generate_series(1,50) sequence_no;

  insert into public.analytics_demo_test_results(
    batch_id,demo_student_id,product_id,paper_id,submitted_at
  )
  select
    v_batch,student.id,product.id,product_paper.paper_id,
    now()-interval '90 days'
      +make_interval(days=>((product.commerce_settings->>'demo_series')::integer-1)*18+product_paper.display_order*2)
      +make_interval(hours=>student.sequence_no%12)
  from public.analytics_demo_students student
  join public.products product
    on product.commerce_settings->>'demo_batch_id'=v_batch::text
   and product.commerce_settings->>'demo_track'=student.track
  join public.product_papers product_paper on product_paper.product_id=product.id
  where product_paper.display_order<=case
    when student.auth_user_id is not null and (product.commerce_settings->>'demo_series')::integer=3 then 7
    when student.auth_user_id is not null then 10
    when (student.sequence_no+(product.commerce_settings->>'demo_series')::integer)%6=0
      then 7+((student.sequence_no+(product.commerce_settings->>'demo_series')::integer)%3)
    else 10
  end;

  insert into public.analytics_demo_subject_results(
    batch_id,demo_student_id,product_id,paper_id,subject_name,marks,maximum_marks,percentage,
    correct_count,incorrect_count,unanswered_count,accuracy_overall,accuracy_attempted,time_score
  )
  select
    result.batch_id,result.demo_student_id,result.product_id,result.paper_id,subject.subject_name,
    round((subject.correct_count-0.25*subject.incorrect_count)::numeric,2),subject.question_count,
    round(100*(subject.correct_count-0.25*subject.incorrect_count)::numeric/subject.question_count,2),
    subject.correct_count,subject.incorrect_count,subject.unanswered_count,
    round(100*subject.correct_count::numeric/subject.question_count,2),
    round(100*subject.correct_count::numeric/greatest(subject.correct_count+subject.incorrect_count,1),2),
    round(subject.time_score::numeric,2)
  from public.analytics_demo_test_results result
  join public.analytics_demo_students student on student.id=result.demo_student_id
  join public.products product on product.id=result.product_id
  join public.product_papers product_paper on product_paper.product_id=product.id and product_paper.paper_id=result.paper_id
  cross join lateral(
    select
      base.subject_name,
      base.question_count,
      least(base.question_count,greatest(0,floor(
        (base.question_count-base.unanswered_count)*least(0.96,greatest(0.34,
          0.46+(student.sequence_no%25)*0.012
          +(product.commerce_settings->>'demo_series')::integer*0.012
          +product_paper.display_order*0.006
          +base.subject_bias
        ))
      )::integer)) as correct_count,
      greatest(0,(base.question_count-base.unanswered_count)-least(base.question_count,greatest(0,floor(
        (base.question_count-base.unanswered_count)*least(0.96,greatest(0.34,
          0.46+(student.sequence_no%25)*0.012
          +(product.commerce_settings->>'demo_series')::integer*0.012
          +product_paper.display_order*0.006
          +base.subject_bias
        ))
      )::integer))) as incorrect_count,
      base.unanswered_count,
      least(9.8,greatest(4.8,
        5.5+(student.sequence_no%20)*0.15+product_paper.display_order*0.08-base.unanswered_count*0.05+base.subject_bias*8
      )) as time_score
    from (
      values
        ('Physics'::text,34::integer,((student.sequence_no+product_paper.display_order+1)%6)::integer,
          case when student.sequence_no%4=0 then 0.05 else -0.01 end::numeric),
        ('Chemistry'::text,33::integer,((student.sequence_no+product_paper.display_order+3)%6)::integer,
          case when student.sequence_no%5=0 then 0.04 else 0.00 end::numeric),
        ((case when student.track='PCM' then 'Mathematics' else 'Biology' end)::text,33::integer,
          ((student.sequence_no+product_paper.display_order+5)%6)::integer,
          case when student.track='PCM' then ((student.sequence_no%7)-3)*0.012 else ((student.sequence_no%6)-2)*0.014 end::numeric)
    ) as base(subject_name,question_count,unanswered_count,subject_bias)
  ) subject;

  update public.analytics_demo_test_results result
  set score=aggregate.score,
      maximum_marks=aggregate.maximum_marks,
      percentage=round(100*aggregate.score/greatest(aggregate.maximum_marks,1),2),
      correct_count=aggregate.correct_count,
      incorrect_count=aggregate.incorrect_count,
      unanswered_count=aggregate.unanswered_count,
      accuracy_overall=round(100*aggregate.correct_count::numeric/greatest(aggregate.maximum_marks,1),2),
      accuracy_attempted=round(100*aggregate.correct_count::numeric/greatest(aggregate.correct_count+aggregate.incorrect_count,1),2),
      time_score=round(aggregate.time_score,2)
  from (
    select subject.demo_student_id,subject.paper_id,
      sum(subject.marks)::numeric as score,
      sum(subject.maximum_marks)::numeric as maximum_marks,
      sum(subject.correct_count)::integer as correct_count,
      sum(subject.incorrect_count)::integer as incorrect_count,
      sum(subject.unanswered_count)::integer as unanswered_count,
      avg(subject.time_score)::numeric as time_score
    from public.analytics_demo_subject_results subject
    where subject.batch_id=v_batch
    group by subject.demo_student_id,subject.paper_id
  ) aggregate
  where result.demo_student_id=aggregate.demo_student_id and result.paper_id=aggregate.paper_id;

  for v_result in
    select result.*
    from public.analytics_demo_test_results result
    where result.demo_student_id=v_target_demo_student
    order by result.submitted_at
  loop
    insert into public.exam_attempts(
      paper_id,student_id,organization_id,attempt_number,status,started_at,expires_at,submitted_at,
      question_order,score,maximum_marks,percentage,correct_count,incorrect_count,unanswered_count,violation_count,metadata
    ) values(
      v_result.paper_id,v_student,v_org,1,'submitted',v_result.submitted_at-interval '120 minutes',
      v_result.submitted_at+interval '60 minutes',v_result.submitted_at,'{}'::uuid[],
      v_result.score,v_result.maximum_marks,v_result.percentage,v_result.correct_count,v_result.incorrect_count,
      v_result.unanswered_count,case when extract(day from v_result.submitted_at)::integer%17=0 then 1 else 0 end,
      jsonb_build_object('demo_batch_id',v_batch,'demo_student_id',v_target_demo_student,'generated',true)
    ) returning id into v_attempt;

    for v_subject_result in
      select subject.*
      from public.analytics_demo_subject_results subject
      where subject.demo_student_id=v_target_demo_student and subject.paper_id=v_result.paper_id
    loop
      insert into public.exam_responses(
        attempt_id,paper_question_id,response,marked_for_review,visited,time_spent_seconds,is_correct,marks_awarded,saved_at
      )
      select
        v_attempt,question.id,
        case when question.position<=v_subject_result.correct_count then '["A"]'::jsonb
             when question.position<=v_subject_result.correct_count+v_subject_result.incorrect_count then '["B"]'::jsonb
             else null end,
        question.position%13=0,true,
        12+((question.position*11+v_subject_result.correct_count*3)%95),
        case when question.position<=v_subject_result.correct_count then true
             when question.position<=v_subject_result.correct_count+v_subject_result.incorrect_count then false
             else null end,
        case when question.position<=v_subject_result.correct_count then 1
             when question.position<=v_subject_result.correct_count+v_subject_result.incorrect_count then -0.25
             else 0 end,
        v_result.submitted_at
      from (
        select paper_question.id,row_number() over(order by paper_question.display_order,paper_question.id)::integer as position
        from public.paper_questions paper_question
        join public.paper_sections paper_section on paper_section.id=paper_question.section_id
        where paper_question.paper_id=v_result.paper_id and paper_section.title=v_subject_result.subject_name
      ) question;
    end loop;
  end loop;

  select
    (select count(*) from public.analytics_demo_students where batch_id=v_batch) as students,
    (select count(*) from public.analytics_demo_test_results where batch_id=v_batch) as test_results,
    (select count(*) from public.analytics_demo_subject_results where batch_id=v_batch) as subject_results,
    (select count(*) from public.exam_attempts where metadata->>'demo_batch_id'=v_batch::text) as attempts,
    (select count(*) from public.exam_responses response join public.exam_attempts attempt on attempt.id=response.attempt_id where attempt.metadata->>'demo_batch_id'=v_batch::text) as responses
  into v_counts;

  update public.analytics_demo_batches
  set generated_students=v_counts.students,
      generated_test_results=v_counts.test_results,
      generated_subject_results=v_counts.subject_results,
      generated_attempts=v_counts.attempts,
      generated_responses=v_counts.responses,
      generated_papers=60,
      generated_products=6,
      status='ready',
      completed_at=now(),
      metadata=jsonb_build_object(
        'cohort_model','100-student PCM-PCB','pcm_students',50,'pcb_students',50,
        'jee_products',3,'neet_products',3,'papers_per_product',10,'questions_per_paper',100,'section_code',v_code
      )
  where id=v_batch;

  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(
    v_actor,v_org,'analytics.demo.cohort_generated','analytics_demo_batch',v_batch::text,
    jsonb_build_object(
      'email',lower(btrim(p_email)),'students',v_counts.students,'test_results',v_counts.test_results,
      'subject_results',v_counts.subject_results,'attempts',v_counts.attempts,'responses',v_counts.responses,
      'papers',60,'products',6
    )
  );

  return jsonb_build_object(
    'batch_id',v_batch,'email',lower(btrim(p_email)),'students',v_counts.students,
    'test_results',v_counts.test_results,'subject_results',v_counts.subject_results,
    'attempts',v_counts.attempts,'responses',v_counts.responses,'papers',60,'products',6,'status','ready'
  );
exception when others then
  if v_batch is not null then
    update public.analytics_demo_batches
    set status='failed',completed_at=now(),metadata=metadata||jsonb_build_object('error',sqlerrm)
    where id=v_batch;
  end if;
  raise;
end;
$$;

grant execute on function public.generate_analytics_demo_data_v10(text,integer) to authenticated;

do $$
begin
  if to_regprocedure('public.reset_analytics_demo_data_base_v11(text,text,text)') is null then
    if to_regprocedure('public.reset_analytics_demo_data_v10(text,text,text)') is not null then
      execute 'alter function public.reset_analytics_demo_data_v10(text,text,text) rename to reset_analytics_demo_data_base_v11';
    end if;
  end if;
end;
$$;

create or replace function public.reset_analytics_demo_data_v10(
  p_email text,
  p_confirm_email text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_batch public.analytics_demo_batches%rowtype;
  v_students integer:=0;
  v_test_results integer:=0;
  v_subject_results integer:=0;
  v_result jsonb;
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

  select * into v_batch
  from public.analytics_demo_batches
  where lower(target_email)=lower(btrim(p_email)) and status in ('ready','failed','generating')
  order by created_at desc
  limit 1
  for update;
  if v_batch.id is null then raise exception 'No generated demo dataset exists for this email.'; end if;

  select count(*) into v_students from public.analytics_demo_students where batch_id=v_batch.id;
  select count(*) into v_test_results from public.analytics_demo_test_results where batch_id=v_batch.id;
  select count(*) into v_subject_results from public.analytics_demo_subject_results where batch_id=v_batch.id;

  delete from public.analytics_demo_subject_results where batch_id=v_batch.id;
  delete from public.analytics_demo_test_results where batch_id=v_batch.id;
  delete from public.analytics_demo_students where batch_id=v_batch.id;

  v_result:=public.reset_analytics_demo_data_base_v11(p_email,p_confirm_email,p_confirmation);
  return v_result||jsonb_build_object(
    'students_deleted',v_students,
    'test_results_deleted',v_test_results,
    'subject_results_deleted',v_subject_results
  );
end;
$$;

grant execute on function public.reset_analytics_demo_data_v10(text,text,text) to authenticated;
revoke execute on function public.reset_analytics_demo_data_base_v11(text,text,text) from authenticated;

create or replace function public.list_analytics_demo_students_v11(
  p_email text default 'sales.student@demo.evidara.app',
  p_product_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,auth
as $$
declare
  v_batch uuid;
begin
  if not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can view the generated student comparison table.' using errcode='42501';
  end if;

  select batch.id into v_batch
  from public.analytics_demo_batches batch
  where lower(batch.target_email)=lower(btrim(p_email)) and batch.status='ready'
  order by batch.created_at desc
  limit 1;

  if v_batch is null then
    return jsonb_build_object('products','[]'::jsonb,'students','[]'::jsonb);
  end if;

  return jsonb_build_object(
    'products',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',product.id,
        'name',product.name,
        'track',product.commerce_settings->>'demo_track',
        'series_number',(product.commerce_settings->>'demo_series')::integer,
        'total_tests',(select count(*) from public.product_papers paper where paper.product_id=product.id)
      ) order by product.commerce_settings->>'demo_track',(product.commerce_settings->>'demo_series')::integer)
      from public.products product
      where product.commerce_settings->>'demo_batch_id'=v_batch::text
    ),'[]'::jsonb),
    'students',coalesce((
      with filtered_results as (
        select result.*
        from public.analytics_demo_test_results result
        where result.batch_id=v_batch and (p_product_id is null or result.product_id=p_product_id)
      ),
      totals as (
        select student.id,student.auth_user_id,student.roll_number,student.full_name,student.track,student.section_label,
          count(result.id)::integer as completed_tests,
          round(sum(result.score),1) as total_marks,
          round(sum(result.maximum_marks),1) as maximum_marks,
          round(100*sum(result.score)/greatest(sum(result.maximum_marks),1),1) as percentage
        from public.analytics_demo_students student
        left join filtered_results result on result.demo_student_id=student.id
        where student.batch_id=v_batch
        group by student.id,student.auth_user_id,student.roll_number,student.full_name,student.track,student.section_label
      ),
      subject_totals as (
        select subject.demo_student_id,subject.subject_name,
          round(100*sum(subject.marks)/greatest(sum(subject.maximum_marks),1),1) as percentage
        from public.analytics_demo_subject_results subject
        where subject.batch_id=v_batch and (p_product_id is null or subject.product_id=p_product_id)
        group by subject.demo_student_id,subject.subject_name
      ),
      subject_json as (
        select demo_student_id,jsonb_object_agg(subject_name,percentage order by subject_name) as subjects
        from subject_totals
        group by demo_student_id
      ),
      completion as (
        select student.id,
          count(*) filter(where product_completed.completed_tests>=10)::integer as completed_series,
          count(*)::integer as available_series
        from public.analytics_demo_students student
        join lateral(
          select product.id,count(result.id)::integer as completed_tests
          from public.products product
          left join public.analytics_demo_test_results result
            on result.product_id=product.id and result.demo_student_id=student.id
          where product.commerce_settings->>'demo_batch_id'=v_batch::text
            and product.commerce_settings->>'demo_track'=student.track
            and (p_product_id is null or product.id=p_product_id)
          group by product.id
        ) product_completed on true
        where student.batch_id=v_batch
        group by student.id
      )
      select jsonb_agg(jsonb_build_object(
        'id',total.id,
        'auth_user_id',total.auth_user_id,
        'roll_number',total.roll_number,
        'full_name',total.full_name,
        'track',total.track,
        'section_label',total.section_label,
        'completed_tests',total.completed_tests,
        'total_marks',coalesce(total.total_marks,0),
        'maximum_marks',coalesce(total.maximum_marks,0),
        'percentage',coalesce(total.percentage,0),
        'subjects',coalesce(subject.subjects,'{}'::jsonb),
        'completed_series',coalesce(completion.completed_series,0),
        'available_series',coalesce(completion.available_series,0),
        'percentile_unlocked',p_product_id is not null and total.completed_tests>=10
      ) order by total.track,total.roll_number)
      from totals total
      left join subject_json subject on subject.demo_student_id=total.id
      left join completion on completion.id=total.id
    ),'[]'::jsonb),
    'generated_at',now()
  );
end;
$$;

grant execute on function public.list_analytics_demo_students_v11(text,uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.demo_cohort_v11_ready','system','36d_v10_analytics_100_student_demo_cohort',
  jsonb_build_object(
    'students',100,'pcm',50,'pcb',50,'jee_series',3,'neet_series',3,
    'tests_per_series',10,'questions_per_test',100,'synthetic_comparison_rows',true
  ));

commit;
