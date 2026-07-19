-- Evidara V6.5/V6.6: privacy-first shared-paper benchmarking.
-- Apply after 10_cloud_school_platform.sql and the Version 4 exam-builder migration.

create table if not exists public.benchmark_publications (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  publisher_organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  paper_version text not null,
  version_fingerprint text not null,
  grade_label text,
  preparation_track text,
  access_code text not null unique,
  status text not null default 'draft' check (status in ('draft','published','closed','cancelled')),
  privacy_minimum integer not null default 20 check (privacy_minimum >= 20),
  privacy_minimum_schools integer not null default 3 check (privacy_minimum_schools >= 2),
  small_cell_minimum integer not null default 10 check (small_cell_minimum >= 10),
  max_violation_count integer not null default 5 check (max_violation_count >= 0),
  opens_at timestamptz,
  closes_at timestamptz,
  published_at timestamptz,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at),
  unique (paper_id, version_fingerprint)
);

create table if not exists public.benchmark_contributions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.benchmark_publications(id) on delete cascade,
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  attempt_number integer not null default 1,
  score numeric not null,
  maximum_score numeric not null check (maximum_score > 0),
  percentage numeric generated always as ((score / maximum_score) * 100) stored,
  is_valid boolean not null default true,
  exclusion_reason text,
  violation_count integer not null default 0,
  source_fingerprint text not null,
  submitted_at timestamptz not null,
  contributed_at timestamptz not null default now(),
  unique (publication_id, attempt_id),
  unique (publication_id, student_id)
);

create table if not exists public.benchmark_audit_events (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.benchmark_publications(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists benchmark_publications_status_idx
  on public.benchmark_publications(status, opens_at, closes_at);
create index if not exists benchmark_publications_paper_idx
  on public.benchmark_publications(paper_id, status);
create index if not exists benchmark_contributions_publication_idx
  on public.benchmark_contributions(publication_id, is_valid, submitted_at);
create index if not exists benchmark_contributions_organization_idx
  on public.benchmark_contributions(publication_id, organization_id, is_valid);

alter table public.benchmark_publications enable row level security;
alter table public.benchmark_contributions enable row level security;
alter table public.benchmark_audit_events enable row level security;

-- Browser clients never receive raw contribution rows. Authenticated users reach
-- publication metadata and privacy-thresholded summaries through server APIs.
revoke all on public.benchmark_publications from anon, authenticated;
revoke all on public.benchmark_contributions from anon, authenticated;
revoke all on public.benchmark_audit_events from anon, authenticated;

comment on table public.benchmark_publications is
  'Exact question-paper versions approved for anonymous cross-school aggregation.';
comment on table public.benchmark_contributions is
  'Server-only attempt contributions. Never expose directly to browser clients.';
comment on column public.benchmark_publications.version_fingerprint is
  'Any question, mark, scoring, option or duration change requires a new fingerprint and benchmark.';
