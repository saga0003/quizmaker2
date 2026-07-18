create extension if not exists pgcrypto;

create type public.app_role as enum ('super_admin','org_admin','school_admin','teacher','student','parent');
create type public.consent_purpose as enum ('assessment','academic_updates','programme_counselling');
create type public.question_type as enum ('single_mcq','multiple_mcq','integer','numeric','assertion_reason','matrix_match','descriptive');
create type public.attempt_status as enum ('not_started','in_progress','submitted','evaluated','invalidated');

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  brand jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  city text,
  board text,
  status text not null default 'pilot',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  role public.app_role not null,
  full_name text not null,
  phone text,
  grade text,
  section text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.parent_student_links (
  parent_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  relationship text not null,
  primary key(parent_id,student_id)
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.profiles(id) on delete set null,
  purpose public.consent_purpose not null,
  granted boolean not null,
  verified_method text,
  evidence jsonb not null default '{}'::jsonb,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  unique(student_id,purpose)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  type public.question_type not null,
  board text,
  grade text not null,
  subject text not null,
  chapter text,
  topic text,
  cognitive_skill text,
  difficulty smallint check (difficulty between 1 and 5),
  expected_seconds integer,
  stem jsonb not null,
  options jsonb,
  answer_key jsonb not null,
  solution jsonb,
  source_record jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.assessments (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  title text not null,
  grade text not null,
  mode text not null default 'cbt',
  blueprint jsonb not null,
  settings jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.assessment_questions (
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  position integer not null,
  marks numeric not null default 4,
  negative_marks numeric not null default 0,
  primary key(assessment_id,question_id)
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status public.attempt_status not null default 'not_started',
  started_at timestamptz,
  submitted_at timestamptz,
  score numeric,
  max_score numeric,
  percentile numeric,
  analytics jsonb not null default '{}'::jsonb,
  unique(assessment_id,student_id)
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  response jsonb,
  is_correct boolean,
  marks_awarded numeric,
  seconds_spent integer,
  answer_changes integer not null default 0,
  error_type text,
  unique(attempt_id,question_id)
);

create table public.mastery_snapshots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  chapter text,
  topic text,
  mastery numeric not null check (mastery between 0 and 1),
  confidence numeric not null check (confidence between 0 and 1),
  evidence_count integer not null,
  calculated_at timestamptz not null default now()
);

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  title text not null,
  diagnosis jsonb not null,
  plan jsonb not null,
  owner_id uuid references public.profiles(id) on delete set null,
  status text not null default 'planned',
  created_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  source_assessment_id uuid references public.assessments(id) on delete set null,
  academic_segment text,
  interest text,
  engagement_score numeric,
  counselling_consent_id uuid not null references public.consents(id) on delete restrict,
  crm_status text not null default 'new',
  crm_external_id text,
  created_at timestamptz not null default now()
);

create index on public.profiles(school_id,grade,section);
create index on public.questions(grade,subject,chapter,topic);
create index on public.attempts(student_id,submitted_at desc);
create index on public.responses(attempt_id,question_id);
create index on public.mastery_snapshots(student_id,subject,topic);

alter table public.organisations enable row level security;
alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.questions enable row level security;
alter table public.assessments enable row level security;
alter table public.attempts enable row level security;
alter table public.responses enable row level security;
alter table public.mastery_snapshots enable row level security;
alter table public.interventions enable row level security;
alter table public.opportunities enable row level security;

-- Tenant-aware RLS policies and server-side consent enforcement must be added before production data is inserted.
