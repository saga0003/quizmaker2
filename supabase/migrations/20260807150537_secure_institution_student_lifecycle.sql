-- Phase 1 Increment 4: live institution student lifecycle authorization.
--
-- This migration intentionally leaves the historical SQL sequence untouched.
-- It narrows roster reads to the authenticated actor's active organization and,
-- for teachers, to active assigned sections. Lifecycle writes are exposed only
-- through checked manager RPCs. The roster DTO joins profiles/auth internally so
-- profiles RLS does not need to be broadened.

begin;

-- The historical membership read policy allowed every active organization member
-- to read every student membership. Retain self/platform/manager access, while
-- limiting teachers to students in an active assigned section.
drop policy if exists memberships_read on public.student_school_memberships;
create policy memberships_read
on public.student_school_memberships
for select
to authenticated
using (
  student_id = (select auth.uid())
  or public.is_evidara_platform_admin()
  or public.is_evidara_school_manager(organization_id)
  or exists (
    select 1
    from public.teacher_section_assignments assignment
    join public.academic_sections section_row
      on section_row.id = assignment.section_id
    join public.organization_members member
      on member.organization_id = section_row.organization_id
     and member.user_id = (select auth.uid())
     and member.is_active = true
     and member.member_role::text in ('teacher', 'school_teacher', 'reviewer', 'invigilator')
    where assignment.teacher_id = (select auth.uid())
      and assignment.is_active = true
      and section_row.is_active = true
      and section_row.organization_id = student_school_memberships.organization_id
      and section_row.id = student_school_memberships.section_id
  )
);

-- The historical write policy used is_school_manager(), whose original definition
-- included teachers. Use the later strict Evidara manager helper instead.
drop policy if exists memberships_school_write on public.student_school_memberships;
create policy memberships_school_write
on public.student_school_memberships
for all
to authenticated
using (public.is_evidara_school_manager(organization_id))
with check (public.is_evidara_school_manager(organization_id));

-- RLS remains defense in depth, but authenticated clients do not need direct
-- mutation privileges now that every supported write has a checked RPC.
revoke insert, update, delete on table public.student_school_memberships
from public, anon, authenticated;
grant select on table public.student_school_memberships to authenticated;

-- Promotion history and permanent blocks are lifecycle administration data.
-- Teachers do not need organization-wide access to either table.
drop policy if exists promotion_events_read on public.student_promotion_events;
create policy promotion_events_read
on public.student_promotion_events
for select
to authenticated
using (
  student_id = (select auth.uid())
  or public.is_evidara_platform_admin()
  or public.is_evidara_school_manager(organization_id)
  or exists (
    select 1
    from public.student_school_memberships membership
    join public.teacher_section_assignments assignment
      on assignment.section_id = membership.section_id
     and assignment.teacher_id = (select auth.uid())
     and assignment.is_active = true
    join public.academic_sections section_row
      on section_row.id = assignment.section_id
     and section_row.is_active = true
    join public.organization_members member
      on member.organization_id = section_row.organization_id
     and member.user_id = (select auth.uid())
     and member.is_active = true
     and member.member_role::text in ('teacher', 'school_teacher', 'reviewer', 'invigilator')
    where membership.id = student_promotion_events.membership_id
      and membership.organization_id = student_promotion_events.organization_id
  )
);

drop policy if exists promotion_blocks_read on public.student_promotion_blocks;
create policy promotion_blocks_read
on public.student_promotion_blocks
for select
to authenticated
using (
  student_id = (select auth.uid())
  or public.is_evidara_platform_admin()
  or public.is_evidara_school_manager(organization_id)
);

