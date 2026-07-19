-- ScholarOS V3: cloud synchronization bridge, audit trail and tenant RLS.
-- Apply after supabase/schema.sql.

create table if not exists public.workspace_snapshots (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  scope text not null default 'organisation' check (scope in ('organisation')),
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organisation_id, scope)
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  organisation_id uuid references public.organisations(id) on delete cascade,
  school_id uuid references public.schools(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists workspace_snapshots_org_idx on public.workspace_snapshots(organisation_id, scope);
create index if not exists audit_events_org_created_idx on public.audit_events(organisation_id, created_at desc);

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select p.role from public.profiles p where p.id = auth.uid() limit 1 $$;

create or replace function public.current_organisation_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select p.organisation_id from public.profiles p where p.id = auth.uid() limit 1 $$;

create or replace function public.current_school_id()
returns uuid
language sql stable security definer set search_path = public
as $$ select p.school_id from public.profiles p where p.id = auth.uid() limit 1 $$;

create or replace function public.is_org_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(public.current_app_role() in ('super_admin','org_admin'), false) $$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare requested_role public.app_role;
begin
  begin
    requested_role := coalesce((new.raw_user_meta_data->>'role')::public.app_role, 'student');
  exception when others then requested_role := 'student';
  end;
  insert into public.profiles(id, organisation_id, school_id, role, full_name, phone, grade, section, metadata)
  values (
    new.id,
    nullif(new.raw_user_meta_data->>'organisation_id','')::uuid,
    nullif(new.raw_user_meta_data->>'school_id','')::uuid,
    requested_role,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email,''),'@',1), 'User'),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'grade',
    new.raw_user_meta_data->>'section',
    coalesce(new.raw_user_meta_data, '{}'::jsonb)
  ) on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

alter table public.parent_student_links enable row level security;
alter table public.assessment_questions enable row level security;
alter table public.workspace_snapshots enable row level security;
alter table public.audit_events enable row level security;

-- Organisations
drop policy if exists organisations_select on public.organisations;
create policy organisations_select on public.organisations for select using (id = public.current_organisation_id());

-- Schools
drop policy if exists schools_select on public.schools;
create policy schools_select on public.schools for select using (
  organisation_id = public.current_organisation_id()
  and (public.is_org_admin() or id = public.current_school_id())
);
drop policy if exists schools_admin_write on public.schools;
create policy schools_admin_write on public.schools for all using (public.is_org_admin() and organisation_id = public.current_organisation_id()) with check (public.is_org_admin() and organisation_id = public.current_organisation_id());

-- Profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or (public.is_org_admin() and organisation_id = public.current_organisation_id())
  or (public.current_app_role() in ('school_admin','teacher') and school_id = public.current_school_id())
  or (public.current_app_role() = 'parent' and exists (select 1 from public.parent_student_links l where l.parent_id = auth.uid() and l.student_id = profiles.id))
);
drop policy if exists profiles_admin_update on public.profiles;
create policy profiles_admin_update on public.profiles for update using (
  id = auth.uid() or (public.is_org_admin() and organisation_id = public.current_organisation_id()) or (public.current_app_role() = 'school_admin' and school_id = public.current_school_id())
) with check (
  id = auth.uid() or (public.is_org_admin() and organisation_id = public.current_organisation_id()) or (public.current_app_role() = 'school_admin' and school_id = public.current_school_id())
);

-- Parent/student links
drop policy if exists parent_links_select on public.parent_student_links;
create policy parent_links_select on public.parent_student_links for select using (parent_id = auth.uid() or student_id = auth.uid() or public.is_org_admin());

-- Consent
drop policy if exists consents_select on public.consents;
create policy consents_select on public.consents for select using (
  student_id = auth.uid() or parent_id = auth.uid() or public.is_org_admin()
  or (public.current_app_role() in ('school_admin','teacher') and exists (select 1 from public.profiles s where s.id = consents.student_id and s.school_id = public.current_school_id()))
);
drop policy if exists consents_parent_write on public.consents;
create policy consents_parent_write on public.consents for all using (parent_id = auth.uid() or public.is_org_admin()) with check (parent_id = auth.uid() or public.is_org_admin());

-- Questions: staff only. Students receive redacted questions through Vercel APIs.
drop policy if exists questions_staff_select on public.questions;
create policy questions_staff_select on public.questions for select using (
  organisation_id = public.current_organisation_id() and public.current_app_role() in ('super_admin','org_admin','school_admin','teacher')
);
drop policy if exists questions_admin_write on public.questions;
create policy questions_admin_write on public.questions for all using (
  organisation_id = public.current_organisation_id() and public.current_app_role() in ('super_admin','org_admin')
) with check (organisation_id = public.current_organisation_id() and public.current_app_role() in ('super_admin','org_admin'));

