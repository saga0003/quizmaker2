-- ScholarOS Version 4
-- Image MIME repair + question paper builder + secure timed exam attempts
-- Run after 01, 03, 04, 05 and 06 migrations.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Image formats: application/octet-stream from ZIP/Windows is normalised in
-- the web app before upload. The bucket accepts recognised image MIME types.
-- ---------------------------------------------------------------------------
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/gif','image/svg+xml',
      'image/bmp','image/avif','image/x-icon','image/vnd.microsoft.icon',
      'image/tiff','image/heic','image/heif'
    ]
where id = 'question-assets';

-- ---------------------------------------------------------------------------
-- Exam types
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.paper_status as enum ('draft','published','archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.paper_access_mode as enum ('public','organization','code');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.paper_result_mode as enum ('score_only','score_and_answers','after_close','hidden');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.attempt_status as enum ('in_progress','submitted','expired');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Question papers
-- ---------------------------------------------------------------------------
create table if not exists public.question_papers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  title text not null,
  code text,
  description text,
  exam_type text not null default 'Custom',
  status public.paper_status not null default 'draft',
  duration_minutes integer not null default 60 check (duration_minutes between 1 and 1440),
  instructions text,
  access_mode public.paper_access_mode not null default 'public',
  access_code text,
  available_from timestamptz,
  available_until timestamptz,
  attempt_limit integer not null default 1 check (attempt_limit between 1 and 100),
  shuffle_questions boolean not null default false,
  shuffle_options boolean not null default false,
  result_mode public.paper_result_mode not null default 'score_only',
  total_marks numeric(10,2) not null default 0,
  total_questions integer not null default 0,
  settings jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (available_until is null or available_from is null or available_until > available_from),
  check (access_mode <> 'code' or length(trim(coalesce(access_code,''))) >= 4)
);

create unique index if not exists question_papers_org_code_unique
  on public.question_papers (coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(code))
  where code is not null;
create index if not exists question_papers_status_idx on public.question_papers(status, available_from, available_until);
create index if not exists question_papers_org_idx on public.question_papers(organization_id, status);

create table if not exists public.paper_sections (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  title text not null,
  subject_id uuid references public.subjects(id) on delete set null,
  instructions text,
  questions_to_attempt integer,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists paper_sections_paper_idx on public.paper_sections(paper_id, display_order);

create table if not exists public.paper_questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  section_id uuid not null references public.paper_sections(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  display_order integer not null default 0,
  marks numeric(8,2) not null default 4,
  negative_marks numeric(8,2) not null default 1,
  is_mandatory boolean not null default true,
  question_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(paper_id, question_id)
);
create index if not exists paper_questions_paper_idx on public.paper_questions(paper_id, section_id, display_order);

-- ---------------------------------------------------------------------------
-- Attempts and responses
-- ---------------------------------------------------------------------------
create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  attempt_number integer not null default 1,
  status public.attempt_status not null default 'in_progress',
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  question_order uuid[] not null default '{}',
  score numeric(10,2) not null default 0,
  maximum_marks numeric(10,2) not null default 0,
  percentage numeric(8,2) not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  unanswered_count integer not null default 0,
  violation_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(paper_id, student_id, attempt_number)
);
create index if not exists exam_attempts_student_idx on public.exam_attempts(student_id, created_at desc);
create index if not exists exam_attempts_paper_idx on public.exam_attempts(paper_id, status);

create table if not exists public.exam_responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  paper_question_id uuid not null references public.paper_questions(id) on delete cascade,
  response jsonb,
  marked_for_review boolean not null default false,
  visited boolean not null default true,
  time_spent_seconds integer not null default 0,
  is_correct boolean,
  marks_awarded numeric(8,2),
  saved_at timestamptz not null default now(),
  unique(attempt_id, paper_question_id)
);
create index if not exists exam_responses_attempt_idx on public.exam_responses(attempt_id);

