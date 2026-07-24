-- Evidara V10 — Question Collection compatibility hardening
-- Run after 39_v10_question_collections_reference_analytics.sql.

begin;

create or replace function public.question_collection_org_manager_v13(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_evidara_platform_admin()
    or (p_organization_id is not null and public.is_evidara_school_staff(p_organization_id));
$$;

grant execute on function public.question_collection_org_manager_v13(uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(
  null,
  'questions.collection.hardening_ready',
  'system',
  '39a_v10_question_collections_hardening',
  jsonb_build_object(
    'existing_permission_helpers',true,
    'paper_builder_permission_compatible',true
  )
);

commit;
