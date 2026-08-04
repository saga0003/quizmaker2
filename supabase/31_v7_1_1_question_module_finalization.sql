begin;

-- ============================================================
-- Evidara V7.1.1 final Questions module controls
-- ============================================================
-- Permanent deletion is deliberately restricted to platform administrators.
-- School Admins and School Teachers may continue to create, review and archive
-- within their existing permissions, but they cannot permanently delete rows.

create table if not exists public.question_deletion_audit (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  organization_id uuid,
  deleted_by uuid references public.profiles(id) on delete set null,
  deleted_role text not null,
  stem_text text,
  snapshot jsonb not null,
  deleted_at timestamptz not null default now()
);

create index if not exists question_deletion_audit_question_idx
  on public.question_deletion_audit(question_id, deleted_at desc);
create index if not exists question_deletion_audit_actor_idx
  on public.question_deletion_audit(deleted_by, deleted_at desc);

alter table public.question_deletion_audit enable row level security;

drop policy if exists question_deletion_audit_platform_read
  on public.question_deletion_audit;
create policy question_deletion_audit_platform_read
on public.question_deletion_audit
for select
to authenticated
using (public.is_evidara_platform_admin());

revoke insert, update, delete on public.question_deletion_audit
from anon, authenticated;
grant select on public.question_deletion_audit to authenticated, service_role;
grant insert, update, delete on public.question_deletion_audit to service_role;

create or replace function public.bulk_delete_questions_v71(
  p_question_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  actor_role text := coalesce(public.current_evidara_role(), 'student');
  target_id uuid;
  question_snapshot jsonb;
  question_org uuid;
  question_stem text;
  deleted_ids jsonb := '[]'::jsonb;
  failed_items jsonb := '[]'::jsonb;
  technical_message text;
  sql_state text;
  friendly_message text;
  requested_count integer := cardinality(coalesce(p_question_ids, array[]::uuid[]));
begin
  if auth.role() <> 'service_role'
     and actor_role not in ('super_admin', 'evidara_admin', 'admin', 'platform_admin') then
    raise exception 'Only Super Admin and Evidara Admin can permanently delete questions.'
      using errcode = '42501';
  end if;

  if requested_count = 0 then
    return jsonb_build_object(
      'requested', 0,
      'deleted', '[]'::jsonb,
      'failed', '[]'::jsonb
    );
  end if;

  if requested_count > 1000 then
    raise exception 'A maximum of 1,000 questions can be deleted in one operation.'
      using errcode = '22023';
  end if;

  for target_id in
    select distinct value
    from unnest(p_question_ids) as value
    where value is not null
  loop
    begin
      select
        to_jsonb(question),
        question.organization_id,
        question.stem_text
      into
        question_snapshot,
        question_org,
        question_stem
      from public.questions question
      where question.id = target_id;

      if question_snapshot is null then
        failed_items := failed_items || jsonb_build_array(
          jsonb_build_object(
            'id', target_id,
            'error', 'This question no longer exists. Refresh the question bank.'
          )
        );
        continue;
      end if;

      insert into public.question_deletion_audit (
        question_id,
        organization_id,
        deleted_by,
        deleted_role,
        stem_text,
        snapshot
      ) values (
        target_id,
        question_org,
        auth.uid(),
        actor_role,
        question_stem,
        question_snapshot
      );

      delete from public.questions
      where id = target_id;

      if found then
        deleted_ids := deleted_ids || jsonb_build_array(target_id);
      else
        raise exception 'The question could not be deleted.';
      end if;
    exception when others then
      get stacked diagnostics
        technical_message = message_text,
        sql_state = returned_sqlstate;

      friendly_message := case
        when sql_state = '23503'
          then 'This question is already used in a paper, test or result and cannot be permanently deleted. Archive it instead.'
        when sql_state = '42501'
          then 'Only Super Admin and Evidara Admin can permanently delete questions.'
        else regexp_replace(coalesce(technical_message, 'Question deletion failed.'), '\s+', ' ', 'g')
      end;

      failed_items := failed_items || jsonb_build_array(
        jsonb_build_object(
          'id', target_id,
          'error', friendly_message,
          'code', sql_state
        )
      );
    end;
  end loop;

  return jsonb_build_object(
    'requested', requested_count,
    'deleted', deleted_ids,
    'failed', failed_items
  );
end
$$;

revoke all on function public.bulk_delete_questions_v71(uuid[])
from public, anon;
grant execute on function public.bulk_delete_questions_v71(uuid[])
to authenticated, service_role;

commit;
