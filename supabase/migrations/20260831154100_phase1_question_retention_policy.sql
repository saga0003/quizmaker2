create or replace function public.enforce_question_retention_policy_v1()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_is_super_admin boolean := false;
  v_is_school_manager boolean := false;
begin
  if tg_op = 'UPDATE' then
    if new.status = 'archived'::public.question_status
       and old.status is distinct from new.status then
      if v_uid is not null then
        v_is_super_admin := public.is_role(v_uid, 'ROLE_SUPER_ADMIN');
        if old.organization_id is null then
          if not v_is_super_admin then
            raise exception 'Only Super Admin may archive platform questions';
          end if;
        else
          v_is_school_manager := public.is_evidara_school_manager(old.organization_id, v_uid);
          if not v_is_school_manager and not v_is_super_admin then
            raise exception 'Only School Admin may archive institution questions';
          end if;
        end if;
      end if;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    if old.status not in ('draft'::public.question_status, 'rejected'::public.question_status) then
      raise exception 'Only unused draft or rejected mistaken questions may be permanently deleted; archive retained questions instead';
    end if;

    if exists (
      select 1
      from public.paper_questions pq
      where pq.question_id = old.id
    ) then
      raise exception 'Questions used in papers cannot be permanently deleted; archive them instead';
    end if;

    return old;
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_question_retention_policy_v1() from public, anon, authenticated;

drop trigger if exists trg_questions_retention_policy on public.questions;
create trigger trg_questions_retention_policy
before update of status or delete on public.questions
for each row
execute function public.enforce_question_retention_policy_v1();

comment on function public.enforce_question_retention_policy_v1() is
'Phase 1 C8 retention guard: School Admin archives institution questions; permanent deletion is limited to unused draft/rejected mistakes and never permitted once a question is used in a paper.';