create table if not exists public.exam_attempt_events (
  id bigint generated by default as identity primary key,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists exam_attempt_events_attempt_idx on public.exam_attempt_events(attempt_id,created_at);

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
create or replace function public.is_paper_manager(p_organization_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select case
    when p_organization_id is null then public.is_super_admin()
    else public.is_super_admin() or exists (
      select 1 from public.organization_members
      where organization_id = p_organization_id
        and user_id = auth.uid()
        and member_role in ('institute_owner','institute_admin','teacher')
        and is_active = true
    )
  end;
$$;
grant execute on function public.is_paper_manager(uuid) to authenticated;

create or replace function public.current_user_is_academic_staff()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('institute_owner','institute_admin','teacher','reviewer','invigilator','super_admin')
  );
$$;
grant execute on function public.current_user_is_academic_staff() to authenticated;

-- Students must never be able to query correct answers directly from the bank.
drop policy if exists questions_read on public.questions;
create policy questions_read on public.questions for select to authenticated
using (
  public.is_super_admin()
  or created_by = auth.uid()
  or (organization_id is not null and public.is_org_question_manager(organization_id))
  or (organization_id is null and status = 'approved' and public.current_user_is_academic_staff())
);

drop policy if exists options_read on public.question_options;
create policy options_read on public.question_options for select to authenticated
using (
  exists (
    select 1 from public.questions q
    where q.id = question_id and (
      public.is_super_admin()
      or q.created_by = auth.uid()
      or (q.organization_id is not null and public.is_org_question_manager(q.organization_id))
      or (q.organization_id is null and q.status = 'approved' and public.current_user_is_academic_staff())
    )
  )
);

-- ---------------------------------------------------------------------------
-- Save a paper, sections and immutable question snapshots in one transaction.
-- ---------------------------------------------------------------------------
create or replace function public.save_question_paper(
  p_paper_id uuid,
  p_organization_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_paper uuid;
  v_status public.paper_status := coalesce((p_payload->>'status')::public.paper_status, 'draft');
  v_section jsonb;
  v_item jsonb;
  v_section_id uuid;
  v_section_map jsonb := '{}'::jsonb;
  v_question public.questions%rowtype;
  v_snapshot jsonb;
  v_options jsonb;
  v_total numeric(10,2) := 0;
  v_count integer := 0;
  v_code text := nullif(upper(trim(p_payload->>'code')), '');
begin
  if v_user is null then raise exception 'Login required.'; end if;
  if not public.is_paper_manager(p_organization_id) then raise exception 'Paper-builder permission required.'; end if;
  if length(trim(coalesce(p_payload->>'title',''))) < 3 then raise exception 'Paper title is required.'; end if;
  if jsonb_array_length(coalesce(p_payload->'sections','[]'::jsonb)) < 1 then raise exception 'Create at least one section.'; end if;
  if jsonb_array_length(coalesce(p_payload->'questions','[]'::jsonb)) < 1 then raise exception 'Add at least one question.'; end if;
  if coalesce((p_payload->>'duration_minutes')::integer,0) < 1 then raise exception 'Duration must be at least one minute.'; end if;
  if coalesce((p_payload->>'access_mode')::public.paper_access_mode,'public') = 'code'
     and length(trim(coalesce(p_payload->>'access_code',''))) < 4 then
    raise exception 'Access code must contain at least four characters.';
  end if;

  if p_paper_id is null then
    insert into public.question_papers(
      organization_id,created_by,updated_by,title,code,description,exam_type,status,
      duration_minutes,instructions,access_mode,access_code,available_from,available_until,
      attempt_limit,shuffle_questions,shuffle_options,result_mode,published_at
    ) values (
      p_organization_id,v_user,v_user,trim(p_payload->>'title'),v_code,nullif(p_payload->>'description',''),
      coalesce(nullif(p_payload->>'exam_type',''),'Custom'),v_status,
      coalesce((p_payload->>'duration_minutes')::integer,60),nullif(p_payload->>'instructions',''),
      coalesce((p_payload->>'access_mode')::public.paper_access_mode,'public'),nullif(trim(p_payload->>'access_code'),''),
      nullif(p_payload->>'available_from','')::timestamptz,nullif(p_payload->>'available_until','')::timestamptz,
      coalesce((p_payload->>'attempt_limit')::integer,1),coalesce((p_payload->>'shuffle_questions')::boolean,false),
      coalesce((p_payload->>'shuffle_options')::boolean,false),coalesce((p_payload->>'result_mode')::public.paper_result_mode,'score_only'),
      case when v_status='published' then now() else null end
    ) returning id into v_paper;
  else
    select id into v_paper from public.question_papers
      where id=p_paper_id and public.is_paper_manager(organization_id) for update;
    if v_paper is null then raise exception 'Paper not found or permission denied.'; end if;
    if exists(select 1 from public.exam_attempts where paper_id=v_paper) then
      raise exception 'This paper already has student attempts. Create a new paper instead of changing its questions.';
    end if;
    update public.question_papers set
      title=trim(p_payload->>'title'),code=v_code,description=nullif(p_payload->>'description',''),
      exam_type=coalesce(nullif(p_payload->>'exam_type',''),'Custom'),status=v_status,
      duration_minutes=coalesce((p_payload->>'duration_minutes')::integer,60),instructions=nullif(p_payload->>'instructions',''),
      access_mode=coalesce((p_payload->>'access_mode')::public.paper_access_mode,'public'),
      access_code=nullif(trim(p_payload->>'access_code'),''),available_from=nullif(p_payload->>'available_from','')::timestamptz,
      available_until=nullif(p_payload->>'available_until','')::timestamptz,attempt_limit=coalesce((p_payload->>'attempt_limit')::integer,1),
      shuffle_questions=coalesce((p_payload->>'shuffle_questions')::boolean,false),shuffle_options=coalesce((p_payload->>'shuffle_options')::boolean,false),
      result_mode=coalesce((p_payload->>'result_mode')::public.paper_result_mode,'score_only'),updated_by=v_user,updated_at=now(),
      published_at=case when v_status='published' then coalesce(published_at,now()) else published_at end
    where id=v_paper;
    delete from public.paper_sections where paper_id=v_paper;
  end if;

  for v_section in select * from jsonb_array_elements(p_payload->'sections')
  loop
    insert into public.paper_sections(paper_id,title,subject_id,instructions,questions_to_attempt,display_order)
    values(
      v_paper,trim(v_section->>'title'),nullif(v_section->>'subject_id','')::uuid,
      nullif(v_section->>'instructions',''),nullif(v_section->>'questions_to_attempt','')::integer,
      coalesce((v_section->>'display_order')::integer,0)
    ) returning id into v_section_id;
    v_section_map := v_section_map || jsonb_build_object(v_section->>'client_id',v_section_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_payload->'questions')
  loop
    select * into v_question from public.questions where id=(v_item->>'question_id')::uuid;
    if not found then raise exception 'A selected question no longer exists.'; end if;
    if v_question.status <> 'approved' then raise exception 'Only approved questions can be added to a paper.'; end if;
    if not (
      public.is_super_admin()
      or (v_question.organization_id is null and public.current_user_is_academic_staff())
      or (v_question.organization_id is not null and public.is_org_question_manager(v_question.organization_id))
    ) then raise exception 'You do not have access to one of the selected questions.'; end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'option_key',o.option_key,'content_text',o.content_text,'content_latex',o.content_latex,
      'image_url',o.image_url,'is_correct',o.is_correct,'display_order',o.display_order
    ) order by o.display_order),'[]'::jsonb)
    into v_options from public.question_options o where o.question_id=v_question.id;

    v_snapshot := jsonb_build_object(
      'id',v_question.id,'stem_text',v_question.stem_text,'stem_latex',v_question.stem_latex,
      'question_image_url',v_question.question_image_url,'passage_text',v_question.passage_text,
      'question_type',v_question.question_type,'difficulty',v_question.difficulty,
      'correct_answer',v_question.correct_answer,'solution_text',v_question.solution_text,
      'solution_latex',v_question.solution_latex,'subject_id',v_question.subject_id,
      'chapter_id',v_question.chapter_id,'version_number',v_question.version_number,
      'options',v_options
    );

    v_section_id := nullif(v_section_map->>(v_item->>'section_client_id'),'')::uuid;
    if v_section_id is null then raise exception 'A question is assigned to a missing section.'; end if;

    insert into public.paper_questions(paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot)
    values(
      v_paper,v_section_id,v_question.id,coalesce((v_item->>'display_order')::integer,0),
      coalesce((v_item->>'marks')::numeric,v_question.marks),coalesce((v_item->>'negative_marks')::numeric,v_question.negative_marks),
      coalesce((v_item->>'is_mandatory')::boolean,true),v_snapshot
    );
    v_total := v_total + coalesce((v_item->>'marks')::numeric,v_question.marks);
    v_count := v_count + 1;
  end loop;

  update public.question_papers set total_marks=v_total,total_questions=v_count,updated_at=now(),updated_by=v_user where id=v_paper;
  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(v_user,p_organization_id,case when p_paper_id is null then 'paper.created' else 'paper.updated' end,
    'question_paper',v_paper::text,jsonb_build_object('status',v_status,'questions',v_count,'marks',v_total));
  return v_paper;
