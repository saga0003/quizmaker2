-- Evidara V8.0 Papers module foundation
-- Run after migrations 01 through 31.
-- This migration extends the existing question_papers / paper_sections /
-- paper_questions model. It does not create products, prices, purchases,
-- student entitlements, agent codes, result logic or test-delivery features.

begin;

-- ---------------------------------------------------------------------------
-- Programme catalogue used by the paper builder.
-- Foundation grades are intentionally separate programmes.
-- ---------------------------------------------------------------------------
create table if not exists public.paper_programmes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null default 'custom'
    check (category in ('foundation','grade','entrance','olympiad','scholarship','custom')),
  grade_label text,
  allowed_subject_codes text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.paper_programmes (
  code,name,category,grade_label,allowed_subject_codes,metadata,sort_order
) values
  ('FND7','Foundation Grade 7','foundation','Grade 7',array['PHY','CHEM','MAT','BIO','LR'],jsonb_build_object('question_tokens',array['Foundation Grade 7','FND7']),10),
  ('FND8','Foundation Grade 8','foundation','Grade 8',array['PHY','CHEM','MAT','BIO','LR'],jsonb_build_object('question_tokens',array['Foundation Grade 8','FND8']),20),
  ('FND9','Foundation Grade 9','foundation','Grade 9',array['PHY','CHEM','MAT','BIO','LR'],jsonb_build_object('question_tokens',array['Foundation Grade 9','FND9']),30),
  ('FND10','Foundation Grade 10','foundation','Grade 10',array['PHY','CHEM','MAT','BIO','LR'],jsonb_build_object('question_tokens',array['Foundation Grade 10','FND10']),40),
  ('G7','Grade 7','grade','Grade 7',array['PHY','CHEM','MAT','BIO','LR'],jsonb_build_object('question_tokens',array['Grade 7','G7']),50),
  ('G8','Grade 8','grade','Grade 8',array['PHY','CHEM','MAT','BIO','LR'],jsonb_build_object('question_tokens',array['Grade 8','G8']),60),
  ('G9','Grade 9','grade','Grade 9',array['PHY','CHEM','MAT','BIO','LR'],jsonb_build_object('question_tokens',array['Grade 9','G9']),70),
  ('G10','Grade 10','grade','Grade 10',array['PHY','CHEM','MAT','BIO','LR'],jsonb_build_object('question_tokens',array['Grade 10','G10']),80),
  ('G11','Grade 11','grade','Grade 11',array['PHY','CHEM','MAT','BIO'],jsonb_build_object('question_tokens',array['Grade 11','G11']),90),
  ('G12','Grade 12','grade','Grade 12',array['PHY','CHEM','MAT','BIO'],jsonb_build_object('question_tokens',array['Grade 12','G12']),100),
  ('NEET','NEET','entrance',null,array['PHY','CHEM','BIO'],jsonb_build_object('question_tokens',array['NEET']),110),
  ('JEE-MAIN','JEE Main','entrance',null,array['PHY','CHEM','MAT'],jsonb_build_object('question_tokens',array['JEE Main','JEE-MAIN']),120),
  ('JEE-ADV','JEE Advanced','entrance',null,array['PHY','CHEM','MAT'],jsonb_build_object('question_tokens',array['JEE Advanced','JEE-ADV']),130),
  ('KCET','KCET','entrance',null,array['PHY','CHEM','MAT','BIO'],jsonb_build_object('question_tokens',array['KCET']),140),
  ('OLYMPIAD','Olympiads','olympiad',null,array['PHY','CHEM','MAT','BIO','LR'],jsonb_build_object('question_tokens',array['Olympiad','Olympiads']),150),
  ('SCHOLARSHIP','Scholarship Examinations','scholarship',null,array['PHY','CHEM','MAT','BIO','LR'],jsonb_build_object('question_tokens',array['Scholarship Exam','Scholarship']),160),
  ('CUSTOM','Custom Examination','custom',null,array['PHY','CHEM','MAT','BIO','LR'],jsonb_build_object('question_tokens',array['Custom']),999)
on conflict (code) do update set
  name=excluded.name,
  category=excluded.category,
  grade_label=excluded.grade_label,
  allowed_subject_codes=excluded.allowed_subject_codes,
  metadata=excluded.metadata,
  sort_order=excluded.sort_order,
  is_active=true,
  updated_at=now();

-- ---------------------------------------------------------------------------
-- Extend the existing paper definition without disturbing the V7 delivery
-- engine. workflow_status is intentionally text so V8 can evolve without
-- changing the legacy paper_status enum used by active attempts.
-- ---------------------------------------------------------------------------
alter table public.question_papers
  add column if not exists slug text,
  add column if not exists detailed_description text,
  add column if not exists paper_type text not null default 'custom_test',
  add column if not exists academic_year text,
  add column if not exists language text not null default 'English',
  add column if not exists tags text[] not null default '{}',
  add column if not exists internal_notes text,
  add column if not exists programme_code text references public.paper_programmes(code) on delete set null,
  add column if not exists workflow_status text not null default 'draft',
  add column if not exists creation_mode text not null default 'manual',
  add column if not exists version_number integer not null default 1,
  add column if not exists parent_paper_id uuid references public.question_papers(id) on delete set null,
  add column if not exists previous_version_id uuid references public.question_papers(id) on delete set null,
  add column if not exists change_summary text,
  add column if not exists reading_time_minutes integer not null default 0,
  add column if not exists grace_time_minutes integer not null default 0,
  add column if not exists auto_submit boolean not null default true,
  add column if not exists default_positive_marks numeric(8,2),
  add column if not exists default_negative_marks numeric(8,2),
  add column if not exists unanswered_marks numeric(8,2) not null default 0,
  add column if not exists allow_partial_marking boolean not null default false,
  add column if not exists numerical_tolerance numeric(12,6),
  add column if not exists shuffle_mode text not null default 'fixed',
  add column if not exists preserve_locked_positions boolean not null default true,
  add column if not exists allow_previously_used boolean not null default true,
  add column if not exists prefer_unused boolean not null default false,
  add column if not exists only_unused boolean not null default false,
  add column if not exists exclude_used_within_days integer,
  add column if not exists exclude_used_more_than integer,
  add column if not exists last_saved_at timestamptz,
  add column if not exists draft_revision bigint not null default 0,
  add column if not exists validation_summary jsonb not null default jsonb_build_object('critical',jsonb_build_array(),'warnings',jsonb_build_array()),
  add column if not exists builder_settings jsonb not null default '{}'::jsonb;

update public.question_papers
set workflow_status = case status::text
  when 'published' then 'published'
  when 'archived' then 'archived'
  else 'draft'
end
where workflow_status is null or workflow_status = '';

update public.question_papers
set programme_code = case upper(exam_type)
  when 'NEET' then 'NEET'
  when 'JEE MAIN' then 'JEE-MAIN'
  when 'JEE ADVANCED' then 'JEE-ADV'
  when 'KCET' then 'KCET'
  when 'SCHOLARSHIP EXAM' then 'SCHOLARSHIP'
  else programme_code
end
where programme_code is null;

create unique index if not exists question_papers_org_slug_unique
  on public.question_papers (
    coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid),
    lower(slug)
  ) where slug is not null;
create index if not exists question_papers_programme_idx
  on public.question_papers(programme_code,workflow_status,updated_at desc);
create index if not exists question_papers_parent_version_idx
  on public.question_papers(parent_paper_id,version_number desc);

