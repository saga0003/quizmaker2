-- Evidara V13.2 isolated benchmark schema.
-- Creates temporary benchmark-only tables; it does not create fake auth users or modify real attempts.
-- Applied to SMIS QP on 2026-07-31. Benchmark run used: b07a0758-2a00-407b-bf66-8ff2889429a4.

create table if not exists public.v13_benchmark_runs (
  id uuid primary key default gen_random_uuid(), label text not null,
  student_count integer not null, question_count integer not null,
  response_count bigint not null default 0, created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);
create table if not exists public.v13_benchmark_students (
  run_id uuid not null references public.v13_benchmark_runs(id) on delete cascade,
  student_no integer not null, ability numeric not null, primary key(run_id,student_no)
);
create table if not exists public.v13_benchmark_questions (
  run_id uuid not null references public.v13_benchmark_runs(id) on delete cascade,
  question_no integer not null, subject_name text not null, chapter_name text not null,
  topic_name text not null, sub_concept text not null, difficulty text not null,
  difficulty_index numeric not null, expected_seconds integer not null,
  primary key(run_id,question_no)
);
create table if not exists public.v13_benchmark_responses (
  run_id uuid not null references public.v13_benchmark_runs(id) on delete cascade,
  student_no integer not null, question_no integer not null, is_correct boolean,
  is_skipped boolean not null, marks_awarded numeric not null,
  time_spent_seconds integer not null, confidence_rating smallint, error_reason text,
  primary key(run_id,student_no,question_no),
  foreign key(run_id,student_no) references public.v13_benchmark_students(run_id,student_no) on delete cascade,
  foreign key(run_id,question_no) references public.v13_benchmark_questions(run_id,question_no) on delete cascade,
  check(confidence_rating is null or confidence_rating between 1 and 5)
);
create index if not exists v13_benchmark_responses_run_student_idx on public.v13_benchmark_responses(run_id,student_no);
create index if not exists v13_benchmark_responses_run_question_idx on public.v13_benchmark_responses(run_id,question_no);
create index if not exists v13_benchmark_questions_taxonomy_idx on public.v13_benchmark_questions(run_id,subject_name,chapter_name,topic_name);
alter table public.v13_benchmark_runs enable row level security;
alter table public.v13_benchmark_students enable row level security;
alter table public.v13_benchmark_questions enable row level security;
alter table public.v13_benchmark_responses enable row level security;
revoke all on public.v13_benchmark_runs,public.v13_benchmark_students,public.v13_benchmark_questions,public.v13_benchmark_responses from anon,authenticated;

create or replace function public.cleanup_v13_benchmark(p_run_id uuid) returns void
language plpgsql security definer set search_path=public as $$
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' and not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;
  delete from public.v13_benchmark_runs where id=p_run_id;
end $$;
revoke all on function public.cleanup_v13_benchmark(uuid) from public,anon,authenticated;
grant execute on function public.cleanup_v13_benchmark(uuid) to service_role;

drop view if exists public.v13_benchmark_student_results;
create view public.v13_benchmark_student_results with (security_invoker=true) as
with totals as (
  select r.run_id,r.student_no,sum(r.marks_awarded)::numeric score,
    count(*) filter(where r.is_correct=true)::integer correct_count,
    count(*) filter(where r.is_correct=false)::integer incorrect_count,
    count(*) filter(where r.is_skipped=true)::integer skipped_count,
    round(avg(r.time_spent_seconds)::numeric,2) avg_seconds,
    round(avg(r.confidence_rating)::numeric,2) confidence_index
  from public.v13_benchmark_responses r group by r.run_id,r.student_no
), ranked as (
  select t.*,round(100*t.score/nullif(br.question_count*4,0),2) percentage,
    rank() over(partition by t.run_id order by t.score desc,t.avg_seconds asc,t.student_no) rank,
    round(100*percent_rank() over(partition by t.run_id order by t.score),2) percentile
  from totals t join public.v13_benchmark_runs br on br.id=t.run_id
)
select * from ranked;

drop view if exists public.v13_benchmark_taxonomy_results;
create view public.v13_benchmark_taxonomy_results with (security_invoker=true) as
select r.run_id,r.student_no,q.subject_name,q.chapter_name,q.topic_name,q.sub_concept,
  count(*)::integer questions,
  count(*) filter(where r.is_correct=true)::integer correct,
  count(*) filter(where r.is_correct=false)::integer incorrect,
  count(*) filter(where r.is_skipped=true)::integer skipped,
  round(100*count(*) filter(where r.is_correct=true)::numeric/nullif(count(*) filter(where not r.is_skipped),0),2) accuracy,
  round(avg(r.time_spent_seconds)::numeric,2) avg_seconds,
  round(avg(r.confidence_rating)::numeric,2) confidence_index
from public.v13_benchmark_responses r
join public.v13_benchmark_questions q on q.run_id=r.run_id and q.question_no=r.question_no
group by r.run_id,r.student_no,q.subject_name,q.chapter_name,q.topic_name,q.sub_concept;
