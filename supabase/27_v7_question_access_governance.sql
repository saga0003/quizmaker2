begin;

-- V7 module visibility is deliberately separate from the broad account role.
-- This lets platform and school administrators enable a workspace with one
-- check mark without weakening the existing table-level RLS policies.
create table if not exists public.module_access_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  role text not null check (
    role in (
      'super_admin',
      'evidara_admin',
      'school_admin',
      'school_teacher',
      'student'
    )
  ),
  module_key text not null check (
    module_key in (
      'questions',
      'papers',
      'students',
      'analytics',
      'resources',
      'achievements',
      'benchmarks',
      'subscriptions'
    )
  ),
  enabled boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  scope_key text generated always as (
    coalesce(organization_id::text, 'platform')
  ) stored,
  unique (scope_key, role, module_key)
);

create index if not exists module_access_settings_lookup_idx
  on public.module_access_settings (scope_key, role, module_key, enabled);

alter table public.module_access_settings enable row level security;

drop policy if exists module_access_settings_read_authenticated
  on public.module_access_settings;
create policy module_access_settings_read_authenticated
  on public.module_access_settings
  for select
  to authenticated
  using (true);

-- Writes are made through the authenticated server API with the service-role
-- client after the requester's profile and school membership are verified.
revoke insert, update, delete on public.module_access_settings
  from anon, authenticated;
grant select on public.module_access_settings to authenticated, service_role;
grant insert, update, delete on public.module_access_settings to service_role;

-- Keep timestamps reliable even when a row is changed through the server API.
drop trigger if exists module_access_settings_set_updated_at
  on public.module_access_settings;
create trigger module_access_settings_set_updated_at
before update on public.module_access_settings
for each row execute function public.set_updated_at();

-- Default platform matrix. Students can never receive the Questions workspace;
-- that hard boundary is also enforced by the helper below and the server API.
insert into public.module_access_settings (
  organization_id,
  role,
  module_key,
  enabled
)
select
  null,
  role_name,
  module_name,
  case
    when role_name = 'student' and module_name = 'questions' then false
    when role_name = 'school_teacher' and module_name in ('subscriptions', 'students') then false
    else true
  end
from unnest(array[
  'super_admin',
  'evidara_admin',
  'school_admin',
  'school_teacher',
  'student'
]) as role_name
cross join unnest(array[
  'questions',
  'papers',
  'students',
  'analytics',
  'resources',
  'achievements',
  'benchmarks',
  'subscriptions'
]) as module_name
on conflict (scope_key, role, module_key) do nothing;

create or replace function public.evidara_module_enabled(
  p_role text,
  p_module_key text,
  p_organization_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  normalized_role text := lower(btrim(coalesce(p_role, 'student')));
  normalized_module text := lower(btrim(coalesce(p_module_key, '')));
  result boolean;
begin
  if normalized_role = 'student' and normalized_module = 'questions' then
    return false;
  end if;

  if normalized_role in ('super_admin', 'evidara_admin') then
    return true;
  end if;

  if p_organization_id is not null then
    select setting.enabled
    into result
    from public.module_access_settings setting
    where setting.organization_id = p_organization_id
      and setting.role = normalized_role
      and setting.module_key = normalized_module
    limit 1;

    if result is not null then
      return result;
    end if;
  end if;

  select setting.enabled
  into result
  from public.module_access_settings setting
  where setting.organization_id is null
    and setting.role = normalized_role
    and setting.module_key = normalized_module
  limit 1;

  if result is not null then
    return result;
  end if;

  return case
    when normalized_module = 'questions'
      then normalized_role in (
        'super_admin',
        'evidara_admin',
        'school_admin',
        'school_teacher'
      )
    else true
  end;
end
$$;

revoke all on function public.evidara_module_enabled(text, text, uuid)
  from public, anon;
grant execute on function public.evidara_module_enabled(text, text, uuid)
  to authenticated, service_role;

-- Import batches make every bulk operation traceable without storing the
-- uploaded document itself or exposing its contents to unrelated schools.
create table if not exists public.question_import_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  file_name text not null,
  source_format text not null check (
    source_format in ('csv', 'xlsx', 'xls', 'docx', 'pdf', 'tex', 'txt', 'json', 'image_zip')
  ),
  status text not null default 'validating' check (
    status in ('validating', 'ready', 'importing', 'completed', 'completed_with_errors', 'failed')
  ),
  total_rows integer not null default 0 check (total_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  failed_rows integer not null default 0 check (failed_rows >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists question_import_batches_scope_idx
  on public.question_import_batches (organization_id, created_at desc);
create index if not exists question_import_batches_creator_idx
  on public.question_import_batches (created_by, created_at desc);

alter table public.question_import_batches enable row level security;

drop policy if exists question_import_batches_read_own_or_platform
  on public.question_import_batches;
create policy question_import_batches_read_own_or_platform
  on public.question_import_batches
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or public.is_evidara_platform_admin()
    or (
      organization_id is not null
      and public.is_evidara_school_staff(organization_id)
    )
  );

revoke insert, update, delete on public.question_import_batches
  from anon, authenticated;
grant select on public.question_import_batches to authenticated, service_role;
grant insert, update, delete on public.question_import_batches to service_role;

-- Test-type and school-bank filters use metadata so the existing save_question
-- contract and every earlier paper/attempt remain backward compatible.
create index if not exists questions_metadata_test_type_idx
  on public.questions ((metadata ->> 'test_type'));
create index if not exists questions_organization_updated_idx
  on public.questions (organization_id, updated_at desc);

commit;