alter table public.paper_sections
  add column if not exists code text,
  add column if not exists description text,
  add column if not exists selection_mode text not null default 'manual',
  add column if not exists total_questions integer,
  add column if not exists minimum_questions_to_attempt integer,
  add column if not exists maximum_marks numeric(10,2),
  add column if not exists is_optional boolean not null default false,
  add column if not exists duration_minutes integer,
  add column if not exists navigation_rules jsonb not null default '{}'::jsonb,
  add column if not exists settings jsonb not null default '{}'::jsonb;

alter table public.paper_questions
  add column if not exists is_locked boolean not null default false,
  add column if not exists generation_source text not null default 'manual',
  add column if not exists shuffle_restricted boolean not null default false,
  add column if not exists position_locked boolean not null default false,
  add column if not exists original_marks numeric(8,2),
  add column if not exists original_negative_marks numeric(8,2),
  add column if not exists is_bonus boolean not null default false,
  add column if not exists is_cancelled boolean not null default false,
  add column if not exists grace_marks numeric(8,2) not null default 0,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Paper subjects, versions, blueprints, templates, reviews and validation.
-- ---------------------------------------------------------------------------
create table if not exists public.paper_subjects (
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (paper_id,subject_id)
);

insert into public.paper_subjects(paper_id,subject_id,display_order)
select distinct section.paper_id,section.subject_id,
  dense_rank() over (partition by section.paper_id order by section.subject_id)-1
from public.paper_sections section
where section.subject_id is not null
on conflict (paper_id,subject_id) do nothing;

create table if not exists public.paper_versions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  version_number integer not null,
  parent_version_id uuid references public.paper_versions(id) on delete set null,
  workflow_status text not null default 'draft',
  change_summary text,
  definition_snapshot jsonb not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique(paper_id,version_number)
);

