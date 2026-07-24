-- Evidara V10 — Question Collection compatibility hardening
-- Run after 39_v10_question_collections_reference_analytics.sql.

begin;

create or replace function public.question_collection_org_manager_v13(p_organization_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select public.question_collection_platform_admin_v13() or exists(
    select 1 from public.organization_members member
    where member.organization_id=p_organization_id and member.user_id=auth.uid() and member.is_active=true
      and member.member_role in ('institute_owner','institute_admin','teacher')
  );
$$;

grant execute on function public.question_collection_org_manager_v13(uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'questions.collection.hardening_ready','system','39a_v10_question_collections_hardening',
  jsonb_build_object('organization_member_role_compatible',true));

commit;
