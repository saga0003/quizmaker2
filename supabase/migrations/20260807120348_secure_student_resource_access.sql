-- Phase 1 Increment 2: make student resource authorization independent of the UI.
-- Apply through the approved Supabase migration process only. Do not run this
-- file manually against production.

begin;

-- Historical policy `resources_metadata_read` exposed every column on every
-- active resource to any authenticated client. Because content_url lives on
-- the same row as display metadata, row policies cannot safely expose only the
-- metadata columns. Student reads now go through the existing self-scoped RPC
-- or the authenticated school-platform API instead.
drop policy if exists resources_metadata_read on public.academic_resources;
drop policy if exists resources_privileged_read on public.academic_resources;

create policy resources_privileged_read
on public.academic_resources
for select
to authenticated
using (public.is_super_admin());

revoke select on table public.academic_resources from public, anon, authenticated;

-- Keep the existing eligibility calculation, but fail closed when a caller
-- supplies a different student id. The helper is internal-only; the public
-- student contract remains list_my_eligible_resources().
create or replace function public.student_can_access_resource(
  p_resource_id uuid,
  p_student_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    auth.uid() is not null
    and (
      p_student_id = auth.uid()
      or public.is_super_admin()
    )
    and exists (
      select 1
      from public.academic_resources resource
      join public.student_school_memberships membership
        on membership.student_id = p_student_id
       and membership.status = 'active'
      where resource.id = p_resource_id
        and resource.is_active = true
        and membership.grade between resource.grade_min and resource.grade_max
        and (
          resource.board is null
          or lower(resource.board) = lower(membership.board)
        )
        and (
          resource.required_track is null
          or resource.required_track = any(membership.tracks)
        )
        and (
          not resource.subscription_required
          or public.school_subscription_is_active(membership.organization_id, current_date)
        )
    );
$$;

revoke all on function public.student_can_access_resource(uuid, uuid)
from public, anon, authenticated, service_role;

create or replace function public.list_my_eligible_resources()
returns table (
  id uuid,
  title text,
  kind public.academic_resource_kind,
  access_label public.resource_access_label,
  subject text,
  source_year integer,
  content_url text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    resource.id,
    resource.title,
    resource.kind,
    resource.access_label,
    resource.subject,
    resource.source_year,
    resource.content_url
  from public.academic_resources resource
  where auth.uid() is not null
    and public.student_can_access_resource(resource.id, auth.uid())
  order by resource.kind, resource.source_year desc nulls last, resource.title;
$$;

revoke all on function public.list_my_eligible_resources()
from public, anon, authenticated;
grant execute on function public.list_my_eligible_resources()
to authenticated;

comment on function public.list_my_eligible_resources() is
  'Returns only active resources eligible for auth.uid() through an active school membership and subscription.';

notify pgrst, 'reload schema';

commit;