end;
$$;
grant execute on function public.save_question_paper(uuid,uuid,jsonb) to authenticated;

create or replace function public.set_question_paper_status(p_paper_id uuid,p_status public.paper_status)
returns void
language plpgsql
security definer set search_path = public
as $$
declare v_org uuid; v_count integer;
begin
  select organization_id,total_questions into v_org,v_count from public.question_papers where id=p_paper_id;
  if not found or not public.is_paper_manager(v_org) then raise exception 'Paper not found or permission denied.'; end if;
  if p_status='published' and v_count<1 then raise exception 'Add questions before publishing.'; end if;
  update public.question_papers set status=p_status,updated_by=auth.uid(),updated_at=now(),
    published_at=case when p_status='published' then coalesce(published_at,now()) else published_at end
  where id=p_paper_id;
end;
$$;
grant execute on function public.set_question_paper_status(uuid,public.paper_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Student access and secure exam payload
-- ---------------------------------------------------------------------------
create or replace function public.list_available_papers()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'title',p.title,'description',p.description,'exam_type',p.exam_type,
    'duration_minutes',p.duration_minutes,'total_marks',p.total_marks,'total_questions',p.total_questions,
    'available_from',p.available_from,'available_until',p.available_until,'attempt_limit',p.attempt_limit,
    'attempts_used',(select count(*) from public.exam_attempts a where a.paper_id=p.id and a.student_id=auth.uid()),
    'result_mode',p.result_mode,'access_mode',p.access_mode
  ) order by p.available_from nulls first,p.created_at desc),'[]'::jsonb)
  from public.question_papers p
  where auth.uid() is not null
    and p.status='published'
    and (p.available_from is null or p.available_from<=now())
    and (p.available_until is null or p.available_until>=now())
    and (
      p.access_mode='public'
      or (p.access_mode='organization' and p.organization_id is not null and public.is_org_member(p.organization_id))
    );