create or replace function public.list_school_student_lifecycle_v13(
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_organization uuid;
  v_platform_admin boolean := false;
  v_manager boolean := false;
begin
  if v_actor is null then
    raise exception 'Cloud sign-in is required.' using errcode = '42501';
  end if;

  v_platform_admin := public.is_evidara_platform_admin();

  if v_platform_admin then
    if p_organization_id is null then
      raise exception 'Choose an organization before loading its roster.' using errcode = '22023';
    end if;
    select organization.id
    into v_organization
    from public.organizations organization
    where organization.id = p_organization_id;
  else
    select member.organization_id
    into v_organization
    from public.organization_members member
    where member.user_id = v_actor
      and member.is_active = true
      and member.member_role::text in (
        'institute_owner', 'institute_admin', 'school_owner', 'school_admin',
        'teacher', 'school_teacher', 'reviewer', 'invigilator'
      )
      and (p_organization_id is null or member.organization_id = p_organization_id)
    order by member.created_at, member.organization_id
    limit 1;
  end if;

  if v_organization is null then
    raise exception 'No active authorized institution membership was found.' using errcode = '42501';
  end if;

  v_manager := public.is_evidara_school_manager(v_organization);

  return jsonb_build_object(
    'organizationId', v_organization,
    'manager', v_manager,
    'scope', case when v_manager then 'organization' else 'assigned_sections' end,
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', section_row.id,
        'academicYear', section_row.academic_year,
        'grade', section_row.grade,
        'name', section_row.name,
        'code', section_row.code
      ) order by section_row.academic_year desc, section_row.grade, lower(section_row.name))
      from public.academic_sections section_row
      where section_row.organization_id = v_organization
        and section_row.is_active = true
        and (
          v_manager
          or exists (
            select 1
            from public.teacher_section_assignments assignment
            where assignment.section_id = section_row.id
              and assignment.teacher_id = v_actor
              and assignment.is_active = true
          )
        )
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'id', membership.id,
        'name', coalesce(nullif(btrim(profile.full_name), ''), 'Student'),
        'grade', membership.grade,
        'section', coalesce(section_row.name, membership.section, ''),
        'board', membership.board,
        'academicYear', membership.academic_year,
        'tracks', membership.tracks,
        'status', membership.status::text,
        'invitationStatus', case
          when auth_user.email_confirmed_at is null and auth_user.invited_at is not null then 'invited'
          when auth_user.email_confirmed_at is null then 'pending'
          else 'active'
        end,
        'promotionLocked', membership.promotion_locked,
        'revokedAt', membership.revoked_at,
        'promotedAt', membership.promoted_at,
        'parentName', case when v_manager then nullif(membership.parent_name, '') else null end,
        'parentPhone', case when v_manager then nullif(membership.parent_phone, '') else null end
      )) order by membership.academic_year desc, membership.grade,
          lower(coalesce(section_row.name, membership.section, '')),
          lower(coalesce(profile.full_name, '')), membership.id)
      from public.student_school_memberships membership
      join public.profiles profile on profile.id = membership.student_id
      join auth.users auth_user on auth_user.id = membership.student_id
      left join public.academic_sections section_row on section_row.id = membership.section_id
      where membership.organization_id = v_organization
        and (
          v_manager
          or exists (
            select 1
            from public.teacher_section_assignments assignment
            where assignment.section_id = membership.section_id
              and assignment.teacher_id = v_actor
              and assignment.is_active = true
              and exists (
                select 1
                from public.academic_sections assigned_section
                where assigned_section.id = assignment.section_id
                  and assigned_section.organization_id = v_organization
                  and assigned_section.is_active = true
              )
          )
        )
    ), '[]'::jsonb),
    'generatedAt', now()
  );
end
$$;

revoke all on function public.list_school_student_lifecycle_v13(uuid)
from public, anon, authenticated, service_role;
grant execute on function public.list_school_student_lifecycle_v13(uuid)
to authenticated;

