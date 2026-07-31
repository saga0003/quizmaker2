-- Evidara V12: post-test student self-classification for incorrect/skipped responses
do $$ begin
  create type public.student_error_classification as enum (
    'concept_gap','calculation_error','careless_error','guessed','ran_out_of_time','other'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.exam_response_self_classifications (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null unique references public.exam_responses(id) on delete cascade,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  classification public.student_error_classification not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint self_classification_note_length check (note is null or char_length(note) <= 300)
);
create index if not exists exam_response_self_classifications_attempt_idx on public.exam_response_self_classifications(attempt_id);
create index if not exists exam_response_self_classifications_student_idx on public.exam_response_self_classifications(student_id, updated_at desc);

alter table public.exam_response_self_classifications enable row level security;
create policy self_classifications_read_own on public.exam_response_self_classifications
for select to authenticated using (student_id = auth.uid() or public.is_super_admin());

create or replace function public.save_exam_response_self_classification_v12(
  p_response_id uuid,
  p_classification public.student_error_classification,
  p_note text default null
) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_response public.exam_responses%rowtype; v_attempt public.exam_attempts%rowtype;
begin
  select * into v_response from public.exam_responses where id=p_response_id;
  if not found then raise exception 'Response not found'; end if;
  select * into v_attempt from public.exam_attempts where id=v_response.attempt_id;
  if v_attempt.student_id <> auth.uid() then raise exception 'Not allowed'; end if;
  if v_attempt.status <> 'submitted' then raise exception 'Classification is available only after submission'; end if;
  if coalesce(v_response.is_correct,false) = true then raise exception 'Correct responses cannot be error-classified'; end if;
  insert into public.exam_response_self_classifications(response_id,attempt_id,student_id,classification,note)
  values(p_response_id,v_attempt.id,v_attempt.student_id,p_classification,nullif(btrim(p_note),''))
  on conflict(response_id) do update set classification=excluded.classification,note=excluded.note,updated_at=now();
  return jsonb_build_object('saved',true,'response_id',p_response_id,'classification',p_classification);
end $$;
revoke all on function public.save_exam_response_self_classification_v12(uuid,public.student_error_classification,text) from public;
grant execute on function public.save_exam_response_self_classification_v12(uuid,public.student_error_classification,text) to authenticated;

create or replace function public.list_post_test_self_classification_queue_v12(p_attempt_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_attempt public.exam_attempts%rowtype;
begin
 select * into v_attempt from public.exam_attempts where id=p_attempt_id;
 if not found or v_attempt.student_id<>auth.uid() then raise exception 'Not allowed'; end if;
 if v_attempt.status<>'submitted' then raise exception 'Attempt is not submitted'; end if;
 return jsonb_build_object('attempt_id',p_attempt_id,'items',coalesce((
   select jsonb_agg(jsonb_build_object(
     'response_id',r.id,'paper_question_id',r.paper_question_id,'is_skipped',(r.response is null),
     'time_spent_seconds',r.time_spent_seconds,'classification',c.classification,'note',c.note
   ) order by r.saved_at)
   from public.exam_responses r left join public.exam_response_self_classifications c on c.response_id=r.id
   where r.attempt_id=p_attempt_id and coalesce(r.is_correct,false)=false
 ),'[]'::jsonb));
end $$;
revoke all on function public.list_post_test_self_classification_queue_v12(uuid) from public;
grant execute on function public.list_post_test_self_classification_queue_v12(uuid) to authenticated;