$$;
grant execute on function public.list_available_papers() to authenticated;

create or replace function public.find_paper_by_code(p_code text)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select jsonb_build_object(
    'id',p.id,'title',p.title,'description',p.description,'exam_type',p.exam_type,
    'duration_minutes',p.duration_minutes,'total_marks',p.total_marks,'total_questions',p.total_questions,
    'available_from',p.available_from,'available_until',p.available_until,'attempt_limit',p.attempt_limit,
    'attempts_used',(select count(*) from public.exam_attempts a where a.paper_id=p.id and a.student_id=auth.uid()),
    'result_mode',p.result_mode,'access_mode',p.access_mode
  ) from public.question_papers p
  where auth.uid() is not null and p.status='published' and p.access_mode='code'
    and upper(trim(p.access_code))=upper(trim(p_code))
    and (p.available_from is null or p.available_from<=now())
    and (p.available_until is null or p.available_until>=now())
  limit 1),'null'::jsonb);
$$;
grant execute on function public.find_paper_by_code(text) to authenticated;

create or replace function public.start_exam_attempt(p_paper_id uuid,p_access_code text default null)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_paper public.question_papers%rowtype;
  v_existing uuid;
  v_attempt uuid;
  v_number integer;
  v_order uuid[];
  v_expiry timestamptz;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  select * into v_paper from public.question_papers where id=p_paper_id and status='published';
  if not found then raise exception 'This test is not available.'; end if;
  if v_paper.available_from is not null and now()<v_paper.available_from then raise exception 'This test has not opened yet.'; end if;
  if v_paper.available_until is not null and now()>v_paper.available_until then raise exception 'This test has closed.'; end if;
  if v_paper.access_mode='organization' and (v_paper.organization_id is null or not public.is_org_member(v_paper.organization_id)) then
    raise exception 'This test is restricted to school members.';
  end if;
  if v_paper.access_mode='code' and upper(trim(coalesce(p_access_code,'')))<>upper(trim(coalesce(v_paper.access_code,''))) then
    raise exception 'Invalid test access code.';
  end if;

  select id into v_existing from public.exam_attempts
    where paper_id=p_paper_id and student_id=v_user and status='in_progress' and expires_at>now()
    order by started_at desc limit 1;
  if v_existing is not null then return v_existing; end if;
  update public.exam_attempts set status='expired' where paper_id=p_paper_id and student_id=v_user and status='in_progress' and expires_at<=now();

  select count(*)+1 into v_number from public.exam_attempts where paper_id=p_paper_id and student_id=v_user;
  if v_number>v_paper.attempt_limit then raise exception 'You have used all attempts for this test.'; end if;

  if v_paper.shuffle_questions then
    select array_agg(id order by random()) into v_order from public.paper_questions where paper_id=p_paper_id;
  else
    select array_agg(id order by display_order,id) into v_order from public.paper_questions where paper_id=p_paper_id;
  end if;
  v_expiry := now() + make_interval(mins=>v_paper.duration_minutes);
  if v_paper.available_until is not null then v_expiry := least(v_expiry,v_paper.available_until); end if;

  insert into public.exam_attempts(paper_id,student_id,organization_id,attempt_number,status,expires_at,question_order,maximum_marks,unanswered_count)
  values(p_paper_id,v_user,v_paper.organization_id,v_number,'in_progress',v_expiry,coalesce(v_order,'{}'),v_paper.total_marks,v_paper.total_questions)
  returning id into v_attempt;
  return v_attempt;
