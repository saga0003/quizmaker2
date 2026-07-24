-- Evidara V10 Analytics Phase 4
-- Run after 37a_v10_analytics_phase_3_review_hardening.sql.
-- Adds the final simple time-management score and chapter/topic demo analytics.

begin;

create or replace function public.analytics_time_management_score_v12(
  p_total_questions integer,
  p_attempted_questions integer,
  p_correct_answers integer,
  p_total_duration_minutes integer,
  p_actual_time_seconds integer,
  p_ended_automatically boolean default false
)
returns numeric
language plpgsql
immutable
as $$
declare
  v_total integer:=greatest(coalesce(p_total_questions,0),0);
  v_attempted integer:=greatest(coalesce(p_attempted_questions,0),0);
  v_correct integer:=greatest(coalesce(p_correct_answers,0),0);
  v_duration_seconds integer:=greatest(coalesce(p_total_duration_minutes,0)*60,0);
  v_actual integer:=greatest(coalesce(p_actual_time_seconds,0),0);
  v_completion numeric:=0;
  v_accuracy numeric:=0;
  v_time_control numeric:=0;
  v_score numeric:=0;
begin
  if v_total<=0 then return 0; end if;
  v_attempted:=least(v_attempted,v_total);
  v_correct:=least(v_correct,v_attempted);
  v_completion:=v_attempted::numeric/v_total;
  v_accuracy:=case when v_attempted>0 then v_correct::numeric/v_attempted else 0 end;

  if v_attempted>=v_total and not coalesce(p_ended_automatically,false) then
    v_time_control:=1;
  elsif v_attempted>=v_total and coalesce(p_ended_automatically,false) then
    v_time_control:=0.8;
  else
    v_time_control:=v_completion;
  end if;

  v_score:=10*(0.50*v_completion+0.30*v_accuracy+0.20*v_time_control);

  if v_duration_seconds>0 and v_actual<0.50*v_duration_seconds and v_accuracy<0.60 then
    v_score:=v_score-1;
  end if;
  if coalesce(p_ended_automatically,false) and v_attempted<v_total then
    v_score:=v_score-1;
  end if;

  return round(greatest(0,least(10,v_score)),1);
end;
$$;

create or replace function public.analytics_time_management_rating_v12(p_score numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_score,0)<4 then 'Needs Improvement'
    when p_score<6 then 'Average'
    when p_score<7.5 then 'Good'
    when p_score<9 then 'Very Good'
    else 'Excellent'
  end;
$$;

create or replace function public.analytics_time_management_insight_v12(
  p_score numeric,
  p_attempted integer,
  p_total integer,
  p_ended_automatically boolean
)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_total,0)<=0 then 'No completed question evidence is available.'
    when coalesce(p_ended_automatically,false) and coalesce(p_attempted,0)<p_total then 'The test ended automatically with unanswered questions. Review how time was distributed across the paper.'
    when coalesce(p_score,0)>=7.5 and coalesce(p_attempted,0)>=0.9*p_total then 'You managed the available time well and completed most of the paper.'
    when coalesce(p_score,0)>=6 then 'Time use was generally controlled, with room to improve completion or accuracy.'
    else 'Focus on completing more of the paper without rushing accuracy.'
  end;
$$;

grant execute on function public.analytics_time_management_score_v12(integer,integer,integer,integer,integer,boolean) to authenticated;
grant execute on function public.analytics_time_management_rating_v12(numeric) to authenticated;
grant execute on function public.analytics_time_management_insight_v12(numeric,integer,integer,boolean) to authenticated;

alter table public.analytics_demo_test_results
  add column if not exists duration_minutes integer not null default 180,
  add column if not exists actual_time_seconds integer not null default 0,
  add column if not exists ended_automatically boolean not null default false;

