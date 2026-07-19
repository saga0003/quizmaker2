-- ScholarOS - Version 3 question bank, usernames and bulk imports
-- Run AFTER the Version 1 and Version 2 SQL files.

create extension if not exists citext;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Simple registration: unique username + email/password, no manual verification
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists username citext;
create unique index if not exists profiles_username_unique
  on public.profiles (lower(username::text)) where username is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_username text;
begin
  v_username := nullif(trim(coalesce(new.raw_user_meta_data ->> 'username', '')), '');
  if v_username is null then
    v_username := split_part(coalesce(new.email, new.id::text), '@', 1)
      || '_' || substr(replace(new.id::text, '-', ''), 1, 5);
  end if;

  insert into public.profiles (id, full_name, username, role)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1)),
    v_username,
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace function public.is_username_available(p_username text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select length(trim(coalesce(p_username, ''))) between 3 and 30
    and trim(p_username) ~ '^[A-Za-z0-9._-]+$'
    and not exists (
      select 1 from public.profiles
      where lower(username::text) = lower(trim(p_username))
    );
$$;
grant execute on function public.is_username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.question_status as enum ('draft','in_review','approved','rejected','archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.question_type as enum (
    'single_correct','multiple_correct','numerical','integer',
    'assertion_reason','match_following','passage','image_based'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.question_difficulty as enum ('very_easy','easy','moderate','difficult','very_difficult');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.import_status as enum ('validating','ready','importing','completed','failed');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Taxonomy
-- ---------------------------------------------------------------------------
create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  exam_types text[] not null default '{}',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, code)
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete cascade,
  code text,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, subject_id, name)
);

create table if not exists public.topics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  name text not null,
  display_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique nulls not distinct (organization_id, chapter_id, name)
);

-- ---------------------------------------------------------------------------
-- Questions
-- ---------------------------------------------------------------------------
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete set null,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  question_type public.question_type not null default 'single_correct',
  status public.question_status not null default 'draft',
  difficulty public.question_difficulty not null default 'moderate',
  stem_text text not null,
  stem_latex text,
  question_image_url text,
  passage_text text,
  solution_text text,
  solution_latex text,
  marks numeric(8,2) not null default 4,
  negative_marks numeric(8,2) not null default 1,
  estimated_seconds integer,
  correct_answer jsonb not null default '[]'::jsonb,
  exam_types text[] not null default '{}',
  class_level text,
  source text,
  source_year integer,
  language text not null default 'English',
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  duplicate_hash text,
  version_number integer not null default 1,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists questions_org_status_idx on public.questions(organization_id, status);
create index if not exists questions_subject_idx on public.questions(subject_id);
create index if not exists questions_created_by_idx on public.questions(created_by);
create index if not exists questions_hash_idx on public.questions(duplicate_hash) where duplicate_hash is not null;
create index if not exists questions_tags_gin on public.questions using gin(tags);
create index if not exists questions_exam_types_gin on public.questions using gin(exam_types);

create table if not exists public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  option_key text not null,
  content_text text,
  content_latex text,
  image_url text,
  is_correct boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique(question_id, option_key)
);

create table if not exists public.question_reviews (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('approved','rejected','changes_requested','comment')),
  comment text,
  created_at timestamptz not null default now()
);

create table if not exists public.question_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  original_filename text not null,
  import_format text not null check(import_format in ('csv','xlsx','manual_batch')),
  status public.import_status not null default 'validating',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  imported_rows integer not null default 0,
  error_report jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  version_number integer not null,
  snapshot jsonb not null,
  changed_by uuid references public.profiles(id) on delete set null,
  change_note text,
  created_at timestamptz not null default now(),
  unique(question_id, version_number)
);

-- ---------------------------------------------------------------------------
-- Helpers and permissions
-- ---------------------------------------------------------------------------
create or replace function public.is_org_question_manager(p_organization_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and member_role in ('institute_owner','institute_admin','teacher','reviewer')
      and is_active = true
  );
$$;
grant execute on function public.is_org_question_manager(uuid) to authenticated;

create or replace function public.can_review_org_question(p_organization_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and member_role in ('institute_owner','institute_admin','reviewer')
      and is_active = true
  );
$$;
grant execute on function public.can_review_org_question(uuid) to authenticated;

