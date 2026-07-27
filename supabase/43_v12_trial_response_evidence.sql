-- Evidara V12 — complete trial question-response evidence
-- Run after 42_v10_12_analytics_student_directory.sql.
-- This migration does not run the rebuild automatically.

begin;

create table if not exists public.analytics_demo_response_events_v12 (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.analytics_demo_batches(id) on delete cascade,
  demo_student_id uuid not null references public.analytics_demo_students(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  paper_question_id uuid not null references public.paper_questions(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  subject_name text not null,
  chapter_id uuid,
  topic_id uuid,
  difficulty text,
  question_order integer not null,
  started_at timestamptz not null,
  answered_at timestamptz,
  response_time_seconds integer not null default 0 check(response_time_seconds>=0),
  selected_answer jsonb not null default '[]'::jsonb,
  initial_answer jsonb not null default '[]'::jsonb,
  answer_change_count integer not null default 0 check(answer_change_count>=0),
  changed_correct_to_wrong boolean not null default false,
  changed_wrong_to_correct boolean not null default false,
  marked_for_review boolean not null default false,
  is_correct boolean,
  was_skipped boolean not null default false,
  revision_cycle integer not null default 0,
  delayed_retention_check boolean not null default false,
  interruption_flag boolean not null default false,
  created_at timestamptz not null default now(),
  unique(batch_id,demo_student_id,paper_id,paper_question_id)
);

create index if not exists analytics_demo_response_events_v12_student_idx on public.analytics_demo_response_events_v12(demo_student_id,answered_at);
create index if not exists analytics_demo_response_events_v12_taxonomy_idx on public.analytics_demo_response_events_v12(subject_name,chapter_id,topic_id);
create index if not exists analytics_demo_response_events_v12_paper_idx on public.analytics_demo_response_events_v12(paper_id,question_order);

alter table public.analytics_demo_response_events_v12 enable row level security;

drop policy if exists analytics_demo_response_events_v12_super_admin on public.analytics_demo_response_events_v12;
create policy analytics_demo_response_events_v12_super_admin on public.analytics_demo_response_events_v12
for select to authenticated using(public.is_evidara_super_admin());

create or replace function public.rebuild_v12_trial_response_evidence(
  p_email text default 'sales.student@demo.evidara.app'
)
returns jsonb
language plpgsql
security definer
set search_path=public
set statement_timeout='300s'
as $$
declare
  v_batch public.analytics_demo_batches;
  v_deleted bigint:=0;
  v_inserted bigint:=0;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.is_evidara_super_admin() then raise exception 'Only Super Admin can rebuild V12 trial evidence.' using errcode='42501'; end if;

  select * into v_batch from public.analytics_demo_batches
  where lower(target_email)=lower(btrim(coalesce(p_email,''))) and status='ready'
  order by created_at desc limit 1;
  if v_batch.id is null then raise exception 'Create the demo cohort and questions first.'; end if;

  delete from public.analytics_demo_response_events_v12 where batch_id=v_batch.id;
  get diagnostics v_deleted=row_count;

  insert into public.analytics_demo_response_events_v12(
    batch_id,demo_student_id,product_id,paper_id,paper_question_id,question_id,
    subject_name,chapter_id,topic_id,difficulty,question_order,started_at,answered_at,
    response_time_seconds,selected_answer,initial_answer,answer_change_count,
    changed_correct_to_wrong,changed_wrong_to_correct,marked_for_review,is_correct,
    was_skipped,revision_cycle,delayed_retention_check,interruption_flag
  )
  select
    result.batch_id,result.demo_student_id,result.product_id,result.paper_id,pq.id,pq.question_id,
    coalesce(subject.name,section.title,pq.question_snapshot->>'subject_name','General'),
    nullif(coalesce(pq.question_snapshot->>'chapter_id',question.metadata->>'chapter_id'),'')::uuid,
    nullif(coalesce(pq.question_snapshot->>'topic_id',question.metadata->>'topic_id'),'')::uuid,
    coalesce(pq.question_snapshot->>'difficulty',question.difficulty::text,'moderate'),
    pq.display_order,
    result.submitted_at-(greatest(result.actual_time_seconds,60)||' seconds')::interval
      + ((pq.display_order-1)*greatest(result.actual_time_seconds,60)/greatest(count(*) over(partition by result.id),1)||' seconds')::interval,
    case when (abs(hashtextextended(result.demo_student_id::text||pq.id::text,11))%100)<8 then null else
      result.submitted_at-(greatest(result.actual_time_seconds,60)||' seconds')::interval
      + ((pq.display_order)*greatest(result.actual_time_seconds,60)/greatest(count(*) over(partition by result.id),1)||' seconds')::interval end,
    case when (abs(hashtextextended(result.demo_student_id::text||pq.id::text,11))%100)<8 then 0 else
      greatest(4,least(240,(greatest(result.actual_time_seconds,60)/greatest(count(*) over(partition by result.id),1))::integer
      + ((abs(hashtextextended(pq.id::text||result.demo_student_id::text,17))%35)-17)::integer)) end,
    case when (abs(hashtextextended(result.demo_student_id::text||pq.id::text,11))%100)<8 then '[]'::jsonb else jsonb_build_array(chr(65+(abs(hashtextextended(result.demo_student_id::text||pq.id::text,23))%4)::integer)) end,
    case when (abs(hashtextextended(result.demo_student_id::text||pq.id::text,29))%100)<16 then jsonb_build_array(chr(65+(abs(hashtextextended(pq.id::text,31))%4)::integer)) else '[]'::jsonb end,
    case when (abs(hashtextextended(result.demo_student_id::text||pq.id::text,29))%100)<16 then 1 else 0 end,
    (abs(hashtextextended(result.demo_student_id::text||pq.id::text,37))%100)<5,
    (abs(hashtextextended(result.demo_student_id::text||pq.id::text,41))%100)<9,
    (abs(hashtextextended(result.demo_student_id::text||pq.id::text,43))%100)<18,
    case when (abs(hashtextextended(result.demo_student_id::text||pq.id::text,11))%100)<8 then null
      else (abs(hashtextextended(result.demo_student_id::text||pq.id::text,47))%100)<greatest(15,least(95,result.accuracy_overall::integer)) end,
    (abs(hashtextextended(result.demo_student_id::text||pq.id::text,11))%100)<8,
    greatest(0,((row_number() over(partition by result.demo_student_id,result.product_id order by result.submitted_at)-1)/3)::integer),
    (row_number() over(partition by result.demo_student_id,result.product_id order by result.submitted_at)%3)=0,
    (abs(hashtextextended(result.demo_student_id::text||pq.id::text,53))%100)<2
  from public.analytics_demo_test_results result
  join public.paper_questions pq on pq.paper_id=result.paper_id
  join public.paper_sections section on section.id=pq.section_id
  left join public.subjects subject on subject.id=section.subject_id
  left join public.questions question on question.id=pq.question_id
  where result.batch_id=v_batch.id;

  get diagnostics v_inserted=row_count;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),'analytics.v12.trial_response_evidence_rebuilt','analytics_demo_batch',v_batch.id::text,
    jsonb_build_object('deleted',v_deleted,'inserted',v_inserted,'answer_changes',true,'revision_cycles',true,'retention_checks',true));

  return jsonb_build_object(
    'batch_id',v_batch.id,'students',(select count(*) from public.analytics_demo_students where batch_id=v_batch.id),
    'events',v_inserted,'deleted_previous',v_deleted,
    'answer_changes',(select count(*) from public.analytics_demo_response_events_v12 where batch_id=v_batch.id and answer_change_count>0),
    'retention_checks',(select count(*) from public.analytics_demo_response_events_v12 where batch_id=v_batch.id and delayed_retention_check),
    'ready',true,'generated_at',now()
  );