end;
$$;
grant execute on function public.start_exam_attempt(uuid,text) to authenticated;

create or replace function public.get_exam_attempt_payload(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare v_attempt public.exam_attempts%rowtype; v_paper public.question_papers%rowtype; v_sections jsonb; v_questions jsonb; v_responses jsonb;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id and student_id=auth.uid();
  if not found then raise exception 'Attempt not found.'; end if;
  if v_attempt.status='in_progress' and v_attempt.expires_at<=now() then
    update public.exam_attempts set status='expired' where id=v_attempt.id;
    v_attempt.status:='expired';
  end if;
  select * into v_paper from public.question_papers where id=v_attempt.paper_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'title',s.title,'instructions',s.instructions,'questions_to_attempt',s.questions_to_attempt,'display_order',s.display_order
  ) order by s.display_order),'[]'::jsonb) into v_sections
  from public.paper_sections s where s.paper_id=v_paper.id;

  select coalesce(jsonb_agg(
    (pq.question_snapshot - 'correct_answer' - 'solution_text' - 'solution_latex')
    || jsonb_build_object(
      'paper_question_id',pq.id,'section_id',pq.section_id,'display_order',pq.display_order,
      'marks',pq.marks,'negative_marks',pq.negative_marks,'is_mandatory',pq.is_mandatory,
      'options',coalesce((select jsonb_agg(opt - 'is_correct' order by coalesce((opt->>'display_order')::integer,0))
        from jsonb_array_elements(coalesce(pq.question_snapshot->'options','[]'::jsonb)) opt),'[]'::jsonb)
    ) order by array_position(v_attempt.question_order,pq.id)
  ),'[]'::jsonb) into v_questions
  from public.paper_questions pq where pq.paper_id=v_paper.id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'paper_question_id',r.paper_question_id,'response',r.response,'marked_for_review',r.marked_for_review,'visited',r.visited
  )),'[]'::jsonb) into v_responses from public.exam_responses r where r.attempt_id=v_attempt.id;

  return jsonb_build_object(
    'attempt_id',v_attempt.id,'status',v_attempt.status,'started_at',v_attempt.started_at,'expires_at',v_attempt.expires_at,
    'paper',jsonb_build_object('id',v_paper.id,'title',v_paper.title,'description',v_paper.description,'exam_type',v_paper.exam_type,
      'duration_minutes',v_paper.duration_minutes,'total_marks',v_paper.total_marks,'total_questions',v_paper.total_questions,
      'instructions',v_paper.instructions,'shuffle_options',v_paper.shuffle_options,'result_mode',v_paper.result_mode),
    'sections',v_sections,'questions',v_questions,'responses',v_responses
  );
