-- Phase 1 D7: student access to institutional papers must come only from the normalized assignment model.

create or replace function public.paper_assignment_allows_student_v19(
  p_paper_id uuid,
  p_student_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'auth'
as $function$
  select exists(
    select 1
    from public.paper_student_assignments assignment
    join public.question_papers paper on paper.id = assignment.paper_id
    join public.student_school_memberships membership on membership.id = assignment.membership_id
    where assignment.paper_id = p_paper_id
      and assignment.student_id = p_student_id
      and assignment.status = 'assigned'
      and paper.organization_id is not null
      and assignment.organization_id = paper.organization_id
      and membership.organization_id = paper.organization_id
      and membership.student_id = p_student_id
      and membership.status::text = 'active'
  );
$function$;

comment on function public.paper_assignment_allows_student_v19(uuid,uuid) is
  'D7 normalized institutional-paper access check. Requires an explicit active paper_student_assignments row tied to the student active membership; there is no legacy settings or institution-wide fallback.';

alter function public.paper_assignment_allows_student_v19(uuid,uuid) owner to postgres;
revoke all on function public.paper_assignment_allows_student_v19(uuid,uuid) from public, anon;
grant execute on function public.paper_assignment_allows_student_v19(uuid,uuid) to authenticated, service_role;

drop policy if exists papers_read_v14 on public.question_papers;
create policy papers_read_v14
on public.question_papers
for select
to authenticated
using (
  public.is_super_admin()
  or (
    public.current_evidara_role() = any(array['evidara_admin'::text,'admin'::text,'platform_admin'::text])
    and organization_id is null
  )
  or (
    organization_id is not null
    and public.is_evidara_school_manager(organization_id)
  )
  or (
    organization_id is not null
    and created_by = auth.uid()
    and public.current_evidara_role() = any(array['school_teacher'::text,'teacher'::text,'reviewer'::text,'invigilator'::text])
  )
  or (
    status = 'published'::public.paper_status
    and access_mode = 'public'::public.paper_access_mode
    and public.current_evidara_role() = 'student'::text
  )
  or (
    status = 'published'::public.paper_status
    and access_mode = 'organization'::public.paper_access_mode
    and organization_id is not null
    and public.current_evidara_role() = 'student'::text
    and public.paper_assignment_allows_student_v19(id,auth.uid())
  )
);
