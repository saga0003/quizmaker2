-- Phase 1 B4: explicit student lifecycle states and non-destructive history protection.
--
-- This migration is backward compatible with the currently served UI:
-- - legacy `revoked` remains a supported enum value for pre-B4 records/callers;
-- - canonical B4 writes use active / withdrawn / completed / suspended;
-- - the existing V13 revoke wrapper keeps its legacy behavior unless the new UI
--   explicitly sends the private lifecycle transition marker;
-- - membership deletion is rejected once assessment evidence exists.

begin;

alter type public.student_membership_status add value if not exists 'withdrawn';
alter type public.student_membership_status add value if not exists 'suspended';

alter table public.student_school_memberships
  add column if not exists lifecycle_changed_at timestamptz,
  add column if not exists lifecycle_changed_by uuid references public.profiles(id) on delete set null,
  add column if not exists lifecycle_reason text;

comment on column public.student_school_memberships.lifecycle_changed_at is
  'B4 authoritative timestamp for Active/Withdrawn/Completed/Suspended transitions.';
comment on column public.student_school_memberships.lifecycle_changed_by is
  'B4 actor who last changed the lifecycle state.';
comment on column public.student_school_memberships.lifecycle_reason is
  'B4 optional reason for the last lifecycle transition.';

create or replace function public.set_school_student_lifecycle_status_v14(
  p_membership_id uuid,
  p_status text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v public.student_school_memberships%rowtype;
  v_target text := lower(btrim(coalesce(p_status, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_previous text;
begin
  select * into v
  from public.student_school_memberships membership
  where membership.id = p_membership_id
  for update;

  if v.id is null then
    raise exception 'Student membership not found.' using errcode = 'P0002';
  end if;
  if not public.is_evidara_school_manager(v.organization_id) then
    raise exception 'School Admin permission is required.' using errcode = '42501';
  end if;
  if v_target not in ('active', 'withdrawn', 'completed', 'suspended') then
    raise exception 'Lifecycle status must be Active, Withdrawn, Completed or Suspended.' using errcode = '22023';
  end if;

  v_previous := case when v.status::text = 'revoked' then 'withdrawn' else v.status::text end;

  -- Historical terminal states are intentionally not silently reopened. A
  -- mistaken terminal transition must be handled as an audited support action,
  -- while suspension is the reversible temporary-access state.
  if v_previous in ('withdrawn', 'completed') and v_target <> v_previous then
    raise exception 'Withdrawn or completed memberships are historical records and cannot be reactivated.' using errcode = '23514';
  end if;
  if v_previous = 'active' and v_target = 'active' then
    return v.id;
  end if;
  if v_previous = 'suspended' and v_target = 'suspended' then
    return v.id;
  end if;
  if v_previous = 'suspended' and v_target = 'active' then
    null;
  elsif v_previous = 'active' and v_target in ('withdrawn', 'completed', 'suspended') then
    null;
  elsif v_previous = 'suspended' and v_target in ('withdrawn', 'completed') then
    null;
  elsif v_target = v_previous then
    return v.id;
  else
    raise exception 'Unsupported student lifecycle transition from % to %.', v_previous, v_target using errcode = '23514';
  end if;

  update public.student_school_memberships
  set status = v_target::public.student_membership_status,
      promotion_locked = (v_target <> 'active'),
      lifecycle_changed_at = now(),
      lifecycle_changed_by = auth.uid(),
      lifecycle_reason = v_reason,
      updated_at = now(),
      revoked_at = case when v_target = 'withdrawn' then coalesce(revoked_at, now()) else revoked_at end,
      revoked_by = case when v_target = 'withdrawn' then coalesce(revoked_by, auth.uid()) else revoked_by end,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'lifecycle_status', v_target,
        'lifecycle_previous_status', v_previous,
        'lifecycle_reason', v_reason
      )
  where id = v.id;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
  values(
    auth.uid(), v.organization_id, 'school.student.lifecycle_changed',
    'student_membership', v.id::text,
    jsonb_build_object(
      'student_id', v.student_id,
      'from_status', v_previous,
      'to_status', v_target,
      'reason', v_reason,
      'academic_year', v.academic_year
    )
  );

  return v.id;
end
$$;

revoke all on function public.set_school_student_lifecycle_status_v14(uuid, text, text)
from public, anon, authenticated, service_role;
grant execute on function public.set_school_student_lifecycle_status_v14(uuid, text, text)
to authenticated;

-- Preserve the existing route contract while allowing the B4 UI to request an
-- explicit lifecycle state. Ordinary legacy revoke calls continue to call the
-- historical revoke helper and therefore remain compatible with the currently
-- served production UI until coordinated cutover.
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
  v_marker constant text := '__evidara_lifecycle__:';
  v_target text;
  v_reason text;
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

  if coalesce(p_reason, '') like v_marker || '%' then
    v_target := split_part(substr(p_reason, length(v_marker) + 1), '|', 1);
    v_reason := nullif(split_part(substr(p_reason, length(v_marker) + 1), '|', 2), '');
    return public.set_school_student_lifecycle_status_v14(p_membership_id, v_target, v_reason);
  end if;

  return public.revoke_school_student(p_membership_id, nullif(btrim(coalesce(p_reason, '')), ''));
end
$$;

revoke all on function public.school_roster_revoke_student_v13(uuid, text)
from public, anon, authenticated, service_role;
grant execute on function public.school_roster_revoke_student_v13(uuid, text)
to authenticated;

create or replace function public.guard_student_membership_delete_after_attempt_v14()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.exam_attempts attempt
    where attempt.student_id = old.student_id
      and attempt.organization_id = old.organization_id
  ) then
    raise exception 'Student memberships with assessment attempts are historical records and cannot be deleted. Use a lifecycle status instead.'
      using errcode = '23514';
  end if;
  return old;
end
$$;

revoke all on function public.guard_student_membership_delete_after_attempt_v14()
from public, anon, authenticated;

drop trigger if exists student_membership_preserve_attempt_history_v14 on public.student_school_memberships;
create trigger student_membership_preserve_attempt_history_v14
before delete on public.student_school_memberships
for each row execute function public.guard_student_membership_delete_after_attempt_v14();

comment on trigger student_membership_preserve_attempt_history_v14 on public.student_school_memberships is
  'B4: prevents destructive membership deletion once exam_attempts exist; use lifecycle status instead.';

commit;
