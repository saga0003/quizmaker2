-- Phase 1 R6: make school-admin question imports consistent and row-isolated.
-- 1) The canonical preflight already allows school_admin, so the one-argument
--    question-manager guard must allow the same role.
-- 2) Remove the default from the two-argument overload so one-argument calls
--    cannot become ambiguous.
-- 3) Force deferred question integrity triggers to fire inside each import-row
--    save subtransaction, allowing invalid/duplicate rows to be reported while
--    valid rows continue importing.

create or replace function public.is_org_question_manager(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.is_super_admin() or exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and member_role in ('institute_owner','institute_admin','teacher','reviewer','school_admin')
      and is_active = true
  );
$function$;

drop function if exists public.is_org_question_manager(uuid, uuid);
create function public.is_org_question_manager(p_org_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_catalog'
as $function$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = p_org_id
      and om.user_id = coalesce(p_user_id, auth.uid())
      and om.is_active = true
      and om.member_role::text in (
        'owner','admin','paper_setter','reviewer','publisher','teacher',
        'institute_admin','question_manager','institute_owner','school_admin'
      )
  );
$function$;

do $migration$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'bulk_import_questions_v71';

  if v_def is null then
    raise exception 'bulk_import_questions_v71 not found';
  end if;

  if position('set constraints trg_question_duplicate_finalize_v2' in lower(v_def)) = 0 then
    v_def := replace(
      v_def,
      '  for row_item in',
      '  set constraints trg_question_duplicate_finalize_v2, trg_question_correct_answer_v1 immediate;' || E'\n\n' || '  for row_item in'
    );
    v_def := replace(
      v_def,
      '  update public.question_import_batches',
      '  set constraints trg_question_duplicate_finalize_v2, trg_question_correct_answer_v1 deferred;' || E'\n\n' || '  update public.question_import_batches'
    );
    execute v_def;
  end if;
end
$migration$;
