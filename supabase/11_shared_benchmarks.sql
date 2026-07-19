-- Evidara V6.5: privacy-first shared-paper benchmarking.
-- Apply after the existing school, assessment and attempt migrations.

create table if not exists public.benchmark_publications (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  publisher_organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  paper_version text not null,
  version_fingerprint text not null,
  grade_label text,
  preparation_track text,
  access_code text not null unique,
  status text not null default 'draft' check (status in ('draft','published','closed','cancelled')),
  privacy_minimum integer not null default 20 check (privacy_minimum >= 20),
  small_cell_minimum integer not null default 10 check (small_cell_minimum >= 10),
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_id, version_fingerprint)
);

create table if not exists public.benchmark_contributions (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.benchmark_publications(id) on delete cascade,
  attempt_id uuid not null references public.attempts(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null,
  score numeric not null,
  maximum_score numeric not null check (maximum_score > 0),
  percentage numeric generated always as ((score / maximum_score) * 100) stored,
  is_valid boolean not null default true,
  exclusion_reason text,
  submitted_at timestamptz not null,
  contributed_at timestamptz not null default now(),
  unique (publication_id, attempt_id)
);

create table if not exists public.benchmark_audit_events (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.benchmark_publications(id) on delete cascade,
  actor_id uuid,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists benchmark_publications_status_idx
  on public.benchmark_publications(status, opens_at, closes_at);
create index if not exists benchmark_contributions_publication_idx
  on public.benchmark_contributions(publication_id, is_valid, submitted_at);
create index if not exists benchmark_contributions_organization_idx
  on public.benchmark_contributions(publication_id, organization_id, is_valid);

alter table public.benchmark_publications enable row level security;
alter table public.benchmark_contributions enable row level security;
alter table public.benchmark_audit_events enable row level security;

-- No direct browser access is granted to contribution rows. Server-side functions
-- return privacy-thresholded aggregates, while a school's named student records
-- continue to come from its own tenant-scoped attempt data.
revoke all on public.benchmark_contributions from anon, authenticated;
revoke all on public.benchmark_audit_events from anon, authenticated;

comment on table public.benchmark_publications is
  'Exact assessment versions approved for anonymous cross-school aggregation.';
comment on table public.benchmark_contributions is
  'Server-only benchmark contribution rows. Never expose directly to browser clients.';
comment on column public.benchmark_publications.version_fingerprint is
  'A change to questions, marks, scoring, duration or answer options requires a new fingerprint and benchmark.';
