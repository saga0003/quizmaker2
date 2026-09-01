alter table public.exam_attempts enable row level security;
alter table public.exam_responses enable row level security;

revoke all on table public.exam_attempts from anon;
revoke all on table public.exam_responses from anon;
revoke insert, update, delete, truncate, references, trigger on table public.exam_attempts from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.exam_responses from authenticated;
grant select on table public.exam_attempts to authenticated;
grant select on table public.exam_responses to authenticated;

drop policy if exists attempts_read on public.exam_attempts;
create policy attempts_read on public.exam_attempts
for select to authenticated
using (
  student_id = auth.uid()
  or exists (
    select 1
    from public.question_papers p
    where p.id = exam_attempts.paper_id
      and (
        public.is_super_admin()
        or (p.organization_id is not null and public.is_evidara_school_manager(p.organization_id))
        or (
          p.organization_id is not null
          and nullif(exam_attempts.enrollment_snapshot ->> 'section_id', '') is not null
          and exists (
            select 1
            from public.paper_sections ps
            where ps.paper_id = p.id
              and ps.subject_id is not null
              and public.is_evidara_teacher_for_scope(
                p.organization_id,
                nullif(exam_attempts.enrollment_snapshot ->> 'section_id', '')::uuid,
                ps.subject_id
              )
          )
        )
      )
  )
);

drop policy if exists responses_read on public.exam_responses;
create policy responses_read on public.exam_responses
for select to authenticated
using (
  exists (
    select 1
    from public.exam_attempts a
    join public.question_papers p on p.id = a.paper_id
    where a.id = exam_responses.attempt_id
      and (
        a.student_id = auth.uid()
        or public.is_super_admin()
        or (p.organization_id is not null and public.is_evidara_school_manager(p.organization_id))
        or (
          p.organization_id is not null
          and nullif(a.enrollment_snapshot ->> 'section_id', '') is not null
          and exists (
            select 1
            from public.paper_questions pq
            join public.paper_sections ps on ps.id = pq.section_id
            where pq.id = exam_responses.paper_question_id
              and pq.paper_id = p.id
              and ps.subject_id is not null
              and public.is_evidara_teacher_for_scope(
                p.organization_id,
                nullif(a.enrollment_snapshot ->> 'section_id', '')::uuid,
                ps.subject_id
              )
          )
        )
      )
  )
);

comment on table public.exam_responses is 'Canonical raw learner response evidence. Browser reads are RLS-scoped to the learner, school manager, super admin, or teacher assigned to the attempt section and response subject. Browser DML is prohibited; saves flow through save_exam_response.';
comment on policy responses_read on public.exam_responses is 'F10: exact raw-response scope; teacher access requires both frozen attempt section and the response paper-section subject assignment.';