create or replace function public.question_duplicate_hash(p_stem text, p_options jsonb)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(
    lower(regexp_replace(coalesce(p_stem,''), '\s+', '', 'g')) || '|' ||
    lower(regexp_replace(coalesce(p_options::text,''), '\s+', '', 'g')),
    'sha256'
  ), 'hex');
$$;

-- One RPC used by the manual editor and bulk importer.
create or replace function public.save_question(
  p_question_id uuid,
  p_organization_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_question uuid;
  v_existing public.questions%rowtype;
  v_options jsonb := coalesce(p_payload -> 'options', '[]'::jsonb);
  v_status public.question_status := coalesce((p_payload ->> 'status')::public.question_status, 'draft');
  v_hash text;
  v_next_version integer;
  v_opt jsonb;
  v_answer jsonb := coalesce(p_payload -> 'correct_answer', '[]'::jsonb);
begin
  if v_user is null then raise exception 'Login required.'; end if;
  if p_organization_id is null then
    if not public.is_super_admin() then raise exception 'Only super admin can create ScholarOS master questions.'; end if;
  elsif not public.is_org_question_manager(p_organization_id) then
    raise exception 'Question-bank permission required.';
  end if;

  if length(trim(coalesce(p_payload ->> 'stem_text',''))) < 5 then
    raise exception 'Question text must contain at least 5 characters.';
  end if;

  if jsonb_array_length(v_options) < 2 and coalesce(p_payload ->> 'question_type','single_correct') in ('single_correct','multiple_correct','assertion_reason','image_based') then
    raise exception 'At least two options are required.';
  end if;

  if not public.is_super_admin() and not public.can_review_org_question(p_organization_id) and v_status in ('approved','rejected','archived') then
    v_status := 'draft';
  end if;

  v_hash := public.question_duplicate_hash(p_payload ->> 'stem_text', v_options);

  if p_question_id is null then
    insert into public.questions(
      organization_id,created_by,updated_by,subject_id,chapter_id,topic_id,
      question_type,status,difficulty,stem_text,stem_latex,question_image_url,
      passage_text,solution_text,solution_latex,marks,negative_marks,
      estimated_seconds,correct_answer,exam_types,class_level,source,source_year,
      language,tags,metadata,duplicate_hash,approved_at
    ) values (
      p_organization_id,v_user,v_user,
      nullif(p_payload ->> 'subject_id','')::uuid,
      nullif(p_payload ->> 'chapter_id','')::uuid,
      nullif(p_payload ->> 'topic_id','')::uuid,
      coalesce((p_payload ->> 'question_type')::public.question_type,'single_correct'),
      v_status,
      coalesce((p_payload ->> 'difficulty')::public.question_difficulty,'moderate'),
      trim(p_payload ->> 'stem_text'),nullif(p_payload ->> 'stem_latex',''),
      nullif(p_payload ->> 'question_image_url',''),nullif(p_payload ->> 'passage_text',''),
      nullif(p_payload ->> 'solution_text',''),nullif(p_payload ->> 'solution_latex',''),
      coalesce((p_payload ->> 'marks')::numeric,4),coalesce((p_payload ->> 'negative_marks')::numeric,1),
      nullif(p_payload ->> 'estimated_seconds','')::integer,v_answer,
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'exam_types','[]'::jsonb))),'{}'),
      nullif(p_payload ->> 'class_level',''),nullif(p_payload ->> 'source',''),
      nullif(p_payload ->> 'source_year','')::integer,coalesce(nullif(p_payload ->> 'language',''),'English'),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'tags','[]'::jsonb))),'{}'),
      coalesce(p_payload -> 'metadata','{}'::jsonb),v_hash,
      case when v_status='approved' then now() else null end
    ) returning id into v_question;
    v_next_version := 1;
  else
    select * into v_existing from public.questions where id=p_question_id for update;
    if not found then raise exception 'Question not found.'; end if;
    if v_existing.organization_id is null then
      if not public.is_super_admin() then raise exception 'Only super admin can edit ScholarOS master questions.'; end if;
    elsif not public.is_org_question_manager(v_existing.organization_id) then
      raise exception 'Question-bank permission required.';
    end if;

    v_next_version := v_existing.version_number + 1;
    insert into public.question_versions(question_id,version_number,snapshot,changed_by,change_note)
    values(v_existing.id,v_existing.version_number,to_jsonb(v_existing),v_user,p_payload ->> 'change_note')
    on conflict do nothing;

    update public.questions set
      subject_id=nullif(p_payload ->> 'subject_id','')::uuid,
      chapter_id=nullif(p_payload ->> 'chapter_id','')::uuid,
      topic_id=nullif(p_payload ->> 'topic_id','')::uuid,
      question_type=coalesce((p_payload ->> 'question_type')::public.question_type,question_type),
      status=v_status,
      difficulty=coalesce((p_payload ->> 'difficulty')::public.question_difficulty,difficulty),
      stem_text=trim(p_payload ->> 'stem_text'),stem_latex=nullif(p_payload ->> 'stem_latex',''),
      question_image_url=nullif(p_payload ->> 'question_image_url',''),passage_text=nullif(p_payload ->> 'passage_text',''),
      solution_text=nullif(p_payload ->> 'solution_text',''),solution_latex=nullif(p_payload ->> 'solution_latex',''),
      marks=coalesce((p_payload ->> 'marks')::numeric,marks),negative_marks=coalesce((p_payload ->> 'negative_marks')::numeric,negative_marks),
      estimated_seconds=nullif(p_payload ->> 'estimated_seconds','')::integer,correct_answer=v_answer,
      exam_types=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'exam_types','[]'::jsonb))),'{}'),
      class_level=nullif(p_payload ->> 'class_level',''),source=nullif(p_payload ->> 'source',''),
      source_year=nullif(p_payload ->> 'source_year','')::integer,language=coalesce(nullif(p_payload ->> 'language',''),'English'),
      tags=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload -> 'tags','[]'::jsonb))),'{}'),
      metadata=coalesce(p_payload -> 'metadata','{}'::jsonb),duplicate_hash=v_hash,
      version_number=v_next_version,updated_by=v_user,updated_at=now(),
      approved_at=case when v_status='approved' then coalesce(approved_at,now()) else null end
    where id=p_question_id returning id into v_question;

    delete from public.question_options where question_id=v_question;
  end if;

  for v_opt in select * from jsonb_array_elements(v_options)
  loop
    insert into public.question_options(question_id,option_key,content_text,content_latex,image_url,is_correct,display_order)
    values(
      v_question,upper(trim(v_opt ->> 'option_key')),nullif(v_opt ->> 'content_text',''),
      nullif(v_opt ->> 'content_latex',''),nullif(v_opt ->> 'image_url',''),
      coalesce((v_opt ->> 'is_correct')::boolean,false),coalesce((v_opt ->> 'display_order')::integer,0)
    );
  end loop;

  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(v_user,p_organization_id,case when p_question_id is null then 'question.created' else 'question.updated' end,
    'question',v_question::text,jsonb_build_object('status',v_status,'version',v_next_version));

  return v_question;