create table if not exists public.analytics_demo_chapters_v12(
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.analytics_demo_batches(id) on delete cascade,
  subject_name text not null,
  name text not null,
  code text not null,
  display_order integer not null,
  created_at timestamptz not null default now(),
  unique(batch_id,subject_name,code)
);

create table if not exists public.analytics_demo_topics_v12(
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.analytics_demo_batches(id) on delete cascade,
  chapter_id uuid not null references public.analytics_demo_chapters_v12(id) on delete cascade,
  subject_name text not null,
  name text not null,
  code text not null,
  display_order integer not null,
  created_at timestamptz not null default now(),
  unique(batch_id,subject_name,code)
);

create table if not exists public.analytics_demo_topic_results_v12(
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.analytics_demo_batches(id) on delete cascade,
  demo_student_id uuid not null references public.analytics_demo_students(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  subject_name text not null,
  chapter_id uuid not null references public.analytics_demo_chapters_v12(id) on delete cascade,
  topic_id uuid not null references public.analytics_demo_topics_v12(id) on delete cascade,
  total_questions integer not null,
  correct_count integer not null,
  incorrect_count integer not null,
  unanswered_count integer not null,
  marks numeric(10,2) not null,
  maximum_marks numeric(10,2) not null,
  percentage numeric(7,2) not null,
  accuracy_overall numeric(7,2) not null,
  accuracy_attempted numeric(7,2) not null,
  created_at timestamptz not null default now(),
  unique(demo_student_id,paper_id,topic_id)
);

create index if not exists analytics_demo_chapters_v12_scope_idx on public.analytics_demo_chapters_v12(batch_id,subject_name,display_order);
create index if not exists analytics_demo_topics_v12_scope_idx on public.analytics_demo_topics_v12(batch_id,subject_name,chapter_id,display_order);
create index if not exists analytics_demo_topic_results_v12_scope_idx on public.analytics_demo_topic_results_v12(batch_id,product_id,demo_student_id,subject_name,chapter_id,topic_id);

alter table public.analytics_demo_chapters_v12 enable row level security;
alter table public.analytics_demo_topics_v12 enable row level security;
alter table public.analytics_demo_topic_results_v12 enable row level security;

drop policy if exists analytics_demo_chapters_v12_admin on public.analytics_demo_chapters_v12;
create policy analytics_demo_chapters_v12_admin on public.analytics_demo_chapters_v12 for select to authenticated using(public.analytics_is_platform_admin_v10());
drop policy if exists analytics_demo_topics_v12_admin on public.analytics_demo_topics_v12;
create policy analytics_demo_topics_v12_admin on public.analytics_demo_topics_v12 for select to authenticated using(public.analytics_is_platform_admin_v10());
drop policy if exists analytics_demo_topic_results_v12_admin on public.analytics_demo_topic_results_v12;
create policy analytics_demo_topic_results_v12_admin on public.analytics_demo_topic_results_v12 for select to authenticated using(public.analytics_is_platform_admin_v10());

grant select on public.analytics_demo_chapters_v12,public.analytics_demo_topics_v12,public.analytics_demo_topic_results_v12 to authenticated;
revoke insert,update,delete on public.analytics_demo_chapters_v12,public.analytics_demo_topics_v12,public.analytics_demo_topic_results_v12 from authenticated;

do $$
begin
  if to_regprocedure('public.generate_analytics_demo_data_base_v12(text,integer)') is null
     and to_regprocedure('public.generate_analytics_demo_data_v10(text,integer)') is not null then
    execute 'alter function public.generate_analytics_demo_data_v10(text,integer) rename to generate_analytics_demo_data_base_v12';
  end if;
end;
$$;

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
  v_result jsonb;
  v_batch uuid;
  v_code text;
  v_chapter record;
  v_topic_names text[];
  v_topic_name text;
  v_topic_index integer;
begin
  v_result:=public.generate_analytics_demo_data_base_v12(p_email,p_evidence_rows);
  v_batch:=(v_result->>'batch_id')::uuid;
  v_code:='DEMO-'||upper(substr(replace(v_batch::text,'-',''),1,8));

  insert into public.analytics_demo_chapters_v12(batch_id,subject_name,name,code,display_order)
  select v_batch,subject_name,chapter_name,v_code||'-'||subject_code||'-C'||chapter_order,chapter_order
  from (values
    ('Physics','PHY',1,'Mechanics'),('Physics','PHY',2,'Heat and Thermodynamics'),('Physics','PHY',3,'Electricity and Magnetism'),('Physics','PHY',4,'Optics and Modern Physics'),
    ('Chemistry','CHE',1,'Physical Chemistry'),('Chemistry','CHE',2,'Organic Chemistry'),('Chemistry','CHE',3,'Inorganic Chemistry'),('Chemistry','CHE',4,'Atomic Structure and Bonding'),
    ('Mathematics','MAT',1,'Algebra'),('Mathematics','MAT',2,'Calculus'),('Mathematics','MAT',3,'Coordinate Geometry'),('Mathematics','MAT',4,'Trigonometry and Probability'),
    ('Biology','BIO',1,'Cell and Biomolecules'),('Biology','BIO',2,'Human Physiology'),('Biology','BIO',3,'Genetics and Evolution'),('Biology','BIO',4,'Ecology and Plant Physiology')
  ) taxonomy(subject_name,subject_code,chapter_order,chapter_name)
  on conflict do nothing;

  for v_chapter in
    select * from public.analytics_demo_chapters_v12 where batch_id=v_batch order by subject_name,display_order
  loop
    v_topic_names:=case v_chapter.name
      when 'Mechanics' then array['Units and Motion','Laws of Motion','Work Energy and Rotation']
      when 'Heat and Thermodynamics' then array['Thermal Properties','Thermodynamic Processes','Kinetic Theory']
      when 'Electricity and Magnetism' then array['Electrostatics','Current Electricity','Magnetism and EMI']
      when 'Optics and Modern Physics' then array['Ray Optics','Wave Optics','Atoms Nuclei and Semiconductors']
      when 'Physical Chemistry' then array['Mole Concept','Thermodynamics and Equilibrium','Electrochemistry and Kinetics']
      when 'Organic Chemistry' then array['General Organic Chemistry','Hydrocarbons','Functional Groups']
      when 'Inorganic Chemistry' then array['Periodic Trends','Coordination Chemistry','p Block and d Block']
      when 'Atomic Structure and Bonding' then array['Atomic Models','Chemical Bonding','States of Matter']
      when 'Algebra' then array['Sets and Functions','Complex Numbers','Sequences and Matrices']
      when 'Calculus' then array['Limits and Continuity','Differentiation','Integration']
      when 'Coordinate Geometry' then array['Straight Lines','Circles','Conic Sections']
      when 'Trigonometry and Probability' then array['Trigonometric Functions','Statistics','Probability']
      when 'Cell and Biomolecules' then array['Cell Structure','Biomolecules','Cell Cycle']
      when 'Human Physiology' then array['Digestion and Respiration','Circulation and Excretion','Neural and Chemical Control']
      when 'Genetics and Evolution' then array['Mendelian Genetics','Molecular Genetics','Evolution']
      else array['Plant Physiology','Organisms and Populations','Ecosystem and Biodiversity']
    end;
    v_topic_index:=0;
    foreach v_topic_name in array v_topic_names loop
      v_topic_index:=v_topic_index+1;
      insert into public.analytics_demo_topics_v12(batch_id,chapter_id,subject_name,name,code,display_order)
      values(v_batch,v_chapter.id,v_chapter.subject_name,v_topic_name,v_chapter.code||'-T'||v_topic_index,v_topic_index)
      on conflict do nothing;
    end loop;
  end loop;

  with topic_order as (
    select topic.*,((chapter.display_order-1)*3+topic.display_order) as subject_topic_order
    from public.analytics_demo_topics_v12 topic
    join public.analytics_demo_chapters_v12 chapter on chapter.id=topic.chapter_id
    where topic.batch_id=v_batch
  ), allocated as (
    select subject.*,topic.id as topic_id,topic.chapter_id,topic.subject_topic_order,
      floor(subject.correct_count/12.0)::integer + case when topic.subject_topic_order<=mod(subject.correct_count,12) then 1 else 0 end as correct_value,
      floor(subject.incorrect_count/12.0)::integer + case when topic.subject_topic_order<=mod(subject.incorrect_count,12) then 1 else 0 end as incorrect_value,
      floor(subject.unanswered_count/12.0)::integer + case when topic.subject_topic_order<=mod(subject.unanswered_count,12) then 1 else 0 end as unanswered_value
    from public.analytics_demo_subject_results subject
    join topic_order topic on topic.subject_name=subject.subject_name
    where subject.batch_id=v_batch
  )
  insert into public.analytics_demo_topic_results_v12(
    batch_id,demo_student_id,product_id,paper_id,subject_name,chapter_id,topic_id,total_questions,
    correct_count,incorrect_count,unanswered_count,marks,maximum_marks,percentage,accuracy_overall,accuracy_attempted
  )
  select batch_id,demo_student_id,product_id,paper_id,subject_name,chapter_id,topic_id,
    correct_value+incorrect_value+unanswered_value,correct_value,incorrect_value,unanswered_value,
    round((correct_value-0.25*incorrect_value)::numeric,2),
    correct_value+incorrect_value+unanswered_value,
    round(100*(correct_value-0.25*incorrect_value)::numeric/greatest(correct_value+incorrect_value+unanswered_value,1),2),
    round(100*correct_value::numeric/greatest(correct_value+incorrect_value+unanswered_value,1),2),
    round(100*correct_value::numeric/greatest(correct_value+incorrect_value,1),2)
  from allocated
  on conflict do nothing;

  update public.analytics_demo_test_results result
  set duration_minutes=180,
      ended_automatically=((student.sequence_no+paper.display_order+coalesce((product.commerce_settings->>'demo_series')::integer,0))%11=0),
      actual_time_seconds=case
        when ((student.sequence_no+paper.display_order+coalesce((product.commerce_settings->>'demo_series')::integer,0))%11=0) then 10800
        when result.accuracy_overall<60 and ((student.sequence_no+paper.display_order)%9=0) then 4200
        else least(10620,6900+((student.sequence_no*97+paper.display_order*173)%3300))
      end
  from public.analytics_demo_students student
  join public.product_papers paper on true
  join public.products product on product.id=paper.product_id
  where result.batch_id=v_batch
    and student.id=result.demo_student_id
    and paper.paper_id=result.paper_id
    and product.id=result.product_id;

  update public.analytics_demo_test_results
  set time_score=public.analytics_time_management_score_v12(
    correct_count+incorrect_count+unanswered_count,
    correct_count+incorrect_count,
    correct_count,
    duration_minutes,
    actual_time_seconds,
    ended_automatically
  )
  where batch_id=v_batch;

  update public.exam_attempts attempt
  set started_at=attempt.submitted_at-make_interval(secs=>result.actual_time_seconds),
      expires_at=attempt.submitted_at-make_interval(secs=>result.actual_time_seconds)+make_interval(mins=>result.duration_minutes),
      metadata=attempt.metadata||jsonb_build_object(
        'submission_reason',case when result.ended_automatically then 'timeout' else 'normal' end,
        'ended_automatically',result.ended_automatically,
        'phase4_time_score',result.time_score
      )
  from public.analytics_demo_test_results result
  where attempt.metadata->>'demo_batch_id'=v_batch::text and attempt.paper_id=result.paper_id
    and result.demo_student_id=(select id from public.analytics_demo_students where batch_id=v_batch and auth_user_id is not null limit 1);

  update public.questions question
  set metadata=question.metadata||jsonb_build_object(
    'chapter_name',chapter.name,
    'topic_name',topic.name,
    'analytics_chapter_id',chapter.id,
    'analytics_topic_id',topic.id
  )
  from public.analytics_demo_topics_v12 topic
  join public.analytics_demo_chapters_v12 chapter on chapter.id=topic.chapter_id
  where question.metadata->>'demo_batch_id'=v_batch::text
    and topic.batch_id=v_batch
    and topic.subject_name=question.metadata->>'demo_subject'
    and ((coalesce((question.metadata->>'demo_sequence')::integer,1)-1)%12)+1=((chapter.display_order-1)*3+topic.display_order);

  update public.analytics_demo_batches
  set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object(
    'phase4_chapters',16,'phase4_topics',48,
    'time_management_formula','50% completion + 30% attempted accuracy + 20% time control',
    'time_management_scientific_claim',false
  )
  where id=v_batch;

  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  select auth.uid(),organization_id,'analytics.demo.phase4_enriched','analytics_demo_batch',id::text,
    jsonb_build_object('chapters',16,'topics',48,'simple_time_management',true)
  from public.analytics_demo_batches where id=v_batch;

  return v_result||jsonb_build_object('chapters',16,'topics',48,'time_management_formula','v12-simple');
end;
$$;

grant execute on function public.generate_analytics_demo_data_v10(text,integer) to authenticated;
revoke execute on function public.generate_analytics_demo_data_base_v12(text,integer) from authenticated;

do $$
begin
  if to_regprocedure('public.reset_analytics_demo_data_base_v12(text,text,text)') is null
     and to_regprocedure('public.reset_analytics_demo_data_v10(text,text,text)') is not null then
    execute 'alter function public.reset_analytics_demo_data_v10(text,text,text) rename to reset_analytics_demo_data_base_v12';
  end if;
end;
$$;

create or replace function public.reset_analytics_demo_data_v10(p_email text,p_confirm_email text,p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $$
declare
  v_batch uuid;
  v_chapters integer:=0;
  v_topics integer:=0;
  v_topic_results integer:=0;
  v_result jsonb;
begin
  if not public.is_evidara_super_admin() then raise exception 'Only Super Admin can reset generated demo data.' using errcode='42501'; end if;
  if lower(btrim(p_email))<>lower(btrim(p_confirm_email)) then raise exception 'The confirmation email does not match the target account.'; end if;
  if p_confirmation<>'RESET DEMO ANALYTICS' then raise exception 'Type RESET DEMO ANALYTICS exactly to confirm the second deletion step.'; end if;
  select id into v_batch from public.analytics_demo_batches
  where lower(target_email)=lower(btrim(p_email)) and status in ('ready','failed','generating')
  order by created_at desc limit 1;
  if v_batch is not null then
    select count(*) into v_chapters from public.analytics_demo_chapters_v12 where batch_id=v_batch;
    select count(*) into v_topics from public.analytics_demo_topics_v12 where batch_id=v_batch;
    select count(*) into v_topic_results from public.analytics_demo_topic_results_v12 where batch_id=v_batch;
    delete from public.analytics_demo_topic_results_v12 where batch_id=v_batch;
    delete from public.analytics_demo_topics_v12 where batch_id=v_batch;
    delete from public.analytics_demo_chapters_v12 where batch_id=v_batch;
  end if;
  v_result:=public.reset_analytics_demo_data_base_v12(p_email,p_confirm_email,p_confirmation);
  return v_result||jsonb_build_object('chapters_deleted',v_chapters,'topics_deleted',v_topics,'topic_results_deleted',v_topic_results);
end;
$$;

grant execute on function public.reset_analytics_demo_data_v10(text,text,text) to authenticated;
revoke execute on function public.reset_analytics_demo_data_base_v12(text,text,text) from authenticated;

create or replace function public.get_student_taxonomy_analytics_v12(
  p_student_id uuid default auth.uid(),
  p_product_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_student uuid:=coalesce(p_student_id,auth.uid());
  v_batch uuid;
  v_demo_student uuid;
  v_completed integer:=0;
  v_total integer:=0;
  v_time numeric;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.analytics_can_view_student_v10(v_student) then raise exception 'You do not have access to this student taxonomy analytics.' using errcode='42501'; end if;

  select student.batch_id,student.id into v_batch,v_demo_student
  from public.analytics_demo_students student
  join public.analytics_demo_batches batch on batch.id=student.batch_id and batch.status='ready'
  where student.auth_user_id=v_student order by batch.created_at desc limit 1;

  if v_batch is null then
    return jsonb_build_object('products','[]'::jsonb,'chapters','[]'::jsonb,'topics','[]'::jsonb,'demo_taxonomy_available',false,'note','Chapter and topic evidence is available when mapped question taxonomy exists.');
  end if;

  if p_product_id is not null then
    select count(result.id),count(product_paper.paper_id)
    into v_completed,v_total
    from public.product_papers product_paper
    left join public.analytics_demo_test_results result on result.paper_id=product_paper.paper_id and result.demo_student_id=v_demo_student
    where product_paper.product_id=p_product_id;
  else
    select count(*) into v_completed from public.analytics_demo_test_results where demo_student_id=v_demo_student;
    v_total:=v_completed;
  end if;

  if v_total>0 and v_completed>=v_total then
    select round(avg(time_score),1) into v_time from public.analytics_demo_test_results
    where demo_student_id=v_demo_student and (p_product_id is null or product_id=p_product_id);
  end if;

  return jsonb_build_object(
    'products',coalesce((select jsonb_agg(jsonb_build_object('id',product.id,'name',product.name,'exam_type',product.exam_type,'total_tests',(select count(*) from public.product_papers paper where paper.product_id=product.id),'completed_tests',(select count(*) from public.analytics_demo_test_results result where result.product_id=product.id and result.demo_student_id=v_demo_student)) order by product.name) from public.products product where product.commerce_settings->>'demo_batch_id'=v_batch::text and exists(select 1 from public.analytics_demo_test_results result where result.product_id=product.id and result.demo_student_id=v_demo_student)),'[]'::jsonb),
    'completion',jsonb_build_object('completed_tests',v_completed,'total_tests',v_total,'time_score_available',v_total>0 and v_completed>=v_total,'overall_time_score',v_time,'rating',case when v_time is not null then public.analytics_time_management_rating_v12(v_time) end),
    'chapters',coalesce((
      with target as (
        select topic.chapter_id,topic.subject_name,sum(topic.marks) marks,sum(topic.maximum_marks) maximum_marks,
          sum(topic.correct_count) correct_count,sum(topic.incorrect_count) incorrect_count,sum(topic.unanswered_count) unanswered_count
        from public.analytics_demo_topic_results_v12 topic
        where topic.demo_student_id=v_demo_student and (p_product_id is null or topic.product_id=p_product_id)
        group by topic.chapter_id,topic.subject_name
      ), per_student as (
        select topic.demo_student_id,topic.chapter_id,
          100*sum(topic.marks)/greatest(sum(topic.maximum_marks),1) percentage
        from public.analytics_demo_topic_results_v12 topic
        where topic.batch_id=v_batch and (p_product_id is null or topic.product_id=p_product_id)
        group by topic.demo_student_id,topic.chapter_id
      ), benchmark as (
        select chapter_id,count(*) students,avg(percentage) average,max(percentage) highest,
          percentile_cont(.90) within group(order by percentage) top10,
          percentile_cont(.95) within group(order by percentage) top5
        from per_student group by chapter_id
      )
      select jsonb_agg(jsonb_build_object(
        'id',chapter.id,'subject_name',chapter.subject_name,'chapter_name',chapter.name,
        'questions',target.correct_count+target.incorrect_count+target.unanswered_count,
        'correct',target.correct_count,'incorrect',target.incorrect_count,'unanswered',target.unanswered_count,
        'percentage',round(100*target.marks/greatest(target.maximum_marks,1),1),
        'accuracy',round(100*target.correct_count::numeric/greatest(target.correct_count+target.incorrect_count+target.unanswered_count,1),1),
        'average',case when benchmark.students>=2 then round(benchmark.average,1) end,
        'top10',case when benchmark.students>=5 then round(benchmark.top10,1) end,
        'top5',case when benchmark.students>=5 then round(benchmark.top5,1) end,
        'highest',case when benchmark.students>=2 then round(benchmark.highest,1) end,
        'students_compared',benchmark.students
      ) order by chapter.subject_name,chapter.display_order)
      from target join public.analytics_demo_chapters_v12 chapter on chapter.id=target.chapter_id
      left join benchmark on benchmark.chapter_id=target.chapter_id
    ),'[]'::jsonb),
    'topics',coalesce((
      with target as (
        select topic.topic_id,topic.chapter_id,topic.subject_name,sum(topic.marks) marks,sum(topic.maximum_marks) maximum_marks,
          sum(topic.correct_count) correct_count,sum(topic.incorrect_count) incorrect_count,sum(topic.unanswered_count) unanswered_count
        from public.analytics_demo_topic_results_v12 topic
        where topic.demo_student_id=v_demo_student and (p_product_id is null or topic.product_id=p_product_id)
        group by topic.topic_id,topic.chapter_id,topic.subject_name
      ), per_student as (
        select topic.demo_student_id,topic.topic_id,100*sum(topic.marks)/greatest(sum(topic.maximum_marks),1) percentage
        from public.analytics_demo_topic_results_v12 topic
        where topic.batch_id=v_batch and (p_product_id is null or topic.product_id=p_product_id)
        group by topic.demo_student_id,topic.topic_id
      ), benchmark as (
        select topic_id,count(*) students,avg(percentage) average,max(percentage) highest,
          percentile_cont(.90) within group(order by percentage) top10,
          percentile_cont(.95) within group(order by percentage) top5
        from per_student group by topic_id
      )
      select jsonb_agg(jsonb_build_object(
        'id',topic.id,'chapter_id',topic.chapter_id,'subject_name',topic.subject_name,
        'chapter_name',chapter.name,'topic_name',topic.name,
        'questions',target.correct_count+target.incorrect_count+target.unanswered_count,
        'correct',target.correct_count,'incorrect',target.incorrect_count,'unanswered',target.unanswered_count,
        'percentage',round(100*target.marks/greatest(target.maximum_marks,1),1),
        'accuracy',round(100*target.correct_count::numeric/greatest(target.correct_count+target.incorrect_count+target.unanswered_count,1),1),
        'average',case when benchmark.students>=2 then round(benchmark.average,1) end,
        'top10',case when benchmark.students>=5 then round(benchmark.top10,1) end,
        'top5',case when benchmark.students>=5 then round(benchmark.top5,1) end,
        'highest',case when benchmark.students>=2 then round(benchmark.highest,1) end,
        'students_compared',benchmark.students
      ) order by topic.subject_name,chapter.display_order,topic.display_order)
      from target join public.analytics_demo_topics_v12 topic on topic.id=target.topic_id
      join public.analytics_demo_chapters_v12 chapter on chapter.id=topic.chapter_id
      left join benchmark on benchmark.topic_id=target.topic_id
    ),'[]'::jsonb),
    'demo_taxonomy_available',true,
    'generated_at',now()
  );
end;
$$;

grant execute on function public.get_student_taxonomy_analytics_v12(uuid,uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.phase4.taxonomy_time_ready','system','38_v10_analytics_phase_4',jsonb_build_object('chapters',16,'topics',48,'simple_time_score',true,'individual_question_targets',false));

commit;