end;
$$;
grant execute on function public.get_exam_attempt_payload(uuid) to authenticated;

create or replace function public.save_exam_response(
  p_attempt_id uuid,p_paper_question_id uuid,p_response jsonb,p_marked_for_review boolean default false,p_time_spent_seconds integer default 0
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare v_status public.attempt_status; v_expiry timestamptz;
begin
  select status,expires_at into v_status,v_expiry from public.exam_attempts where id=p_attempt_id and student_id=auth.uid();
  if not found then raise exception 'Attempt not found.'; end if;
  if v_status<>'in_progress' or v_expiry<=now() then raise exception 'This attempt is no longer active.'; end if;
  if not exists(select 1 from public.paper_questions pq join public.exam_attempts a on a.paper_id=pq.paper_id where a.id=p_attempt_id and pq.id=p_paper_question_id) then
    raise exception 'Question does not belong to this attempt.';
  end if;
  insert into public.exam_responses(attempt_id,paper_question_id,response,marked_for_review,visited,time_spent_seconds,saved_at)
  values(p_attempt_id,p_paper_question_id,p_response,p_marked_for_review,true,greatest(p_time_spent_seconds,0),now())
  on conflict(attempt_id,paper_question_id) do update set response=excluded.response,marked_for_review=excluded.marked_for_review,
    visited=true,time_spent_seconds=greatest(public.exam_responses.time_spent_seconds,excluded.time_spent_seconds),saved_at=now();
end;
$$;
grant execute on function public.save_exam_response(uuid,uuid,jsonb,boolean,integer) to authenticated;


create or replace function public.record_exam_event(p_attempt_id uuid,p_event_type text,p_metadata jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists(select 1 from public.exam_attempts where id=p_attempt_id and student_id=auth.uid() and status='in_progress') then
    raise exception 'Active attempt not found.';
  end if;
  insert into public.exam_attempt_events(attempt_id,event_type,metadata)
  values(p_attempt_id,left(trim(p_event_type),80),coalesce(p_metadata,'{}'::jsonb));
  if p_event_type in ('tab_hidden','fullscreen_exit','window_blur') then
    update public.exam_attempts set violation_count=violation_count+1 where id=p_attempt_id;
  end if;
end;
$$;
grant execute on function public.record_exam_event(uuid,text,jsonb) to authenticated;

create or replace function public.answer_matches(p_expected jsonb,p_response jsonb,p_type public.question_type)
returns boolean
language plpgsql
immutable
as $$
declare v_expected text[]; v_response text[]; v_en numeric; v_rn numeric;
begin
  if p_response is null or p_response='null'::jsonb then return false; end if;
  if p_type in ('numerical','integer') then
    begin
      v_en := trim(both '"' from p_expected::text)::numeric;
      v_rn := trim(both '"' from p_response::text)::numeric;
      return abs(v_en-v_rn) < 0.000001;
    exception when others then return lower(trim(both '"' from p_expected::text))=lower(trim(both '"' from p_response::text));
    end;
  end if;
  select array_agg(upper(trim(value)) order by upper(trim(value))) into v_expected
    from jsonb_array_elements_text(case when jsonb_typeof(p_expected)='array' then p_expected else jsonb_build_array(p_expected) end);
  select array_agg(upper(trim(value)) order by upper(trim(value))) into v_response
    from jsonb_array_elements_text(case when jsonb_typeof(p_response)='array' then p_response else jsonb_build_array(p_response) end);
  return coalesce(v_expected,'{}')=coalesce(v_response,'{}');
end;
$$;

create or replace function public.submit_exam_attempt(p_attempt_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_attempt public.exam_attempts%rowtype; v_item record; v_response jsonb; v_correct boolean;
  v_score numeric(10,2):=0; v_correct_count integer:=0; v_incorrect integer:=0; v_unanswered integer:=0;
  v_percentage numeric(8,2):=0;
begin
  select * into v_attempt from public.exam_attempts where id=p_attempt_id and student_id=auth.uid() for update;
  if not found then raise exception 'Attempt not found.'; end if;
  if v_attempt.status='submitted' then
    return jsonb_build_object('attempt_id',v_attempt.id,'score',v_attempt.score,'maximum_marks',v_attempt.maximum_marks,
      'percentage',v_attempt.percentage,'correct_count',v_attempt.correct_count,'incorrect_count',v_attempt.incorrect_count,
      'unanswered_count',v_attempt.unanswered_count);
  end if;

  for v_item in
    select pq.id,pq.marks,pq.negative_marks,(pq.question_snapshot->>'question_type')::public.question_type as question_type,
      pq.question_snapshot->'correct_answer' as expected,r.response
    from public.paper_questions pq
    left join public.exam_responses r on r.paper_question_id=pq.id and r.attempt_id=v_attempt.id
    where pq.paper_id=v_attempt.paper_id
  loop
    v_response:=v_item.response;
    if v_response is null or v_response='null'::jsonb or v_response='[]'::jsonb or v_response='""'::jsonb then
      v_unanswered:=v_unanswered+1;
      update public.exam_responses set is_correct=null,marks_awarded=0 where attempt_id=v_attempt.id and paper_question_id=v_item.id;
    else
      v_correct:=public.answer_matches(v_item.expected,v_response,v_item.question_type);
      if v_correct then
        v_correct_count:=v_correct_count+1; v_score:=v_score+v_item.marks;
      else
        v_incorrect:=v_incorrect+1; v_score:=v_score-v_item.negative_marks;
      end if;
      update public.exam_responses set is_correct=v_correct,marks_awarded=case when v_correct then v_item.marks else -v_item.negative_marks end
      where attempt_id=v_attempt.id and paper_question_id=v_item.id;
    end if;
  end loop;
  if v_attempt.maximum_marks>0 then v_percentage:=round((v_score/v_attempt.maximum_marks)*100,2); end if;
  update public.exam_attempts set status='submitted',submitted_at=now(),score=v_score,percentage=v_percentage,
    correct_count=v_correct_count,incorrect_count=v_incorrect,unanswered_count=v_unanswered
  where id=v_attempt.id;
  return jsonb_build_object('attempt_id',v_attempt.id,'score',v_score,'maximum_marks',v_attempt.maximum_marks,
    'percentage',v_percentage,'correct_count',v_correct_count,'incorrect_count',v_incorrect,'unanswered_count',v_unanswered);
end;
$$;
grant execute on function public.submit_exam_attempt(uuid) to authenticated;

create or replace function public.list_my_attempt_results()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'attempt_id',a.id,'paper_id',a.paper_id,'paper_title',p.title,'status',a.status,
    'score',a.score,'maximum_marks',a.maximum_marks,'percentage',a.percentage,
    'correct_count',a.correct_count,'incorrect_count',a.incorrect_count,'unanswered_count',a.unanswered_count,
    'started_at',a.started_at,'submitted_at',a.submitted_at,'result_mode',p.result_mode
  ) order by a.created_at desc),'[]'::jsonb)
  from public.exam_attempts a join public.question_papers p on p.id=a.paper_id
  where a.student_id=auth.uid();