create table if not exists public.paper_blueprints (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  section_id uuid references public.paper_sections(id) on delete cascade,
  rule_order integer not null default 0,
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_id uuid references public.chapters(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  difficulty text,
  question_type text,
  positive_marks numeric(8,2),
  negative_marks numeric(8,2),
  estimated_seconds_min integer,
  estimated_seconds_max integer,
  language text,
  required_tags text[] not null default '{}',
  excluded_question_ids uuid[] not null default '{}',
  previous_usage_rule text not null default 'allow',
  requested_count integer not null default 0 check (requested_count >= 0),
  selected_count integer not null default 0 check (selected_count >= 0),
  locked_count integer not null default 0 check (locked_count >= 0),
  availability_count integer not null default 0 check (availability_count >= 0),
  rule_status text not null default 'pending',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists paper_blueprints_paper_idx
  on public.paper_blueprints(paper_id,section_id,rule_order);

alter table public.paper_questions
  add column if not exists blueprint_rule_id uuid references public.paper_blueprints(id) on delete set null;

create table if not exists public.paper_generation_runs (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  paper_version integer not null default 1,
  generated_by uuid references public.profiles(id) on delete set null,
  random_seed text not null,
  generation_mode text not null check (generation_mode in ('automatic','hybrid','regeneration','replacement')),
  blueprint_snapshot jsonb not null default '[]'::jsonb,
  selected_question_ids uuid[] not null default '{}',
  excluded_question_ids uuid[] not null default '{}',
  shortages jsonb not null default '[]'::jsonb,
  regenerated_sections uuid[] not null default '{}',
  replaced_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists paper_generation_runs_paper_idx
  on public.paper_generation_runs(paper_id,created_at desc);

create table if not exists public.paper_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  programme_code text references public.paper_programmes(code) on delete set null,
  paper_type text,
  template_definition jsonb not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists paper_templates_org_name_unique
  on public.paper_templates(
    coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid),
    lower(name)
  );

alter table public.question_papers
  add column if not exists based_on_template_id uuid references public.paper_templates(id) on delete set null;

create table if not exists public.paper_reviews (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  requested_by uuid references public.profiles(id) on delete set null,
  assigned_reviewer_id uuid references public.profiles(id) on delete set null,
  status text not null default 'submitted'
    check (status in ('submitted','in_review','changes_requested','approved','rejected','resolved')),
  summary text,
  decision_reason text,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists paper_reviews_paper_idx
  on public.paper_reviews(paper_id,created_at desc);

create table if not exists public.paper_review_comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.paper_reviews(id) on delete cascade,
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  section_id uuid references public.paper_sections(id) on delete cascade,
  paper_question_id uuid references public.paper_questions(id) on delete cascade,
  comment_type text not null default 'general',
  body text not null,
  created_by uuid references public.profiles(id) on delete set null,
  is_resolved boolean not null default false,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists paper_review_comments_paper_idx
  on public.paper_review_comments(paper_id,is_resolved,created_at);

create table if not exists public.paper_validation_results (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  critical_errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  accepted_warning_reason text,
  validated_by uuid references public.profiles(id) on delete set null,
  validated_at timestamptz not null default now()
);
create index if not exists paper_validation_results_paper_idx
  on public.paper_validation_results(paper_id,validated_at desc);

create table if not exists public.paper_audit_history (
  id bigint generated by default as identity primary key,
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  previous_value jsonb,
  new_value jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists paper_audit_history_paper_idx
  on public.paper_audit_history(paper_id,created_at desc);

-- ---------------------------------------------------------------------------
-- Permission helpers. Platform admins manage master papers. School staff manage
-- papers belonging to their organization. Student access is intentionally absent.
-- ---------------------------------------------------------------------------
create or replace function public.is_paper_manager_v8(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    auth.role() = 'service_role'
    or public.current_evidara_role() in ('super_admin','evidara_admin','admin','platform_admin')
    or (
      p_organization_id is not null
      and public.is_evidara_school_staff(p_organization_id)
    ),
    false
  )
$$;

grant execute on function public.is_paper_manager_v8(uuid) to authenticated,service_role;

create or replace function public.is_paper_reviewer_v8(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    auth.role() = 'service_role'
    or public.current_evidara_role() in (
      'super_admin','evidara_admin','admin','platform_admin','reviewer','content_reviewer'
    )
    or (
      p_organization_id is not null
      and public.is_evidara_school_staff(p_organization_id)
    ),
    false
  )
$$;

grant execute on function public.is_paper_reviewer_v8(uuid) to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Automatic paper code generation. Codes remain unique per organization.
-- ---------------------------------------------------------------------------
create or replace function public.next_paper_code_v8(
  p_organization_id uuid,
  p_programme_code text,
  p_paper_type text,
  p_subject_code text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  prefix text;
  next_number integer;
begin
  prefix := upper(regexp_replace(
    concat_ws('-',
      nullif(trim(coalesce(p_programme_code,'CUSTOM')),''),
      nullif(trim(coalesce(p_subject_code,'')),''),
      case lower(coalesce(p_paper_type,'custom_test'))
        when 'full_length_mock' then 'FULL'
        when 'subject_test' then 'SUB'
        when 'chapter_test' then 'CH'
        when 'topic_test' then 'TOP'
        when 'unit_test' then 'UNIT'
        when 'diagnostic_test' then 'DIAG'
        when 'scholarship_test' then 'SCH'
        when 'previous_year_paper' then 'PYP'
        when 'practice_test' then 'PRAC'
        when 'foundation_test' then 'FND'
        when 'school_test' then 'SCHOOL'
        else 'CUSTOM'
      end
    ),'[^A-Z0-9-]+','','g'
  ));
  prefix := regexp_replace(prefix,'-+','-','g');
  prefix := trim(both '-' from prefix);

  select coalesce(max(
    case
      when code ~ ('^' || prefix || '-[0-9]+$')
        then substring(code from '([0-9]+)$')::integer
      else null
    end
  ),0)+1
  into next_number
  from public.question_papers
  where coalesce(organization_id,'00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_organization_id,'00000000-0000-0000-0000-000000000000'::uuid);

  return prefix || '-' || lpad(next_number::text,3,'0');
end
$$;

grant execute on function public.next_paper_code_v8(uuid,text,text,text) to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Server-side question search. The browser receives one page, never the whole
-- question bank. Usage count is calculated from paper_questions.
-- ---------------------------------------------------------------------------
create or replace function public.search_eligible_questions_v8(
  p_organization_id uuid default null,
  p_programme_code text default null,
  p_subject_id uuid default null,
  p_chapter_id uuid default null,
  p_topic_id uuid default null,
  p_difficulty text default null,
  p_question_type text default null,
  p_language text default null,
  p_search text default null,
  p_usage_rule text default 'allow',
  p_excluded_ids uuid[] default '{}',
  p_page integer default 1,
  p_page_size integer default 25
)
returns table (
  id uuid,
  external_question_id text,
  stem_text text,
  question_image_url text,
  subject_id uuid,
  subject_name text,
  chapter_id uuid,
  chapter_name text,
  topic_id uuid,
  topic_name text,
  difficulty text,
  question_type text,
  marks numeric,
  negative_marks numeric,
  estimated_seconds integer,
  language text,
  usage_count bigint,
  updated_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with programme as (
    select coalesce(array(
      select jsonb_array_elements_text(metadata->'question_tokens')
    ),array[]::text[]) as tokens
    from public.paper_programmes
    where code=p_programme_code
  ), eligible as (
    select
      question.id,
      coalesce(question.metadata->>'external_question_id',question.metadata->>'external_id') as external_question_id,
      question.stem_text,
      question.question_image_url,
      question.subject_id,
      subject.name as subject_name,
      question.chapter_id,
      chapter.name as chapter_name,
      question.topic_id,
      topic.name as topic_name,
      question.difficulty::text,
      question.question_type::text,
      question.marks,
      question.negative_marks,
      question.estimated_seconds,
      question.language,
      (select count(*) from public.paper_questions used where used.question_id=question.id) as usage_count,
      question.updated_at
    from public.questions question
    left join public.subjects subject on subject.id=question.subject_id
    left join public.chapters chapter on chapter.id=question.chapter_id
    left join public.topics topic on topic.id=question.topic_id
    where question.status::text='approved'
      and (
        public.current_evidara_role() in ('super_admin','evidara_admin','admin','platform_admin')
        or (question.organization_id is null and public.is_evidara_school_staff(p_organization_id))
        or (p_organization_id is not null and question.organization_id=p_organization_id and public.is_evidara_school_staff(p_organization_id))
      )
      and (p_subject_id is null or question.subject_id=p_subject_id)
      and (p_chapter_id is null or question.chapter_id=p_chapter_id)
      and (p_topic_id is null or question.topic_id=p_topic_id)
      and (p_difficulty is null or question.difficulty::text=p_difficulty)
      and (p_question_type is null or question.question_type::text=p_question_type)
      and (p_language is null or lower(question.language)=lower(p_language))
      and (question.id <> all(coalesce(p_excluded_ids,array[]::uuid[])))
      and (
        p_programme_code is null
        or exists (
          select 1 from programme selected_programme
          where question.class_level = any(selected_programme.tokens)
             or coalesce(question.exam_types,array[]::text[]) && selected_programme.tokens
        )
      )
      and (
        p_search is null
        or question.stem_text ilike '%'||p_search||'%'
        or question.id::text ilike '%'||p_search||'%'
        or coalesce(question.metadata->>'external_question_id','') ilike '%'||p_search||'%'
        or subject.name ilike '%'||p_search||'%'
        or chapter.name ilike '%'||p_search||'%'
        or topic.name ilike '%'||p_search||'%'
      )
  )
  select eligible.*,
    count(*) over() as total_count
  from eligible
  where p_usage_rule <> 'only_unused' or eligible.usage_count=0
  order by
    case when p_usage_rule='prefer_unused' then eligible.usage_count else 0 end,
    eligible.updated_at desc,
    eligible.id
  limit greatest(1,least(coalesce(p_page_size,25),100))
  offset greatest(0,(greatest(coalesce(p_page,1),1)-1)*greatest(1,least(coalesce(p_page_size,25),100)))
$$;

grant execute on function public.search_eligible_questions_v8(
  uuid,text,uuid,uuid,uuid,text,text,text,text,text,uuid[],integer,integer
) to authenticated,service_role;

create or replace function public.paper_question_availability_v8(
  p_organization_id uuid default null,
  p_programme_code text default null,
  p_subject_id uuid default null,
  p_chapter_id uuid default null,
  p_topic_id uuid default null,
  p_difficulty text default null,
  p_question_type text default null,
  p_excluded_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  overall_count bigint;
  unused_count bigint;
  by_difficulty jsonb;
  by_type jsonb;
begin
  with rows as (
    select * from public.search_eligible_questions_v8(
      p_organization_id,p_programme_code,p_subject_id,p_chapter_id,p_topic_id,
      p_difficulty,p_question_type,null,null,'allow',p_excluded_ids,1,100
    )
  )
  select coalesce(max(total_count),0),count(*) filter(where usage_count=0)
  into overall_count,unused_count
  from rows;

  select coalesce(jsonb_object_agg(value_key,value_count),'{}'::jsonb)
  into by_difficulty
  from (
    select question.difficulty::text value_key,count(*) value_count
    from public.questions question
    where question.status::text='approved'
      and (p_subject_id is null or question.subject_id=p_subject_id)
      and (p_chapter_id is null or question.chapter_id=p_chapter_id)
      and (p_topic_id is null or question.topic_id=p_topic_id)
      and (question.id <> all(coalesce(p_excluded_ids,array[]::uuid[])))
    group by question.difficulty::text
  ) grouped;

  select coalesce(jsonb_object_agg(value_key,value_count),'{}'::jsonb)
  into by_type
  from (
    select question.question_type::text value_key,count(*) value_count
    from public.questions question
    where question.status::text='approved'
      and (p_subject_id is null or question.subject_id=p_subject_id)
      and (p_chapter_id is null or question.chapter_id=p_chapter_id)
      and (p_topic_id is null or question.topic_id=p_topic_id)
      and (question.id <> all(coalesce(p_excluded_ids,array[]::uuid[])))
    group by question.question_type::text
  ) grouped;

  return jsonb_build_object(
    'total_approved',overall_count,
    'unused',unused_count,
    'previously_used',greatest(overall_count-unused_count,0),
    'by_difficulty',by_difficulty,
    'by_question_type',by_type,
    'status',case when overall_count=0 then 'no_questions' else 'ready' end
  );
end
$$;

grant execute on function public.paper_question_availability_v8(
  uuid,text,uuid,uuid,uuid,text,text,uuid[]
) to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- V8 draft save. Partial drafts are valid. Questions are snapshotted only when
-- present, and published definitions cannot be silently overwritten.
-- ---------------------------------------------------------------------------
create or replace function public.save_paper_definition_v8(
  p_paper_id uuid,
  p_organization_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  actor uuid := auth.uid();
  target_paper uuid;
  existing public.question_papers%rowtype;
  section_item jsonb;
  question_item jsonb;
  section_id uuid;
  section_map jsonb := '{}'::jsonb;
  question_record public.questions%rowtype;
  options_snapshot jsonb;
  question_snapshot jsonb;
  subject_value text;
  generated_code text;
  revision_value bigint;
  total_value numeric(10,2) := 0;
  question_count integer := 0;
  paper_title text := nullif(trim(coalesce(p_payload->>'title','')),'');
  programme_value text := nullif(trim(coalesce(p_payload->>'programme_code','')),'');
  paper_type_value text := coalesce(nullif(trim(p_payload->>'paper_type'),''),'custom_test');
begin
  if actor is null then
    raise exception 'Please sign in before saving a paper.' using errcode='42501';
  end if;
  if not public.is_paper_manager_v8(p_organization_id) then
    raise exception 'You do not have permission to create or edit papers in this workspace.' using errcode='42501';
  end if;

  if p_paper_id is not null then
    select * into existing from public.question_papers where id=p_paper_id for update;
    if not found or not public.is_paper_manager_v8(existing.organization_id) then
      raise exception 'Paper not found or permission denied.' using errcode='P0002';
    end if;
    if existing.workflow_status in ('published','closed','archived') then
      raise exception 'Published, closed and archived papers cannot be overwritten. Create a new version instead.' using errcode='55000';
    end if;
    if existing.organization_id is distinct from p_organization_id then
      raise exception 'A paper cannot be moved between Evidara and a school workspace.' using errcode='42501';
    end if;
  end if;

  if paper_title is null then paper_title := 'Untitled paper'; end if;
  generated_code := nullif(upper(trim(coalesce(p_payload->>'code',''))),'');
  if generated_code is null then
    generated_code := public.next_paper_code_v8(
      p_organization_id,coalesce(programme_value,'CUSTOM'),paper_type_value,null
    );
  end if;

  if p_paper_id is null then
    insert into public.question_papers(
      organization_id,created_by,updated_by,title,code,slug,description,detailed_description,
      exam_type,paper_type,academic_year,language,tags,internal_notes,programme_code,
      status,workflow_status,creation_mode,duration_minutes,reading_time_minutes,
      grace_time_minutes,auto_submit,instructions,total_marks,total_questions,
      shuffle_questions,shuffle_options,shuffle_mode,preserve_locked_positions,
      default_positive_marks,default_negative_marks,unanswered_marks,
      allow_partial_marking,numerical_tolerance,allow_previously_used,prefer_unused,
      only_unused,exclude_used_within_days,exclude_used_more_than,last_saved_at,
      draft_revision,builder_settings
    ) values (
      p_organization_id,actor,actor,paper_title,generated_code,
      nullif(trim(p_payload->>'slug'),''),nullif(p_payload->>'description',''),
      nullif(p_payload->>'detailed_description',''),coalesce(programme_value,'Custom'),
      paper_type_value,nullif(p_payload->>'academic_year',''),
      coalesce(nullif(p_payload->>'language',''),'English'),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb))),array[]::text[]),
      nullif(p_payload->>'internal_notes',''),programme_value,'draft','draft',
      coalesce(nullif(p_payload->>'creation_mode',''),'manual'),
      greatest(coalesce((p_payload->>'duration_minutes')::integer,60),1),
      greatest(coalesce((p_payload->>'reading_time_minutes')::integer,0),0),
      greatest(coalesce((p_payload->>'grace_time_minutes')::integer,0),0),
      coalesce((p_payload->>'auto_submit')::boolean,true),nullif(p_payload->>'instructions',''),
      0,0,coalesce((p_payload->>'shuffle_questions')::boolean,false),
      coalesce((p_payload->>'shuffle_options')::boolean,false),
      coalesce(nullif(p_payload->>'shuffle_mode',''),'fixed'),
      coalesce((p_payload->>'preserve_locked_positions')::boolean,true),
      nullif(p_payload->>'default_positive_marks','')::numeric,
      nullif(p_payload->>'default_negative_marks','')::numeric,
      coalesce(nullif(p_payload->>'unanswered_marks','')::numeric,0),
      coalesce((p_payload->>'allow_partial_marking')::boolean,false),
      nullif(p_payload->>'numerical_tolerance','')::numeric,
      coalesce((p_payload->>'allow_previously_used')::boolean,true),
      coalesce((p_payload->>'prefer_unused')::boolean,false),
      coalesce((p_payload->>'only_unused')::boolean,false),
      nullif(p_payload->>'exclude_used_within_days','')::integer,
      nullif(p_payload->>'exclude_used_more_than','')::integer,
      now(),1,coalesce(p_payload->'builder_settings','{}'::jsonb)
    ) returning id,draft_revision into target_paper,revision_value;
  else
    target_paper := p_paper_id;
    update public.question_papers set
      title=paper_title,
      code=generated_code,
      slug=nullif(trim(p_payload->>'slug'),''),
      description=nullif(p_payload->>'description',''),
      detailed_description=nullif(p_payload->>'detailed_description',''),
      exam_type=coalesce(programme_value,exam_type),
      paper_type=paper_type_value,
      academic_year=nullif(p_payload->>'academic_year',''),
      language=coalesce(nullif(p_payload->>'language',''),'English'),
      tags=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb))),array[]::text[]),
      internal_notes=nullif(p_payload->>'internal_notes',''),
      programme_code=programme_value,
      workflow_status=case when workflow_status='changes_requested' then 'changes_requested' else 'draft' end,
      status='draft',
      creation_mode=coalesce(nullif(p_payload->>'creation_mode',''),'manual'),
      duration_minutes=greatest(coalesce((p_payload->>'duration_minutes')::integer,duration_minutes),1),
      reading_time_minutes=greatest(coalesce((p_payload->>'reading_time_minutes')::integer,0),0),
      grace_time_minutes=greatest(coalesce((p_payload->>'grace_time_minutes')::integer,0),0),
      auto_submit=coalesce((p_payload->>'auto_submit')::boolean,true),
      instructions=nullif(p_payload->>'instructions',''),
      shuffle_questions=coalesce((p_payload->>'shuffle_questions')::boolean,false),
      shuffle_options=coalesce((p_payload->>'shuffle_options')::boolean,false),
      shuffle_mode=coalesce(nullif(p_payload->>'shuffle_mode',''),'fixed'),
      preserve_locked_positions=coalesce((p_payload->>'preserve_locked_positions')::boolean,true),
      default_positive_marks=nullif(p_payload->>'default_positive_marks','')::numeric,
      default_negative_marks=nullif(p_payload->>'default_negative_marks','')::numeric,
      unanswered_marks=coalesce(nullif(p_payload->>'unanswered_marks','')::numeric,0),
      allow_partial_marking=coalesce((p_payload->>'allow_partial_marking')::boolean,false),
      numerical_tolerance=nullif(p_payload->>'numerical_tolerance','')::numeric,
      allow_previously_used=coalesce((p_payload->>'allow_previously_used')::boolean,true),
      prefer_unused=coalesce((p_payload->>'prefer_unused')::boolean,false),
      only_unused=coalesce((p_payload->>'only_unused')::boolean,false),
      exclude_used_within_days=nullif(p_payload->>'exclude_used_within_days','')::integer,
      exclude_used_more_than=nullif(p_payload->>'exclude_used_more_than','')::integer,
      builder_settings=coalesce(p_payload->'builder_settings','{}'::jsonb),
      updated_by=actor,
      updated_at=now(),
      last_saved_at=now(),
      draft_revision=draft_revision+1
    where id=target_paper
    returning draft_revision into revision_value;
  end if;

  delete from public.paper_subjects where paper_id=target_paper;
  for subject_value in
    select jsonb_array_elements_text(coalesce(p_payload->'subject_ids','[]'::jsonb))
  loop
    insert into public.paper_subjects(paper_id,subject_id,display_order)
    values(target_paper,subject_value::uuid,
      (select count(*) from public.paper_subjects where paper_id=target_paper))
    on conflict (paper_id,subject_id) do nothing;
  end loop;

  delete from public.paper_sections where paper_id=target_paper;
  for section_item in
    select * from jsonb_array_elements(coalesce(p_payload->'sections','[]'::jsonb))
  loop
    insert into public.paper_sections(
      paper_id,title,code,description,subject_id,instructions,questions_to_attempt,
      minimum_questions_to_attempt,total_questions,maximum_marks,is_optional,
      selection_mode,duration_minutes,navigation_rules,settings,display_order
    ) values (
      target_paper,coalesce(nullif(trim(section_item->>'title'),''),'Untitled section'),
      nullif(trim(section_item->>'code'),''),nullif(section_item->>'description',''),
      nullif(section_item->>'subject_id','')::uuid,nullif(section_item->>'instructions',''),
      nullif(section_item->>'questions_to_attempt','')::integer,
      nullif(section_item->>'minimum_questions_to_attempt','')::integer,
      nullif(section_item->>'total_questions','')::integer,
      nullif(section_item->>'maximum_marks','')::numeric,
      coalesce((section_item->>'is_optional')::boolean,false),
      coalesce(nullif(section_item->>'selection_mode',''),'manual'),
      nullif(section_item->>'duration_minutes','')::integer,
      coalesce(section_item->'navigation_rules','{}'::jsonb),
      coalesce(section_item->'settings','{}'::jsonb),
      coalesce((section_item->>'display_order')::integer,0)
    ) returning id into section_id;
    section_map := section_map || jsonb_build_object(section_item->>'client_id',section_id::text);
  end loop;

  for question_item in
    select * from jsonb_array_elements(coalesce(p_payload->'questions','[]'::jsonb))
  loop
    select * into question_record
    from public.questions
    where id=(question_item->>'question_id')::uuid;

    if not found then
      raise exception 'Question % no longer exists. Remove it before saving.',question_item->>'question_id';
    end if;
    if question_record.status::text <> 'approved' then
      raise exception 'Only approved questions can be saved in a paper.';
    end if;
    if not (
      public.current_evidara_role() in ('super_admin','evidara_admin','admin','platform_admin')
      or (question_record.organization_id is null and public.is_evidara_school_staff(p_organization_id))
      or (p_organization_id is not null and question_record.organization_id=p_organization_id and public.is_evidara_school_staff(p_organization_id))
    ) then
      raise exception 'A selected question is outside your question-bank scope.' using errcode='42501';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'option_key',option_row.option_key,
      'content_text',option_row.content_text,
      'content_latex',option_row.content_latex,
      'image_url',option_row.image_url,
      'is_correct',option_row.is_correct,
      'display_order',option_row.display_order
    ) order by option_row.display_order),'[]'::jsonb)
    into options_snapshot
    from public.question_options option_row
    where option_row.question_id=question_record.id;

    question_snapshot := jsonb_build_object(
      'id',question_record.id,
      'stem_text',question_record.stem_text,
      'stem_latex',question_record.stem_latex,
      'question_image_url',question_record.question_image_url,
      'passage_text',question_record.passage_text,
      'question_type',question_record.question_type,
      'difficulty',question_record.difficulty,
      'correct_answer',question_record.correct_answer,
      'solution_text',question_record.solution_text,
      'solution_latex',question_record.solution_latex,
      'subject_id',question_record.subject_id,
      'chapter_id',question_record.chapter_id,
      'topic_id',question_record.topic_id,
      'estimated_seconds',question_record.estimated_seconds,
      'version_number',question_record.version_number,
      'options',options_snapshot
    );

    section_id := nullif(section_map->>(question_item->>'section_client_id'),'')::uuid;
    if section_id is null then
      raise exception 'A selected question is assigned to a missing section.';
    end if;

    insert into public.paper_questions(
      paper_id,section_id,question_id,display_order,marks,negative_marks,
      original_marks,original_negative_marks,is_mandatory,is_locked,
      generation_source,shuffle_restricted,position_locked,is_bonus,
      is_cancelled,grace_marks,metadata,question_snapshot
    ) values (
      target_paper,section_id,question_record.id,
      coalesce((question_item->>'display_order')::integer,question_count),
      coalesce(nullif(question_item->>'marks','')::numeric,question_record.marks),
      coalesce(nullif(question_item->>'negative_marks','')::numeric,question_record.negative_marks),
      question_record.marks,question_record.negative_marks,
      coalesce((question_item->>'is_mandatory')::boolean,true),
      coalesce((question_item->>'is_locked')::boolean,false),
      coalesce(nullif(question_item->>'generation_source',''),'manual'),
      coalesce((question_item->>'shuffle_restricted')::boolean,false),
      coalesce((question_item->>'position_locked')::boolean,false),
      coalesce((question_item->>'is_bonus')::boolean,false),
      coalesce((question_item->>'is_cancelled')::boolean,false),
      coalesce(nullif(question_item->>'grace_marks','')::numeric,0),
      coalesce(question_item->'metadata','{}'::jsonb),question_snapshot
    );

    total_value := total_value + coalesce(nullif(question_item->>'marks','')::numeric,question_record.marks);
    question_count := question_count+1;
  end loop;

  update public.question_papers set
    total_marks=total_value,
    total_questions=question_count,
    last_saved_at=now(),
    updated_at=now(),
    updated_by=actor
  where id=target_paper;

  insert into public.paper_audit_history(
    paper_id,actor_id,actor_role,action,new_value
  ) values (
    target_paper,actor,public.current_evidara_role(),
    case when p_paper_id is null then 'paper.created' else 'paper.draft_saved' end,
    jsonb_build_object('revision',revision_value,'questions',question_count,'marks',total_value)
  );

  return jsonb_build_object(
    'paper_id',target_paper,
    'code',generated_code,
    'workflow_status','draft',
    'revision',revision_value,
    'saved_at',now(),
    'total_questions',question_count,
    'total_marks',total_value
  );
