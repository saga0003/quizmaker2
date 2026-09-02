-- Phase 1 R7: align question-review authorization with the current school_admin role.
-- Institution-scoped question approval remains limited to active administrative/reviewer roles.

create or replace function public.can_review_org_question(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin() or exists (
    select 1
    from public.organization_members
    where organization_id = p_organization_id
      and user_id = auth.uid()
      and member_role in ('institute_owner','institute_admin','reviewer','school_admin')
      and is_active = true
  );
$$;

revoke all on function public.can_review_org_question(uuid) from public;
grant execute on function public.can_review_org_question(uuid) to authenticated;
