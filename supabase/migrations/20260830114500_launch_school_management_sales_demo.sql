alter table public.organizations
  add column if not exists address_line1 text,
  add column if not exists address_line2 text,
  add column if not exists postal_code text,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists secondary_phone text,
  add column if not exists website text,
  add column if not exists is_demo boolean not null default false;

alter table public.school_subscriptions
  add column if not exists annual_price_per_student_paise integer not null default 19900,
  add column if not exists manual_amount_paise integer,
  add column if not exists payment_date date,
  add column if not exists payment_method text,
  add column if not exists invoice_reference text,
  add column if not exists payment_notes text,
  add column if not exists payment_status text not null default 'unpaid';

create table if not exists public.sales_demo_students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_no integer not null,
  full_name text not null,
  email text,
  grade integer not null,
  section_code text not null,
  academic_year text not null default '2026-27',
  exam_track text not null,
  board text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique(organization_id, student_no)
);

create table if not exists public.sales_demo_tests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  test_type text not null,
  exam_type text not null,
  subject_name text,
  chapter_name text,
  topic_name text,
  question_count integer not null,
  maximum_marks numeric not null,
  duration_minutes integer not null,
  conducted_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_demo_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.sales_demo_students(id) on delete cascade,
  test_id uuid not null references public.sales_demo_tests(id) on delete cascade,
  score numeric not null,
  maximum_marks numeric not null,
  percentage numeric not null,
  correct_count integer not null,
  incorrect_count integer not null,
  unanswered_count integer not null,
  time_spent_seconds integer not null,
  submitted_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(student_id, test_id)
);

create index if not exists sales_demo_students_org_idx on public.sales_demo_students(organization_id);
create index if not exists sales_demo_tests_org_date_idx on public.sales_demo_tests(organization_id, conducted_at desc);
create index if not exists sales_demo_attempts_org_idx on public.sales_demo_attempts(organization_id);
create index if not exists sales_demo_attempts_student_idx on public.sales_demo_attempts(student_id);
create index if not exists sales_demo_attempts_test_idx on public.sales_demo_attempts(test_id);

alter table public.sales_demo_students enable row level security;
alter table public.sales_demo_tests enable row level security;
alter table public.sales_demo_attempts enable row level security;

revoke all on public.sales_demo_students from anon, authenticated;
revoke all on public.sales_demo_tests from anon, authenticated;
revoke all on public.sales_demo_attempts from anon, authenticated;
grant all on public.sales_demo_students to service_role;
grant all on public.sales_demo_tests to service_role;
grant all on public.sales_demo_attempts to service_role;