$$;
grant execute on function public.list_my_attempt_results() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.question_papers enable row level security;
alter table public.paper_sections enable row level security;
alter table public.paper_questions enable row level security;
alter table public.exam_attempts enable row level security;
alter table public.exam_responses enable row level security;

drop policy if exists papers_read on public.question_papers;
create policy papers_read on public.question_papers for select to authenticated
using (
  public.is_paper_manager(organization_id)
  or (status='published' and access_mode='public')
  or (status='published' and access_mode='organization' and organization_id is not null and public.is_org_member(organization_id))
);
drop policy if exists papers_manage on public.question_papers;
create policy papers_manage on public.question_papers for all to authenticated
using(public.is_paper_manager(organization_id))
with check(public.is_paper_manager(organization_id));

drop policy if exists paper_sections_read on public.paper_sections;
create policy paper_sections_read on public.paper_sections for select to authenticated
using(exists(select 1 from public.question_papers p where p.id=paper_id and public.is_paper_manager(p.organization_id)));
drop policy if exists paper_sections_manage on public.paper_sections;
create policy paper_sections_manage on public.paper_sections for all to authenticated
using(exists(select 1 from public.question_papers p where p.id=paper_id and public.is_paper_manager(p.organization_id)))
with check(exists(select 1 from public.question_papers p where p.id=paper_id and public.is_paper_manager(p.organization_id)));