end;
$$;
grant execute on function public.save_question(uuid,uuid,jsonb) to authenticated;

create or replace function public.review_question(
  p_question_id uuid,
  p_decision text,
  p_comment text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_status public.question_status;
begin
  select organization_id into v_org from public.questions where id=p_question_id;
  if not found then raise exception 'Question not found.'; end if;
  if v_org is null then
    if not public.is_super_admin() then raise exception 'Super admin required.'; end if;
  elsif not public.can_review_org_question(v_org) then
    raise exception 'Reviewer permission required.';
  end if;

  if p_decision='approved' then v_status:='approved';
  elsif p_decision in ('rejected','changes_requested') then v_status:='rejected';
  else v_status:=null; end if;

  insert into public.question_reviews(question_id,reviewer_id,decision,comment)
  values(p_question_id,v_user,p_decision,p_comment);

  if v_status is not null then
    update public.questions set status=v_status,updated_by=v_user,updated_at=now(),
      approved_at=case when v_status='approved' then now() else null end
    where id=p_question_id;
  end if;
end;
$$;
grant execute on function public.review_question(uuid,text,text) to authenticated;

create or replace function public.bulk_import_questions(
  p_organization_id uuid,
  p_filename text,
  p_format text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_import uuid;
  v_row jsonb;
  v_total integer := jsonb_array_length(coalesce(p_rows,'[]'::jsonb));
  v_imported integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_id uuid;
  v_index integer := 0;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  if p_organization_id is null then
    if not public.is_super_admin() then raise exception 'Super admin required for master imports.'; end if;
  elsif not public.is_org_question_manager(p_organization_id) then
    raise exception 'Question-bank permission required.';
  end if;

  insert into public.question_imports(organization_id,created_by,original_filename,import_format,status,total_rows,valid_rows)
  values(p_organization_id,v_user,p_filename,p_format,'importing',v_total,v_total)
  returning id into v_import;

  for v_row in select * from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb))
  loop
    v_index := v_index + 1;
    begin
      v_id := public.save_question(null,p_organization_id,v_row || jsonb_build_object('metadata',coalesce(v_row->'metadata','{}'::jsonb) || jsonb_build_object('import_id',v_import,'import_row',v_index)));
      v_imported := v_imported + 1;
    exception when others then
      v_failed := v_failed + 1;
      v_errors := v_errors || jsonb_build_array(jsonb_build_object('row',v_index,'error',sqlerrm));
    end;
  end loop;

  update public.question_imports set
    status=case when v_imported>0 then 'completed'::public.import_status else 'failed'::public.import_status end,
    imported_rows=v_imported,invalid_rows=v_failed,error_report=v_errors,completed_at=now()
  where id=v_import;

  return jsonb_build_object('import_id',v_import,'total',v_total,'imported',v_imported,'failed',v_failed,'errors',v_errors);
