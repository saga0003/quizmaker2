-- Phase 1 acceptance hardening: canonical school_admin must be able to perform
-- School Admin analytics/teacher-assignment operations guarded by the legacy
-- analytics helper. The helper predated the canonical school_admin role and
-- only recognized institute_owner/institute_admin.

create or replace function public.analytics_is_school_admin_v10(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select public.analytics_is_platform_admin_v10()
    or exists(
      select 1
      from public.organization_members member
      where member.organization_id = p_organization_id
        and member.user_id = auth.uid()
        and member.is_active = true
        and member.member_role in ('institute_owner', 'institute_admin', 'school_admin')
    );
$function$;

comment on function public.analytics_is_school_admin_v10(uuid) is
  'Returns true for platform admins or active institution-owner/admin or canonical Phase 1 school_admin memberships.';