drop policy if exists paper_questions_read on public.paper_questions;
create policy paper_questions_read on public.paper_questions for select to authenticated
using(exists(select 1 from public.question_papers p where p.id=paper_id and public.is_paper_manager(p.organization_id)));
drop policy if exists paper_questions_manage on public.paper_questions;
create policy paper_questions_manage on public.paper_questions for all to authenticated
using(exists(select 1 from public.question_papers p where p.id=paper_id and public.is_paper_manager(p.organization_id)))
with check(exists(select 1 from public.question_papers p where p.id=paper_id and public.is_paper_manager(p.organization_id)));

drop policy if exists attempts_read on public.exam_attempts;
create policy attempts_read on public.exam_attempts for select to authenticated
using(student_id=auth.uid() or exists(select 1 from public.question_papers p where p.id=paper_id and public.is_paper_manager(p.organization_id)));

drop policy if exists responses_read on public.exam_responses;
create policy responses_read on public.exam_responses for select to authenticated
using(exists(select 1 from public.exam_attempts a where a.id=attempt_id and (
  a.student_id=auth.uid() or exists(select 1 from public.question_papers p where p.id=a.paper_id and public.is_paper_manager(p.organization_id))
)));

-- Writes to attempts/responses are deliberately performed only through RPCs.


alter table public.exam_attempt_events enable row level security;

drop policy if exists attempt_events_read on public.exam_attempt_events;
create policy attempt_events_read on public.exam_attempt_events for select to authenticated
using(exists(select 1 from public.exam_attempts a where a.id=attempt_id and (
  a.student_id=auth.uid() or exists(select 1 from public.question_papers p where p.id=a.paper_id and public.is_paper_manager(p.organization_id))
)));

drop trigger if exists question_papers_set_updated_at on public.question_papers;
create trigger question_papers_set_updated_at before update on public.question_papers
for each row execute function public.set_updated_at();