-- Checked manager-only wrappers preserve the existing, audited lifecycle
-- behavior while removing direct client access to the teacher-permissive legacy
-- functions.
create or replace function public.school_roster_promote_student_v13(
  p_membership_id uuid,
  p_target_academic_year text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization uuid;
begin
  select membership.organization_id into v_organization
  from public.student_school_memberships membership
  where membership.id = p_membership_id;

  if v_organization is null then
    raise exception 'Student membership not found.' using errcode = 'P0002';
  end if;
  if not public.is_evidara_school_manager(v_organization) then
    raise exception 'School Admin permission is required.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_target_academic_year, '')) !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Use an academic year such as 2027-28.' using errcode = '22023';
  end if;

  return public.promote_school_student(p_membership_id, btrim(p_target_academic_year));
end
$$;

create or replace function public.school_roster_revoke_student_v13(
  p_membership_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization uuid;
begin
  select membership.organization_id into v_organization
  from public.student_school_memberships membership
  where membership.id = p_membership_id;

  if v_organization is null then
    raise exception 'Student membership not found.' using errcode = 'P0002';
  end if;
  if not public.is_evidara_school_manager(v_organization) then
    raise exception 'School Admin permission is required.' using errcode = '42501';
  end if;

  return public.revoke_school_student(p_membership_id, nullif(btrim(coalesce(p_reason, '')), ''));
end
$$;

create or replace function public.school_roster_promote_all_v13(
  p_organization_id uuid,
  p_from_academic_year text,
  p_target_academic_year text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_evidara_school_manager(p_organization_id) then
    raise exception 'School Admin permission is required.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_from_academic_year, '')) !~ '^[0-9]{4}-[0-9]{2}$'
     or btrim(coalesce(p_target_academic_year, '')) !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Use academic years such as 2026-27 and 2027-28.' using errcode = '22023';
  end if;

  return public.promote_all_school_students(
    p_organization_id,
    btrim(p_from_academic_year),
    btrim(p_target_academic_year)
  );
end
$$;

create or replace function public.school_roster_revoke_all_v13(
  p_organization_id uuid,
  p_academic_year text,
  p_reason text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_evidara_school_manager(p_organization_id) then
    raise exception 'School Admin permission is required.' using errcode = '42501';
  end if;
  if btrim(coalesce(p_academic_year, '')) !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Use an academic year such as 2026-27.' using errcode = '22023';
  end if;

  return public.revoke_all_school_students(
    p_organization_id,
    btrim(p_academic_year),
    nullif(btrim(coalesce(p_reason, '')), '')
  );
end
$$;

create or replace function public.update_school_student_tracks_v13(
  p_membership_id uuid,
  p_tracks text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership public.student_school_memberships%rowtype;
  v_tracks text[] := coalesce(p_tracks, '{}'::text[]);
begin
  select * into v_membership
  from public.student_school_memberships membership
  where membership.id = p_membership_id
  for update;

  if v_membership.id is null then
    raise exception 'Student membership not found.' using errcode = 'P0002';
  end if;
  if not public.is_evidara_school_manager(v_membership.organization_id) then
    raise exception 'School Admin permission is required.' using errcode = '42501';
  end if;
  if v_membership.status <> 'active' then
    raise exception 'Only active student memberships can be edited.' using errcode = '22023';
  end if;
  if not v_tracks <@ array['Foundation','Boards','Olympiad','NEET','JEE','KCET']::text[] then
    raise exception 'One or more eligibility tracks are unsupported.' using errcode = '22023';
  end if;

  update public.student_school_memberships
  set tracks = array(select distinct track from unnest(v_tracks) track order by track),
      updated_at = now()
  where id = v_membership.id;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
  values(
    auth.uid(), v_membership.organization_id, 'school.student_tracks.updated',
    'student_membership', v_membership.id::text,
    jsonb_build_object('student_id', v_membership.student_id, 'tracks', v_tracks)
  );

  return v_membership.id;
end
$$;

create or replace function public.add_school_student_membership_v13(
  p_organization_id uuid,
  p_student_id uuid,
  p_academic_year text,
  p_grade integer,
  p_section text,
  p_board text,
  p_tracks text[] default '{}'::text[],
  p_parent_name text default null,
  p_parent_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membership uuid;
  v_section uuid;
  v_tracks text[] := coalesce(p_tracks, '{}'::text[]);
begin
  if not public.is_evidara_school_manager(p_organization_id) then
    raise exception 'School Admin permission is required.' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles profile
    where profile.id = p_student_id and profile.role::text = 'student'
  ) then
    raise exception 'Choose a valid student account.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_academic_year, '')) !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Use an academic year such as 2026-27.' using errcode = '22023';
  end if;
  if p_grade not between 8 and 12 then
    raise exception 'Grade must be between 8 and 12.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_section, ''))) > 80 then
    raise exception 'Section must be 80 characters or fewer.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_board, ''))) not between 2 and 80 then
    raise exception 'A valid board is required.' using errcode = '22023';
  end if;
  if not v_tracks <@ array['Foundation','Boards','Olympiad','NEET','JEE','KCET']::text[] then
    raise exception 'One or more eligibility tracks are unsupported.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.student_promotion_blocks block
    where block.organization_id = p_organization_id
      and block.student_id = p_student_id
  ) then
    raise exception 'This student was revoked and cannot be re-added to this institution.' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.student_school_memberships membership
    where membership.organization_id = p_organization_id
      and membership.student_id = p_student_id
      and membership.academic_year = btrim(p_academic_year)
      and (membership.status = 'revoked' or membership.promotion_locked = true)
  ) then
    raise exception 'The student record is revoked or promotion-locked.' using errcode = '23514';
  end if;

  select section_row.id into v_section
  from public.academic_sections section_row
  where section_row.organization_id = p_organization_id
    and section_row.academic_year = btrim(p_academic_year)
    and section_row.grade = p_grade
    and section_row.is_active = true
    and lower(section_row.name) = lower(btrim(coalesce(p_section, '')))
  order by section_row.id
  limit 1;

  insert into public.student_school_memberships(
    organization_id, student_id, academic_year, grade, section, section_id,
    board, tracks, status, promotion_locked, parent_name, parent_phone, updated_at
  ) values (
    p_organization_id, p_student_id, btrim(p_academic_year), p_grade,
    nullif(btrim(coalesce(p_section, '')), ''), v_section,
    btrim(p_board), array(select distinct track from unnest(v_tracks) track order by track),
    'active', false, nullif(btrim(coalesce(p_parent_name, '')), ''),
    nullif(btrim(coalesce(p_parent_phone, '')), ''), now()
  )
  on conflict(organization_id, student_id, academic_year) do update
    set grade = excluded.grade,
        section = excluded.section,
        section_id = excluded.section_id,
        board = excluded.board,
        tracks = excluded.tracks,
        status = 'active',
        promotion_locked = false,
        parent_name = excluded.parent_name,
        parent_phone = excluded.parent_phone,
        updated_at = now()
    where public.student_school_memberships.status <> 'revoked'
      and public.student_school_memberships.promotion_locked = false
  returning id into v_membership;

  if v_membership is null then
    raise exception 'The student record is revoked or promotion-locked.' using errcode = '23514';
  end if;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
  values(
    auth.uid(), p_organization_id, 'school.student_membership.added',
    'student_membership', v_membership::text,
    jsonb_build_object(
      'student_id', p_student_id,
      'academic_year', btrim(p_academic_year),
      'grade', p_grade,
      'section_id', v_section
    )
  );

  return v_membership;
end
$$;

-- Remove browser execution of the legacy RPCs whose internal helper includes
-- teachers. The checked V13 wrappers are the only authenticated lifecycle path.
revoke all on function public.promote_school_student(uuid, text)
from public, anon, authenticated;
revoke all on function public.revoke_school_student(uuid, text)
from public, anon, authenticated;
revoke all on function public.promote_all_school_students(uuid, text, text)
from public, anon, authenticated;
revoke all on function public.revoke_all_school_students(uuid, text, text)
from public, anon, authenticated;

revoke all on function public.school_roster_promote_student_v13(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.school_roster_revoke_student_v13(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function public.school_roster_promote_all_v13(uuid, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.school_roster_revoke_all_v13(uuid, text, text)
from public, anon, authenticated, service_role;
revoke all on function public.update_school_student_tracks_v13(uuid, text[])
from public, anon, authenticated, service_role;
revoke all on function public.add_school_student_membership_v13(uuid, uuid, text, integer, text, text, text[], text, text)
from public, anon, authenticated, service_role;

grant execute on function public.school_roster_promote_student_v13(uuid, text)
to authenticated;
grant execute on function public.school_roster_revoke_student_v13(uuid, text)
to authenticated;
grant execute on function public.school_roster_promote_all_v13(uuid, text, text)
to authenticated;
grant execute on function public.school_roster_revoke_all_v13(uuid, text, text)
to authenticated;
grant execute on function public.update_school_student_tracks_v13(uuid, text[])
to authenticated;
grant execute on function public.add_school_student_membership_v13(uuid, uuid, text, integer, text, text, text[], text, text)
to authenticated;

commit;
