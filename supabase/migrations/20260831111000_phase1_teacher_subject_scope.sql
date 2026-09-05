-- Phase 1 B6: explicit teacher section + subject scope.
-- Teachers must have an active assignment before institution-scoped teaching work is authorized.

begin;

create or replace function public.is_evidara_teacher_for_scope(
  p_organization_id uuid,
  p_section_id uuid default null,
  p_subject_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_evidara_platform_admin()
    or exists (
      select 1
      from public.organization_members member
      join public.teacher_section_assignments assignment
        on assignment.teacher_id = member.user_id
       and assignment.is_active = true
      join public.academic_sections section_row
        on section_row.id = assignment.section_id
       and section_row.is_active = true
      left join public.subjects subject_row
        on subject_row.id = p_subject_id
       and subject_row.is_active = true
      where member.user_id = (select auth.uid())
        and member.organization_id = p_organization_id
        and member.is_active = true
        and member.member_role::text in ('teacher','school_teacher','reviewer','invigilator')
        and section_row.organization_id = p_organization_id
        and (p_section_id is null or section_row.id = p_section_id)
        and (
          p_subject_id is null
          or (
            subject_row.id is not null
            and (subject_row.organization_id is null or subject_row.organization_id = p_organization_id)
            and (
              lower(btrim(assignment.subject_label)) = 'all subjects'
              or lower(btrim(assignment.subject_label)) = lower(btrim(subject_row.name))
              or lower(btrim(assignment.subject_label)) = lower(btrim(subject_row.code))
            )
          )
        )
    ),
    false
  )
$$;

revoke all on function public.is_evidara_teacher_for_scope(uuid, uuid, uuid) from public, anon;
grant execute on function public.is_evidara_teacher_for_scope(uuid, uuid, uuid) to authenticated;

-- Preserve existing callers while routing them through the canonical scope helper.
create or replace function public.is_evidara_teacher_for_section(
  p_organization_id uuid,
  p_section_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_evidara_teacher_for_scope(p_organization_id, p_section_id, null)
$$;

revoke all on function public.is_evidara_teacher_for_section(uuid, uuid) from public, anon;
grant execute on function public.is_evidara_teacher_for_section(uuid, uuid) to authenticated;

-- Paper ownership is not enough for a teacher: an active school assignment is required.
create or replace function public.is_paper_manager(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_organization_id is null then public.is_super_admin()
    else public.is_super_admin()
      or public.is_evidara_school_manager(p_organization_id)
      or public.is_evidara_teacher_for_scope(p_organization_id, null, null)
  end
$$;

revoke all on function public.is_paper_manager(uuid) from public, anon;
grant execute on function public.is_paper_manager(uuid) to authenticated;

-- Teacher question-bank access is constrained to assigned subjects.
drop policy if exists questions_read_v14 on public.questions;
create policy questions_read_v14 on public.questions
for select to authenticated
using (
  public.is_super_admin()
  or ((public.current_evidara_role() = any(array['evidara_admin','admin','platform_admin'])) and organization_id is null)
  or (organization_id is not null and public.is_evidara_school_manager(organization_id))
  or (
    organization_id is not null
    and public.is_evidara_teacher_for_scope(organization_id, null, subject_id)
    and (created_by = (select auth.uid()) or status::text = 'approved')
  )
);

drop policy if exists questions_insert_v14 on public.questions;
create policy questions_insert_v14 on public.questions
for insert to authenticated
with check (
  ((organization_id is null) and public.current_evidara_role() = any(array['super_admin','evidara_admin','admin','platform_admin']))
  or (organization_id is not null and public.is_evidara_school_manager(organization_id))
  or (
    organization_id is not null
    and created_by = (select auth.uid())
    and public.is_evidara_teacher_for_scope(organization_id, null, subject_id)
  )
);

drop policy if exists questions_update_v14 on public.questions;
create policy questions_update_v14 on public.questions
for update to authenticated
using (
  ((organization_id is null) and public.current_evidara_role() = any(array['super_admin','evidara_admin','admin','platform_admin']))
  or (organization_id is not null and public.is_evidara_school_manager(organization_id))
  or (
    organization_id is not null
    and created_by = (select auth.uid())
    and public.is_evidara_teacher_for_scope(organization_id, null, subject_id)
  )
)
with check (
  ((organization_id is null) and public.current_evidara_role() = any(array['super_admin','evidara_admin','admin','platform_admin']))
  or (organization_id is not null and public.is_evidara_school_manager(organization_id))
  or (
    organization_id is not null
    and created_by = (select auth.uid())
    and public.is_evidara_teacher_for_scope(organization_id, null, subject_id)
  )
);

-- Section creation/editing inside a paper must stay inside the teacher's assigned subject scope.
drop policy if exists paper_sections_manage on public.paper_sections;
create policy paper_sections_manage on public.paper_sections
for all to authenticated
using (
  exists (
    select 1 from public.question_papers p
    where p.id = paper_sections.paper_id
      and (
        public.is_evidara_school_manager(p.organization_id)
        or public.is_super_admin()
        or (
          p.created_by = (select auth.uid())
          and public.is_evidara_teacher_for_scope(p.organization_id, null, paper_sections.subject_id)
        )
      )
  )
)
with check (
  exists (
    select 1 from public.question_papers p
    where p.id = paper_sections.paper_id
      and (
        public.is_evidara_school_manager(p.organization_id)
        or public.is_super_admin()
        or (
          p.created_by = (select auth.uid())
          and public.is_evidara_teacher_for_scope(p.organization_id, null, paper_sections.subject_id)
        )
      )
  )
);

-- Questions added to a paper must match the assigned subject of the containing section.
drop policy if exists paper_questions_manage on public.paper_questions;
create policy paper_questions_manage on public.paper_questions
for all to authenticated
using (
  exists (
    select 1
    from public.question_papers p
    left join public.paper_sections ps on ps.id = paper_questions.section_id and ps.paper_id = p.id
    left join public.questions q on q.id = paper_questions.question_id
    where p.id = paper_questions.paper_id
      and (
        public.is_evidara_school_manager(p.organization_id)
        or public.is_super_admin()
        or (
          p.created_by = (select auth.uid())
          and public.is_evidara_teacher_for_scope(p.organization_id, null, coalesce(ps.subject_id, q.subject_id))
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.question_papers p
    left join public.paper_sections ps on ps.id = paper_questions.section_id and ps.paper_id = p.id
    left join public.questions q on q.id = paper_questions.question_id
    where p.id = paper_questions.paper_id
      and (
        public.is_evidara_school_manager(p.organization_id)
        or public.is_super_admin()
        or (
          p.created_by = (select auth.uid())
          and public.is_evidara_teacher_for_scope(p.organization_id, null, coalesce(ps.subject_id, q.subject_id))
        )
      )
  )
);

comment on function public.is_evidara_teacher_for_scope(uuid, uuid, uuid) is
  'B6 canonical teacher authorization: active organization membership + active section assignment + optional assigned subject match.';

commit;
