-- Phase 1 Increment 5: distinguish Evidara platform resources from institution-owned resources.
begin;

alter table public.academic_resources
  add column if not exists organization_id uuid references public.organizations(id) on delete cascade,
  add column if not exists resource_scope text not null default 'platform';

alter table public.academic_resources drop constraint if exists academic_resources_scope_check;
alter table public.academic_resources add constraint academic_resources_scope_check
  check ((resource_scope = 'platform' and organization_id is null) or (resource_scope = 'organization' and organization_id is not null));

create index if not exists academic_resources_org_scope_idx
  on public.academic_resources(organization_id, resource_scope, is_active);

-- Existing records predate organization ownership, so preserve them as platform resources.
update public.academic_resources set resource_scope='platform', organization_id=null where organization_id is null;

create or replace function public.student_can_access_resource(p_resource_id uuid,p_student_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public,auth as $$
  select auth.uid() is not null
    and (p_student_id=auth.uid() or public.is_super_admin())
    and exists (
      select 1 from public.academic_resources r
      join public.student_school_memberships m on m.student_id=p_student_id and m.status='active'
      where r.id=p_resource_id and r.is_active=true
        and (r.resource_scope='platform' or (r.resource_scope='organization' and r.organization_id=m.organization_id))
        and m.grade between r.grade_min and r.grade_max
        and (r.board is null or lower(r.board)=lower(m.board))
        and (r.required_track is null or r.required_track=any(m.tracks))
        and (not r.subscription_required or public.school_subscription_is_active(m.organization_id,current_date))
    );
$$;

revoke all on function public.student_can_access_resource(uuid,uuid) from public,anon,authenticated,service_role;

-- Direct client reads stay closed; application APIs/RPCs expose scoped DTOs.
drop policy if exists resources_privileged_read on public.academic_resources;
create policy resources_privileged_read on public.academic_resources for select to authenticated using (public.is_super_admin());
revoke select,insert,update,delete on table public.academic_resources from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
