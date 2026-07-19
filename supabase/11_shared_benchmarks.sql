-- Evidara V6: shared-paper benchmarks.
-- The public benchmark exposes aggregate evidence only. Individual attempt rows remain private.

create table if not exists public.shared_paper_benchmarks (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  owner_organization_id uuid not null references public.organizations(id) on delete cascade,
  share_token uuid not null default gen_random_uuid() unique,
  paper_version integer not null default 1 check (paper_version > 0),
  title text not null,
  is_active boolean not null default false,
  minimum_sample_size integer not null default 20 check (minimum_sample_size >= 20),
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (paper_id, paper_version)
);

create table if not exists public.benchmark_attempt_facts (
  id uuid primary key default gen_random_uuid(),
  benchmark_id uuid not null references public.shared_paper_benchmarks(id) on delete cascade,
  attempt_key text not null,
  student_id uuid references public.profiles(id) on delete set null,
  organization_id uuid references public.organizations(id) on delete set null,
  score numeric(10,2) not null,
  max_marks numeric(10,2) not null check (max_marks > 0),
  accuracy numeric(5,2) check (accuracy between 0 and 100),
  duration_seconds integer check (duration_seconds >= 0),
  is_valid boolean not null default true,
  invalid_reason text,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (benchmark_id, attempt_key)
);

create index if not exists benchmark_attempt_facts_benchmark_valid_idx on public.benchmark_attempt_facts(benchmark_id,is_valid,submitted_at);
create index if not exists benchmark_attempt_facts_school_idx on public.benchmark_attempt_facts(benchmark_id,organization_id);
alter table public.shared_paper_benchmarks enable row level security;
alter table public.benchmark_attempt_facts enable row level security;

drop policy if exists "active benchmark metadata is readable" on public.shared_paper_benchmarks;
create policy "active benchmark metadata is readable" on public.shared_paper_benchmarks for select using(is_active=true and(opens_at is null or opens_at<=now())and(closes_at is null or closes_at>=now()));

-- There is intentionally no client insert/select/update/delete policy on attempt facts.
-- Migration 15 records a fact only after verifying an authenticated completed exam attempt.
drop policy if exists "students may insert own benchmark facts" on public.benchmark_attempt_facts;
revoke select,insert,update,delete,truncate,references,trigger on public.benchmark_attempt_facts from anon,authenticated;

comment on table public.shared_paper_benchmarks is 'Shareable exact paper versions. Never publish a school leaderboard from this table.';
comment on table public.benchmark_attempt_facts is 'Private, server-derived completed-attempt facts used only for aggregate benchmark calculations.';