end;
$$;

grant execute on function public.rebuild_v12_trial_response_evidence(text) to authenticated;

create or replace function public.get_v12_learning_behaviour_evidence(p_demo_student_id uuid)
returns jsonb language sql stable security definer set search_path=public as $$
  select jsonb_build_object(
    'responses',count(*),
    'comparable_tests',count(distinct paper_id),
    'average_response_seconds',round(avg(response_time_seconds)::numeric,1),
    'skipped',count(*) filter(where was_skipped),
    'reviewed',count(*) filter(where marked_for_review),
    'answer_changes',count(*) filter(where answer_change_count>0),
    'correct_to_wrong',count(*) filter(where changed_correct_to_wrong),
    'wrong_to_correct',count(*) filter(where changed_wrong_to_correct),
    'first_third_accuracy',round(100*avg(case when question_order<=34 then is_correct::integer end)::numeric,1),
    'final_third_accuracy',round(100*avg(case when question_order>=67 then is_correct::integer end)::numeric,1),
    'post_revision_accuracy',round(100*avg(case when revision_cycle>0 then is_correct::integer end)::numeric,1),
    'delayed_retention_accuracy',round(100*avg(case when delayed_retention_check then is_correct::integer end)::numeric,1),
    'generated_at',now()
  ) from public.analytics_demo_response_events_v12
  where demo_student_id=p_demo_student_id and public.is_evidara_super_admin();
$$;

grant execute on function public.get_v12_learning_behaviour_evidence(uuid) to authenticated;

commit;