-- Assessments and assessment questions
drop policy if exists assessments_select on public.assessments;
create policy assessments_select on public.assessments for select using (
  organisation_id = public.current_organisation_id() and (school_id is null or school_id = public.current_school_id() or public.is_org_admin())
);
drop policy if exists assessments_admin_write on public.assessments;
create policy assessments_admin_write on public.assessments for all using (
  organisation_id = public.current_organisation_id() and public.current_app_role() in ('super_admin','org_admin')
) with check (organisation_id = public.current_organisation_id() and public.current_app_role() in ('super_admin','org_admin'));
drop policy if exists assessment_questions_staff_select on public.assessment_questions;
create policy assessment_questions_staff_select on public.assessment_questions for select using (
  exists (select 1 from public.assessments a where a.id = assessment_questions.assessment_id and a.organisation_id = public.current_organisation_id())
  and public.current_app_role() in ('super_admin','org_admin','school_admin','teacher')
);
drop policy if exists assessment_questions_admin_write on public.assessment_questions;
create policy assessment_questions_admin_write on public.assessment_questions for all using (public.is_org_admin()) with check (public.is_org_admin());

-- Attempts and responses
drop policy if exists attempts_select on public.attempts;
create policy attempts_select on public.attempts for select using (
  student_id = auth.uid() or public.is_org_admin()
  or (public.current_app_role() in ('school_admin','teacher') and exists (select 1 from public.profiles s where s.id = attempts.student_id and s.school_id = public.current_school_id()))
  or (public.current_app_role() = 'parent' and exists (select 1 from public.parent_student_links l where l.parent_id = auth.uid() and l.student_id = attempts.student_id))
);
drop policy if exists attempts_student_insert on public.attempts;
create policy attempts_student_insert on public.attempts for insert with check (student_id = auth.uid());
drop policy if exists attempts_student_update on public.attempts;
create policy attempts_student_update on public.attempts for update using (student_id = auth.uid()) with check (student_id = auth.uid());

drop policy if exists responses_select on public.responses;
create policy responses_select on public.responses for select using (
  exists (select 1 from public.attempts a where a.id = responses.attempt_id and (
    a.student_id = auth.uid() or public.is_org_admin()
    or (public.current_app_role() in ('school_admin','teacher') and exists (select 1 from public.profiles s where s.id = a.student_id and s.school_id = public.current_school_id()))
  ))
);
drop policy if exists responses_student_write on public.responses;
create policy responses_student_write on public.responses for all using (
  exists (select 1 from public.attempts a where a.id = responses.attempt_id and a.student_id = auth.uid())
) with check (exists (select 1 from public.attempts a where a.id = responses.attempt_id and a.student_id = auth.uid()));

-- Mastery and interventions
drop policy if exists mastery_select on public.mastery_snapshots;
create policy mastery_select on public.mastery_snapshots for select using (
  student_id = auth.uid() or public.is_org_admin()
  or (public.current_app_role() in ('school_admin','teacher') and exists (select 1 from public.profiles s where s.id = mastery_snapshots.student_id and s.school_id = public.current_school_id()))
);
drop policy if exists interventions_select on public.interventions;
create policy interventions_select on public.interventions for select using (school_id = public.current_school_id() or public.is_org_admin());
drop policy if exists interventions_staff_write on public.interventions;
create policy interventions_staff_write on public.interventions for all using (
  public.is_org_admin() or (public.current_app_role() in ('school_admin','teacher') and school_id = public.current_school_id())
) with check (public.is_org_admin() or (public.current_app_role() in ('school_admin','teacher') and school_id = public.current_school_id()));

-- Permissioned opportunities
drop policy if exists opportunities_staff_select on public.opportunities;
create policy opportunities_staff_select on public.opportunities for select using (
  public.is_org_admin() or (public.current_app_role() = 'school_admin' and exists (select 1 from public.profiles s where s.id = opportunities.student_id and s.school_id = public.current_school_id()))
);
drop policy if exists opportunities_admin_write on public.opportunities;
create policy opportunities_admin_write on public.opportunities for all using (public.is_org_admin()) with check (public.is_org_admin());

-- Transitional workspace snapshots: direct access is admin read-only; writes occur through authenticated Vercel APIs.
drop policy if exists workspace_admin_select on public.workspace_snapshots;
create policy workspace_admin_select on public.workspace_snapshots for select using (organisation_id = public.current_organisation_id() and public.is_org_admin());

-- Audit events
drop policy if exists audit_admin_select on public.audit_events;
create policy audit_admin_select on public.audit_events for select using (organisation_id = public.current_organisation_id() and public.is_org_admin());