end;
$$;
grant execute on function public.bulk_import_questions(uuid,text,text,jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Updated-at trigger
-- ---------------------------------------------------------------------------
drop trigger if exists questions_set_updated_at on public.questions;
create trigger questions_set_updated_at before update on public.questions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Storage bucket for question images
-- ---------------------------------------------------------------------------
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('question-assets','question-assets',true,5242880,array['image/png','image/jpeg','image/webp','image/svg+xml'])
on conflict(id) do update set public=true,file_size_limit=5242880,
  allowed_mime_types=array['image/png','image/jpeg','image/webp','image/svg+xml'];

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
-- Drop named policies first so this migration can be safely re-run after a partial setup.
drop policy if exists subjects_read on public.subjects;
drop policy if exists subjects_manage on public.subjects;
drop policy if exists chapters_read on public.chapters;
drop policy if exists chapters_manage on public.chapters;
drop policy if exists topics_read on public.topics;
drop policy if exists topics_manage on public.topics;
drop policy if exists questions_read on public.questions;
drop policy if exists questions_insert on public.questions;
drop policy if exists questions_update on public.questions;
drop policy if exists questions_delete on public.questions;
drop policy if exists options_read on public.question_options;
drop policy if exists options_manage on public.question_options;
drop policy if exists reviews_read on public.question_reviews;
drop policy if exists reviews_insert on public.question_reviews;
drop policy if exists imports_read on public.question_imports;
drop policy if exists imports_insert on public.question_imports;
drop policy if exists versions_read on public.question_versions;
drop policy if exists question_assets_public_read on storage.objects;
drop policy if exists question_assets_authenticated_insert on storage.objects;
drop policy if exists question_assets_owner_update on storage.objects;
drop policy if exists question_assets_owner_delete on storage.objects;
alter table public.subjects enable row level security;
alter table public.chapters enable row level security;
alter table public.topics enable row level security;
alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.question_reviews enable row level security;
alter table public.question_imports enable row level security;
alter table public.question_versions enable row level security;

create policy subjects_read on public.subjects for select to authenticated
using(organization_id is null or public.is_org_member(organization_id) or public.is_super_admin());
create policy subjects_manage on public.subjects for all to authenticated
using(public.is_super_admin() or (organization_id is not null and public.is_org_question_manager(organization_id)))
with check(public.is_super_admin() or (organization_id is not null and public.is_org_question_manager(organization_id)));

create policy chapters_read on public.chapters for select to authenticated
using(organization_id is null or public.is_org_member(organization_id) or public.is_super_admin());
create policy chapters_manage on public.chapters for all to authenticated
using(public.is_super_admin() or (organization_id is not null and public.is_org_question_manager(organization_id)))
with check(public.is_super_admin() or (organization_id is not null and public.is_org_question_manager(organization_id)));

create policy topics_read on public.topics for select to authenticated
using(organization_id is null or public.is_org_member(organization_id) or public.is_super_admin());
create policy topics_manage on public.topics for all to authenticated
using(public.is_super_admin() or (organization_id is not null and public.is_org_question_manager(organization_id)))
with check(public.is_super_admin() or (organization_id is not null and public.is_org_question_manager(organization_id)));

create policy questions_read on public.questions for select to authenticated
using(
  public.is_super_admin()
  or (organization_id is null and status='approved')
  or (organization_id is not null and public.is_org_member(organization_id))
  or created_by=auth.uid()
);
create policy questions_insert on public.questions for insert to authenticated
with check(
  (organization_id is null and public.is_super_admin())
  or (organization_id is not null and public.is_org_question_manager(organization_id))
);
create policy questions_update on public.questions for update to authenticated
using(
  (organization_id is null and public.is_super_admin())
  or (organization_id is not null and public.is_org_question_manager(organization_id))
)
with check(
  (organization_id is null and public.is_super_admin())
  or (organization_id is not null and public.is_org_question_manager(organization_id))
);
create policy questions_delete on public.questions for delete to authenticated
using(
  (organization_id is null and public.is_super_admin())
  or (organization_id is not null and public.is_org_question_manager(organization_id))
);

create policy options_read on public.question_options for select to authenticated
using(exists(select 1 from public.questions q where q.id=question_id));
create policy options_manage on public.question_options for all to authenticated
using(exists(select 1 from public.questions q where q.id=question_id and (
  (q.organization_id is null and public.is_super_admin()) or
  (q.organization_id is not null and public.is_org_question_manager(q.organization_id))
)))
with check(exists(select 1 from public.questions q where q.id=question_id and (
  (q.organization_id is null and public.is_super_admin()) or
  (q.organization_id is not null and public.is_org_question_manager(q.organization_id))
)));

create policy reviews_read on public.question_reviews for select to authenticated
using(exists(select 1 from public.questions q where q.id=question_id));
create policy reviews_insert on public.question_reviews for insert to authenticated
with check(reviewer_id=auth.uid());

create policy imports_read on public.question_imports for select to authenticated
using(created_by=auth.uid() or public.is_super_admin() or (organization_id is not null and public.is_org_member(organization_id)));
create policy imports_insert on public.question_imports for insert to authenticated
with check(created_by=auth.uid());

create policy versions_read on public.question_versions for select to authenticated
using(exists(select 1 from public.questions q where q.id=question_id));

create policy question_assets_public_read on storage.objects for select to public
using(bucket_id='question-assets');
create policy question_assets_authenticated_insert on storage.objects for insert to authenticated
with check(bucket_id='question-assets' and (storage.foldername(name))[1]=auth.uid()::text);
create policy question_assets_owner_update on storage.objects for update to authenticated
using(bucket_id='question-assets' and owner_id=auth.uid()::text)
with check(bucket_id='question-assets' and owner_id=auth.uid()::text);
create policy question_assets_owner_delete on storage.objects for delete to authenticated
using(bucket_id='question-assets' and owner_id=auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Seed core subject taxonomy (safe to run again)
-- ---------------------------------------------------------------------------
insert into public.subjects(code,name,exam_types)
values
  ('PHY','Physics',array['NEET','JEE Main','JEE Advanced','KCET']),
  ('CHEM','Chemistry',array['NEET','JEE Main','JEE Advanced','KCET']),
  ('MATH','Mathematics',array['JEE Main','JEE Advanced','KCET']),
  ('BIO','Biology',array['NEET','KCET'])
on conflict(organization_id,code) do update set name=excluded.name,exam_types=excluded.exam_types,is_active=true;

with s as (select id,code from public.subjects where organization_id is null)
insert into public.chapters(subject_id,name,code,display_order)
select s.id,v.name,v.code,v.ord from s join (values
  ('PHY','Units and Measurements','PHY-01',1),
  ('PHY','Kinematics','PHY-02',2),
  ('PHY','Laws of Motion','PHY-03',3),
  ('CHEM','Some Basic Concepts of Chemistry','CHEM-01',1),
  ('CHEM','Structure of Atom','CHEM-02',2),
  ('CHEM','Chemical Kinetics','CHEM-03',3),
  ('MATH','Sets and Functions','MATH-01',1),
  ('MATH','Quadratic Equations','MATH-02',2),
  ('MATH','Integral Calculus','MATH-03',3),
  ('BIO','Cell: The Unit of Life','BIO-01',1),
  ('BIO','Human Physiology','BIO-02',2),
  ('BIO','Genetics and Evolution','BIO-03',3)
) as v(subject_code,name,code,ord) on v.subject_code=s.code
on conflict(organization_id,subject_id,name) do update set code=excluded.code,display_order=excluded.display_order,is_active=true;

-- After running this file, disable "Confirm email" in Supabase Authentication -> Providers -> Email.