exception
  when unique_violation then
    raise exception 'The paper code or slug is already in use. Choose another value.' using errcode='23505';
end
$$;

grant execute on function public.save_paper_definition_v8(uuid,uuid,jsonb) to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Draft-only duplication. No duplicated paper is published, scheduled or made
-- available to students. The copy receives a fresh code and draft status.
-- ---------------------------------------------------------------------------
create or replace function public.duplicate_question_paper_v8(
  p_source_paper_id uuid,
  p_copy_scope text default 'entire',
  p_new_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  actor uuid := auth.uid();
  source_paper public.question_papers%rowtype;
  target_paper uuid;
  target_code text;
  normalized_scope text := lower(coalesce(nullif(trim(p_copy_scope),''),'entire'));
  source_section record;
  source_blueprint record;
  section_map jsonb := '{}'::jsonb;
  blueprint_map jsonb := '{}'::jsonb;
  target_section uuid;
  target_blueprint uuid;
  total_value numeric(10,2) := 0;
  question_count integer := 0;
begin
  if actor is null then raise exception 'Please sign in before duplicating a paper.' using errcode='42501'; end if;
  if normalized_scope not in ('entire','settings','sections','blueprint','questions') then
    raise exception 'Copy scope must be entire, settings, sections, blueprint or questions.' using errcode='22023';
  end if;

  select * into source_paper from public.question_papers where id=p_source_paper_id;
  if not found or not public.is_paper_manager_v8(source_paper.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;

  target_code := public.next_paper_code_v8(
    source_paper.organization_id,
    coalesce(source_paper.programme_code,'CUSTOM'),
    source_paper.paper_type,
    null
  );

  insert into public.question_papers(
    organization_id,created_by,updated_by,title,code,slug,description,detailed_description,
    exam_type,paper_type,academic_year,language,tags,internal_notes,programme_code,
    status,workflow_status,creation_mode,version_number,parent_paper_id,
    duration_minutes,reading_time_minutes,grace_time_minutes,auto_submit,instructions,
    access_mode,access_code,available_from,available_until,attempt_limit,result_mode,
    shuffle_questions,shuffle_options,shuffle_mode,preserve_locked_positions,
    default_positive_marks,default_negative_marks,unanswered_marks,
    allow_partial_marking,numerical_tolerance,allow_previously_used,prefer_unused,
    only_unused,exclude_used_within_days,exclude_used_more_than,builder_settings,
    total_marks,total_questions,published_at,last_saved_at,draft_revision
  ) values (
    source_paper.organization_id,actor,actor,
    coalesce(nullif(trim(p_new_title),''),source_paper.title||' Copy'),target_code,null,
    source_paper.description,source_paper.detailed_description,source_paper.exam_type,
    source_paper.paper_type,source_paper.academic_year,source_paper.language,
    source_paper.tags,source_paper.internal_notes,source_paper.programme_code,
    'draft','draft',source_paper.creation_mode,1,source_paper.id,
    source_paper.duration_minutes,source_paper.reading_time_minutes,
    source_paper.grace_time_minutes,source_paper.auto_submit,source_paper.instructions,
    'public',null,null,null,source_paper.attempt_limit,source_paper.result_mode,
    source_paper.shuffle_questions,source_paper.shuffle_options,source_paper.shuffle_mode,
    source_paper.preserve_locked_positions,source_paper.default_positive_marks,
    source_paper.default_negative_marks,source_paper.unanswered_marks,
    source_paper.allow_partial_marking,source_paper.numerical_tolerance,
    source_paper.allow_previously_used,source_paper.prefer_unused,source_paper.only_unused,
    source_paper.exclude_used_within_days,source_paper.exclude_used_more_than,
    source_paper.builder_settings,0,0,null,now(),1
  ) returning id into target_paper;

  insert into public.paper_subjects(paper_id,subject_id,display_order)
  select target_paper,subject_id,display_order
  from public.paper_subjects where paper_id=source_paper.id;

  if normalized_scope in ('entire','sections','blueprint','questions') then
    for source_section in
      select * from public.paper_sections where paper_id=source_paper.id order by display_order,id
    loop
      insert into public.paper_sections(
        paper_id,title,code,description,subject_id,instructions,questions_to_attempt,
        minimum_questions_to_attempt,total_questions,maximum_marks,is_optional,
        selection_mode,duration_minutes,navigation_rules,settings,display_order
      ) values (
        target_paper,source_section.title,source_section.code,source_section.description,
        source_section.subject_id,source_section.instructions,source_section.questions_to_attempt,
        source_section.minimum_questions_to_attempt,source_section.total_questions,
        source_section.maximum_marks,source_section.is_optional,source_section.selection_mode,
        source_section.duration_minutes,source_section.navigation_rules,
        source_section.settings,source_section.display_order
      ) returning id into target_section;
      section_map := section_map || jsonb_build_object(source_section.id::text,target_section::text);
    end loop;
  end if;

  if normalized_scope in ('entire','blueprint') then
    for source_blueprint in
      select * from public.paper_blueprints where paper_id=source_paper.id order by rule_order,id
    loop
      insert into public.paper_blueprints(
        paper_id,section_id,rule_order,subject_id,chapter_id,topic_id,difficulty,
        question_type,positive_marks,negative_marks,estimated_seconds_min,
        estimated_seconds_max,language,required_tags,excluded_question_ids,
        previous_usage_rule,requested_count,selected_count,locked_count,
        availability_count,rule_status,metadata
      ) values (
        target_paper,nullif(section_map->>source_blueprint.section_id::text,'')::uuid,
        source_blueprint.rule_order,source_blueprint.subject_id,source_blueprint.chapter_id,
        source_blueprint.topic_id,source_blueprint.difficulty,source_blueprint.question_type,
        source_blueprint.positive_marks,source_blueprint.negative_marks,
        source_blueprint.estimated_seconds_min,source_blueprint.estimated_seconds_max,
        source_blueprint.language,source_blueprint.required_tags,
        source_blueprint.excluded_question_ids,source_blueprint.previous_usage_rule,
        source_blueprint.requested_count,0,0,0,'pending',source_blueprint.metadata
      ) returning id into target_blueprint;
      blueprint_map := blueprint_map || jsonb_build_object(source_blueprint.id::text,target_blueprint::text);
    end loop;
  end if;

  if normalized_scope in ('entire','questions') then
    insert into public.paper_questions(
      paper_id,section_id,question_id,display_order,marks,negative_marks,
      original_marks,original_negative_marks,is_mandatory,is_locked,generation_source,
      blueprint_rule_id,shuffle_restricted,position_locked,is_bonus,is_cancelled,
      grace_marks,metadata,question_snapshot
    )
    select
      target_paper,
      nullif(section_map->>source_question.section_id::text,'')::uuid,
      source_question.question_id,source_question.display_order,source_question.marks,
      source_question.negative_marks,source_question.original_marks,
      source_question.original_negative_marks,source_question.is_mandatory,
      source_question.is_locked,source_question.generation_source,
      nullif(blueprint_map->>source_question.blueprint_rule_id::text,'')::uuid,
      source_question.shuffle_restricted,source_question.position_locked,
      source_question.is_bonus,source_question.is_cancelled,source_question.grace_marks,
      source_question.metadata,source_question.question_snapshot
    from public.paper_questions source_question
    where source_question.paper_id=source_paper.id;
  end if;

  select count(*),coalesce(sum(marks),0)
  into question_count,total_value
  from public.paper_questions where paper_id=target_paper;

  update public.question_papers set
    total_questions=question_count,total_marks=total_value,updated_at=now(),last_saved_at=now()
  where id=target_paper;

  insert into public.paper_audit_history(
    paper_id,actor_id,actor_role,action,new_value
  ) values (
    target_paper,actor,public.current_evidara_role(),'paper.duplicated',
    jsonb_build_object(
      'source_paper_id',source_paper.id,
      'copy_scope',normalized_scope,
      'new_code',target_code,
      'workflow_status','draft'
    )
  );

  return jsonb_build_object(
    'paper_id',target_paper,
    'code',target_code,
    'title',coalesce(nullif(trim(p_new_title),''),source_paper.title||' Copy'),
    'workflow_status','draft',
    'legacy_status','draft',
    'copy_scope',normalized_scope,
    'total_questions',question_count,
    'total_marks',total_value
  );
end
$$;

grant execute on function public.duplicate_question_paper_v8(uuid,text,text) to authenticated,service_role;

create or replace function public.create_paper_version_v8(
  p_source_paper_id uuid,
  p_change_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  source_paper public.question_papers%rowtype;
  duplicate_result jsonb;
  target_id uuid;
  next_version integer;
begin
  select * into source_paper from public.question_papers where id=p_source_paper_id;
  if not found or not public.is_paper_manager_v8(source_paper.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;

  next_version := source_paper.version_number+1;
  duplicate_result := public.duplicate_question_paper_v8(
    p_source_paper_id,'entire',source_paper.title
  );
  target_id := (duplicate_result->>'paper_id')::uuid;

  update public.question_papers set
    parent_paper_id=coalesce(source_paper.parent_paper_id,source_paper.id),
    previous_version_id=source_paper.id,
    version_number=next_version,
    change_summary=nullif(trim(p_change_summary),''),
    workflow_status='draft',status='draft',published_at=null
  where id=target_id;

  insert into public.paper_audit_history(
    paper_id,actor_id,actor_role,action,new_value,reason
  ) values (
    target_id,auth.uid(),public.current_evidara_role(),'paper.version_created',
    jsonb_build_object('previous_paper_id',source_paper.id,'version_number',next_version),
    nullif(trim(p_change_summary),'')
  );

  return duplicate_result || jsonb_build_object(
    'version_number',next_version,
    'previous_paper_id',source_paper.id
  );
end
$$;

grant execute on function public.create_paper_version_v8(uuid,text) to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Validation and workflow transitions. Publishing means the definition is ready
-- for future Product Builder assignment; it does not grant student access.
-- ---------------------------------------------------------------------------
create or replace function public.validate_paper_v8(p_paper_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  paper_record public.question_papers%rowtype;
  critical jsonb := '[]'::jsonb;
  warnings jsonb := '[]'::jsonb;
  selected_subjects integer;
  selected_questions integer;
  selected_sections integer;
  estimated_seconds bigint;
  validation_id uuid;
begin
  select * into paper_record from public.question_papers where id=p_paper_id;
  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;

  select count(*) into selected_subjects from public.paper_subjects where paper_id=p_paper_id;
  select count(*) into selected_questions from public.paper_questions where paper_id=p_paper_id;
  select count(*) into selected_sections from public.paper_sections where paper_id=p_paper_id;
  select coalesce(sum((question_snapshot->>'estimated_seconds')::integer),0)
  into estimated_seconds
  from public.paper_questions where paper_id=p_paper_id;

  if paper_record.programme_code is null then
    critical := critical || jsonb_build_array(jsonb_build_object('code','programme_missing','message','Select one programme for this paper.'));
  end if;
  if selected_subjects=0 then
    critical := critical || jsonb_build_array(jsonb_build_object('code','subjects_missing','message','Select at least one subject.'));
  end if;
  if selected_sections=0 then
    critical := critical || jsonb_build_array(jsonb_build_object('code','sections_missing','message','Create at least one section.'));
  end if;
  if selected_questions=0 then
    critical := critical || jsonb_build_array(jsonb_build_object('code','questions_missing','message','Add at least one approved question.'));
  end if;
  if paper_record.duration_minutes is null or paper_record.duration_minutes<1 then
    critical := critical || jsonb_build_array(jsonb_build_object('code','duration_missing','message','Set the paper duration.'));
  end if;
  if paper_record.code is null then
    critical := critical || jsonb_build_array(jsonb_build_object('code','paper_code_missing','message','Generate or enter a paper code.'));
  end if;
  if exists(
    select 1 from public.paper_sections section
    where section.paper_id=p_paper_id
      and not section.is_optional
      and not exists(select 1 from public.paper_questions item where item.section_id=section.id)
  ) then
    critical := critical || jsonb_build_array(jsonb_build_object('code','empty_compulsory_section','message','A compulsory section has no questions.'));
  end if;
  if exists(
    select 1 from public.paper_questions item
    join public.questions question on question.id=item.question_id
    where item.paper_id=p_paper_id and question.status::text<>'approved'
  ) then
    critical := critical || jsonb_build_array(jsonb_build_object('code','unapproved_question','message','The paper contains a question that is no longer approved.'));
  end if;
  if exists(
    select 1 from public.paper_questions item
    where item.paper_id=p_paper_id
      and coalesce(jsonb_array_length(item.question_snapshot->'options'),0)=0
      and coalesce(item.question_snapshot->>'question_type','') not in ('numerical','integer')
  ) then
    critical := critical || jsonb_build_array(jsonb_build_object('code','answer_options_missing','message','A non-numerical question has no answer options.'));
  end if;
  if exists(
    select 1 from public.paper_questions item
    where item.paper_id=p_paper_id
      and nullif(trim(coalesce(item.question_snapshot->>'correct_answer','')),'') is null
  ) then
    critical := critical || jsonb_build_array(jsonb_build_object('code','correct_answer_missing','message','A selected question has no correct answer.'));
  end if;
  if exists(
    select 1 from public.paper_blueprints blueprint
    where blueprint.paper_id=p_paper_id
      and blueprint.requested_count>blueprint.availability_count
  ) then
    critical := critical || jsonb_build_array(jsonb_build_object('code','blueprint_shortage','message','One or more blueprint rules request more questions than are available.'));
  end if;
  if exists(
    select 1 from public.paper_sections section
    where section.paper_id=p_paper_id
      and section.questions_to_attempt is not null
      and section.questions_to_attempt>(select count(*) from public.paper_questions item where item.section_id=section.id)
  ) then
    critical := critical || jsonb_build_array(jsonb_build_object('code','section_attempt_mismatch','message','A section asks students to answer more questions than it contains.'));
  end if;

  if exists(
    select 1 from public.paper_questions item
    where item.paper_id=p_paper_id
      and nullif(trim(coalesce(item.question_snapshot->>'solution_text','')),'') is null
      and nullif(trim(coalesce(item.question_snapshot->>'solution_latex','')),'') is null
  ) then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code','solution_missing','message','One or more questions have no solution.'));
  end if;
  if exists(
    select 1 from public.paper_questions item
    where item.paper_id=p_paper_id and item.question_snapshot->>'topic_id' is null
  ) then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code','topic_missing','message','One or more questions have no topic classification.'));
  end if;
  if exists(
    select 1 from public.paper_questions item
    where item.paper_id=p_paper_id and item.question_snapshot->>'estimated_seconds' is null
  ) then
    warnings := warnings || jsonb_build_array(jsonb_build_object('code','estimated_time_missing','message','One or more questions have no estimated solving time.'));
  end if;
  if estimated_seconds > (paper_record.duration_minutes+paper_record.reading_time_minutes+paper_record.grace_time_minutes)*60*1.15 then
    warnings := warnings || jsonb_build_array(jsonb_build_object(
      'code','duration_pressure',
      'message','Estimated solving time is significantly longer than the configured duration.',
      'estimated_minutes',ceil(estimated_seconds/60.0),
      'configured_minutes',paper_record.duration_minutes
    ));
  end if;

  insert into public.paper_validation_results(
    paper_id,critical_errors,warnings,validated_by
  ) values (p_paper_id,critical,warnings,auth.uid()) returning id into validation_id;

  update public.question_papers set
    validation_summary=jsonb_build_object(
      'validation_id',validation_id,
      'critical',critical,
      'warnings',warnings,
      'validated_at',now()
    ),updated_at=now()
  where id=p_paper_id;

  return jsonb_build_object(
    'validation_id',validation_id,
    'valid',jsonb_array_length(critical)=0,
    'critical',critical,
    'warnings',warnings,
    'summary',jsonb_build_object(
      'sections',selected_sections,
      'subjects',selected_subjects,
      'questions',selected_questions,
      'maximum_marks',paper_record.total_marks,
      'configured_duration_minutes',paper_record.duration_minutes,
      'estimated_solving_minutes',ceil(estimated_seconds/60.0)
    )
  );
end
$$;

grant execute on function public.validate_paper_v8(uuid) to authenticated,service_role;

create or replace function public.set_paper_workflow_status_v8(
  p_paper_id uuid,
  p_next_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  paper_record public.question_papers%rowtype;
  next_status text := lower(trim(p_next_status));
  validation jsonb;
  actor_role text := public.current_evidara_role();
begin
  if next_status not in (
    'draft','submitted_for_review','changes_requested','approved','published','paused','closed','archived'
  ) then
    raise exception 'Unsupported paper status.' using errcode='22023';
  end if;

  select * into paper_record from public.question_papers where id=p_paper_id for update;
  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;

  if next_status in ('approved','published')
     and actor_role not in ('super_admin','evidara_admin','admin','platform_admin','reviewer','content_reviewer') then
    raise exception 'You do not have permission to approve or publish paper definitions.' using errcode='42501';
  end if;

  if next_status='published' then
    validation := public.validate_paper_v8(p_paper_id);
    if not coalesce((validation->>'valid')::boolean,false) then
      raise exception 'Resolve all critical validation errors before publishing.' using errcode='23514';
    end if;
  end if;

  update public.question_papers set
    workflow_status=next_status,
    status=case
      when next_status='published' then 'published'::public.paper_status
      when next_status='archived' then 'archived'::public.paper_status
      else 'draft'::public.paper_status
    end,
    published_at=case when next_status='published' then coalesce(published_at,now()) else published_at end,
    updated_by=auth.uid(),updated_at=now()
  where id=p_paper_id;

  insert into public.paper_audit_history(
    paper_id,actor_id,actor_role,action,previous_value,new_value,reason
  ) values (
    p_paper_id,auth.uid(),actor_role,'paper.status_changed',
    jsonb_build_object('workflow_status',paper_record.workflow_status),
    jsonb_build_object('workflow_status',next_status),nullif(trim(p_reason),'')
  );

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'workflow_status',next_status,
    'definition_published',next_status='published',
    'student_access_created',false,
    'product_created',false
  );
end
$$;

grant execute on function public.set_paper_workflow_status_v8(uuid,text,text) to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- RLS. Existing question_papers policies remain; V8 child tables use the same
-- manager/reviewer boundary and do not expose content to students.
-- ---------------------------------------------------------------------------
alter table public.paper_programmes enable row level security;
alter table public.paper_subjects enable row level security;
alter table public.paper_versions enable row level security;
alter table public.paper_blueprints enable row level security;
alter table public.paper_generation_runs enable row level security;
alter table public.paper_templates enable row level security;
alter table public.paper_reviews enable row level security;
alter table public.paper_review_comments enable row level security;
alter table public.paper_validation_results enable row level security;
alter table public.paper_audit_history enable row level security;

drop policy if exists paper_programmes_authenticated_read on public.paper_programmes;
create policy paper_programmes_authenticated_read on public.paper_programmes
for select to authenticated using (is_active=true or public.is_evidara_platform_admin());

drop policy if exists paper_programmes_platform_manage on public.paper_programmes;
create policy paper_programmes_platform_manage on public.paper_programmes
for all to authenticated using (public.is_evidara_platform_admin())
with check (public.is_evidara_platform_admin());

drop policy if exists paper_subjects_staff_all on public.paper_subjects;
create policy paper_subjects_staff_all on public.paper_subjects
for all to authenticated
using (public.is_paper_manager_v8((select organization_id from public.question_papers where id=paper_id)))
with check (public.is_paper_manager_v8((select organization_id from public.question_papers where id=paper_id)));

drop policy if exists paper_versions_staff_all on public.paper_versions;
create policy paper_versions_staff_all on public.paper_versions
for all to authenticated
using (public.is_paper_manager_v8((select organization_id from public.question_papers where id=paper_id)))
with check (public.is_paper_manager_v8((select organization_id from public.question_papers where id=paper_id)));

drop policy if exists paper_blueprints_staff_all on public.paper_blueprints;
create policy paper_blueprints_staff_all on public.paper_blueprints
for all to authenticated
using (public.is_paper_manager_v8((select organization_id from public.question_papers where id=paper_id)))
with check (public.is_paper_manager_v8((select organization_id from public.question_papers where id=paper_id)));

drop policy if exists paper_generation_runs_staff_read on public.paper_generation_runs;
create policy paper_generation_runs_staff_read on public.paper_generation_runs
for select to authenticated
using (public.is_paper_manager_v8((select organization_id from public.question_papers where id=paper_id)));

drop policy if exists paper_templates_staff_all on public.paper_templates;
create policy paper_templates_staff_all on public.paper_templates
for all to authenticated
using (public.is_paper_manager_v8(organization_id))
with check (public.is_paper_manager_v8(organization_id));

drop policy if exists paper_reviews_reviewer_all on public.paper_reviews;
create policy paper_reviews_reviewer_all on public.paper_reviews
for all to authenticated
using (public.is_paper_reviewer_v8((select organization_id from public.question_papers where id=paper_id)))
with check (public.is_paper_reviewer_v8((select organization_id from public.question_papers where id=paper_id)));

drop policy if exists paper_review_comments_reviewer_all on public.paper_review_comments;
create policy paper_review_comments_reviewer_all on public.paper_review_comments
for all to authenticated
using (public.is_paper_reviewer_v8((select organization_id from public.question_papers where id=paper_id)))
with check (public.is_paper_reviewer_v8((select organization_id from public.question_papers where id=paper_id)));

drop policy if exists paper_validation_results_staff_read on public.paper_validation_results;
create policy paper_validation_results_staff_read on public.paper_validation_results
for select to authenticated
using (public.is_paper_manager_v8((select organization_id from public.question_papers where id=paper_id)));

drop policy if exists paper_audit_history_staff_read on public.paper_audit_history;
create policy paper_audit_history_staff_read on public.paper_audit_history
for select to authenticated
using (public.is_paper_reviewer_v8((select organization_id from public.question_papers where id=paper_id)));

grant select on public.paper_programmes to authenticated,service_role;
grant select,insert,update,delete on public.paper_subjects to authenticated,service_role;
grant select,insert,update,delete on public.paper_versions to authenticated,service_role;
grant select,insert,update,delete on public.paper_blueprints to authenticated,service_role;
grant select on public.paper_generation_runs to authenticated;
grant select,insert,update,delete on public.paper_generation_runs to service_role;
grant select,insert,update,delete on public.paper_templates to authenticated,service_role;
grant select,insert,update,delete on public.paper_reviews to authenticated,service_role;
grant select,insert,update,delete on public.paper_review_comments to authenticated,service_role;
grant select on public.paper_validation_results to authenticated;
grant select,insert,update,delete on public.paper_validation_results to service_role;
grant select on public.paper_audit_history to authenticated;
grant select,insert,update,delete on public.paper_audit_history to service_role;

commit;
