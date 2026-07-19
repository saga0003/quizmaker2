-- Evidara V6: transparent metric definitions, temporary segments and achievements.

create table if not exists public.metric_definition_versions (
  id uuid primary key default gen_random_uuid(),
  metric_key text not null,
  version integer not null default 1,
  display_name text not null,
  definition text not null,
  evaluation_method text not null,
  evidence_minimum text not null,
  why_it_matters text not null,
  responsible_use_note text not null,
  formula jsonb not null default '{}'::jsonb,
  active_from date not null default current_date,
  active_until date,
  created_at timestamptz not null default now(),
  unique(metric_key, version)
);

create table if not exists public.student_segment_snapshots (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  segment_key text not null,
  segment_label text not null,
  rule_version integer not null default 1,
  evidence jsonb not null default '{}'::jsonb,
  recommended_next_action text not null,
  calculated_at timestamptz not null default now(),
  expires_at timestamptz,
  superseded_at timestamptz
);

create table if not exists public.student_achievements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  achievement_key text not null,
  achievement_name text not null,
  evidence_rule_version integer not null default 1,
  evidence jsonb not null default '{}'::jsonb,
  awarded_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  unique(student_id, organization_id, achievement_key, evidence_rule_version)
);

create table if not exists public.student_certificates (
  id uuid primary key default gen_random_uuid(),
  certificate_code text not null unique,
  student_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  certificate_type text not null,
  title text not null,
  evidence_summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null
);

alter table public.metric_definition_versions enable row level security;
alter table public.student_segment_snapshots enable row level security;
alter table public.student_achievements enable row level security;
alter table public.student_certificates enable row level security;

drop policy if exists "metric definitions are readable" on public.metric_definition_versions;
create policy "metric definitions are readable"
  on public.metric_definition_versions for select to authenticated
  using (active_until is null or active_until >= current_date);

drop policy if exists "students read own segments" on public.student_segment_snapshots;
create policy "students read own segments"
  on public.student_segment_snapshots for select to authenticated
  using (student_id = auth.uid());

drop policy if exists "students read own achievements" on public.student_achievements;
create policy "students read own achievements"
  on public.student_achievements for select to authenticated
  using (student_id = auth.uid());

drop policy if exists "students read own certificates" on public.student_certificates;
create policy "students read own certificates"
  on public.student_certificates for select to authenticated
  using (student_id = auth.uid());

comment on table public.student_segment_snapshots is
  'Temporary action groups derived from current evidence. Never use as permanent labels of ability.';
comment on table public.student_achievements is
  'Achievements issued from versioned evidence rules, not promotional judgement.';

insert into public.metric_definition_versions(
  metric_key, version, display_name, definition, evaluation_method,
  evidence_minimum, why_it_matters, responsible_use_note, formula
)
values
 ('trend',1,'Improvement trend','Direction and size of change across repeated comparable assessments.','Latest five comparable assessments; score, accuracy and speed remain separate.','At least three valid comparable assessments.','Distinguishes sustained progress from a one-time mark.','Observation, not prediction; paper difficulty and coverage must be considered.','{"window":5}'::jsonb),
 ('percentile',1,'Percentile','Percentage of valid participants at or below the learner score on the same benchmark.','Exact paper version and valid completed attempts only.','Benchmark privacy minimum must be reached.','Adds cohort context without revealing another learner or school.','Specific to the participating sample; not a whole-student judgement.','{}'::jsonb),
 ('readiness',1,'Readiness index','A navigation summary of current accuracy, mastery coverage, consistency and pacing.','40% accuracy, 25% mastery coverage, 20% consistency and 15% pacing.','At least three assessments and sufficient topic evidence.','Provides a quick overview before inspecting component evidence.','Not a diagnosis or guaranteed future outcome.','{"accuracy":0.4,"mastery":0.25,"consistency":0.2,"pacing":0.15}'::jsonb),
 ('segment',1,'Student segment','A temporary evidence group used to select the next action.','Recent percentile, improvement, consistency and pacing.','At least three comparable assessments.','Supports targeted intervention by shared need.','Never use as a permanent identity or ability label.','{}'::jsonb)
on conflict(metric_key,version) do update set
 display_name=excluded.display_name,
 definition=excluded.definition,
 evaluation_method=excluded.evaluation_method,
 evidence_minimum=excluded.evidence_minimum,
 why_it_matters=excluded.why_it_matters,
 responsible_use_note=excluded.responsible_use_note,
 formula=excluded.formula;
