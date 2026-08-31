-- Evidara Phase 1 C7: institution question-bank collaboration boundaries.
-- Teachers may read approved questions in assigned subjects plus their own work,
-- create/edit only their own draft/rejected work, and submit it for review.
-- School managers/reviewers retain institution-wide review authority.

create or replace function public.enforce_institution_question_collaboration_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := coalesce(new.organization_id, old.organization_id);
  v_subject uuid := coalesce(new.subject_id, old.subject_id);
begin
  -- Trusted service/migration work is governed by its own server authorization layer.
  if v_user is null or v_org is null then
    return new;
  end if;

  if public.is_evidara_school_manager(v_org) or public.can_review_org_question(v_org) then
    return new;
  end if;

  if not public.is_evidara_teacher_for_scope(v_org, null::uuid, v_subject) then
    raise exception 'Question edit is outside the teacher assigned subject scope.';
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is distinct from v_user then
      raise exception 'Teachers may create only their own questions.';
    end if;
    if new.status not in ('draft'::public.question_status, 'in_review'::public.question_status) then
      raise exception 'Teachers may create a draft or submit it for review only.';
    end if;
    return new;
  end if;

  if old.created_by is distinct from v_user or new.created_by is distinct from old.created_by then
    raise exception 'Teachers may edit only their own questions.';
  end if;

  if old.organization_id is distinct from new.organization_id then
    raise exception 'Question institution cannot be changed by a teacher.';
  end if;

  if old.status not in ('draft'::public.question_status, 'rejected'::public.question_status) then
    raise exception 'Submitted or approved questions are locked for teacher editing.';
  end if;

  if new.status not in ('draft'::public.question_status, 'in_review'::public.question_status, 'rejected'::public.question_status) then
    raise exception 'Teachers cannot self-approve, archive or otherwise review questions.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_institution_question_collaboration_v1() from public, anon, authenticated;
grant execute on function public.enforce_institution_question_collaboration_v1() to service_role;

drop trigger if exists trg_institution_question_collaboration_v1 on public.questions;
create trigger trg_institution_question_collaboration_v1
before insert or update on public.questions
for each row execute function public.enforce_institution_question_collaboration_v1();

-- Replace broad teacher-manager policies with ownership + assigned-subject collaboration.
drop policy if exists questions_insert_v14 on public.questions;
create policy questions_insert_v15 on public.questions
for insert to authenticated
with check (
  (organization_id is null and current_evidara_role() = any(array['super_admin','evidara_admin','admin','platform_admin']))
  or (organization_id is not null and is_evidara_school_manager(organization_id))
  or (organization_id is not null and can_review_org_question(organization_id))
  or (
    organization_id is not null
    and created_by = auth.uid()
    and status in ('draft'::public.question_status, 'in_review'::public.question_status)
    and is_evidara_teacher_for_scope(organization_id, null::uuid, subject_id)
  )
);

drop policy if exists questions_update_v14 on public.questions;
create policy questions_update_v15 on public.questions
for update to authenticated
using (
  (organization_id is null and current_evidara_role() = any(array['super_admin','evidara_admin','admin','platform_admin']))
  or (organization_id is not null and is_evidara_school_manager(organization_id))
  or (organization_id is not null and can_review_org_question(organization_id))
  or (
    organization_id is not null
    and created_by = auth.uid()
    and status in ('draft'::public.question_status, 'rejected'::public.question_status)
    and is_evidara_teacher_for_scope(organization_id, null::uuid, subject_id)
  )
)
with check (
  (organization_id is null and current_evidara_role() = any(array['super_admin','evidara_admin','admin','platform_admin']))
  or (organization_id is not null and is_evidara_school_manager(organization_id))
  or (organization_id is not null and can_review_org_question(organization_id))
  or (
    organization_id is not null
    and created_by = auth.uid()
    and status in ('draft'::public.question_status, 'in_review'::public.question_status, 'rejected'::public.question_status)
    and is_evidara_teacher_for_scope(organization_id, null::uuid, subject_id)
  )
);

-- Retire legacy option policies that treated every teacher as an institution-wide manager.
drop policy if exists options_read on public.question_options;
drop policy if exists options_manage on public.question_options;
drop policy if exists question_options_v71_parent_visibility on public.question_options;

create policy question_options_read_v15 on public.question_options
for select to authenticated
using (
  exists (
    select 1 from public.questions q
    where q.id = question_options.question_id
      and (
        public.is_super_admin()
        or (q.organization_id is null and current_evidara_role() = any(array['evidara_admin','admin','platform_admin']) and q.status = 'approved'::public.question_status)
        or (q.organization_id is not null and public.is_evidara_school_manager(q.organization_id))
        or (q.organization_id is not null and public.can_review_org_question(q.organization_id))
        or (
          q.organization_id is not null
          and public.is_evidara_teacher_for_scope(q.organization_id, null::uuid, q.subject_id)
          and (q.created_by = auth.uid() or q.status = 'approved'::public.question_status)
        )
      )
  )
);

create policy question_options_manage_v15 on public.question_options
for all to authenticated
using (
  exists (
    select 1 from public.questions q
    where q.id = question_options.question_id
      and (
        (q.organization_id is null and public.is_super_admin())
        or (q.organization_id is not null and public.is_evidara_school_manager(q.organization_id))
        or (q.organization_id is not null and public.can_review_org_question(q.organization_id))
        or (
          q.organization_id is not null
          and q.created_by = auth.uid()
          and q.status in ('draft'::public.question_status, 'rejected'::public.question_status)
          and public.is_evidara_teacher_for_scope(q.organization_id, null::uuid, q.subject_id)
        )
      )
  )
)
with check (
  exists (
    select 1 from public.questions q
    where q.id = question_options.question_id
      and (
        (q.organization_id is null and public.is_super_admin())
        or (q.organization_id is not null and public.is_evidara_school_manager(q.organization_id))
        or (q.organization_id is not null and public.can_review_org_question(q.organization_id))
        or (
          q.organization_id is not null
          and q.created_by = auth.uid()
          and q.status in ('draft'::public.question_status, 'rejected'::public.question_status)
          and public.is_evidara_teacher_for_scope(q.organization_id, null::uuid, q.subject_id)
        )
      )
  )
);

comment on function public.enforce_institution_question_collaboration_v1() is
  'Phase 1 C7: teachers own draft/rejected authoring and submit for review; school managers/reviewers control institution review.';
