-- Phase 1 B5: freeze institution/student enrollment context at attempt creation.
-- Existing institutional attempt count was zero when this migration was introduced,
-- so no historical enrollment evidence is guessed or rewritten.

begin;

alter table public.exam_attempts
  add column if not exists enrollment_snapshot jsonb;

comment on column public.exam_attempts.enrollment_snapshot is
  'B5 immutable test-start snapshot: institution, membership, academic year, grade, section, board and programme/track context.';

create or replace function public.capture_exam_attempt_enrollment_snapshot_v15()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_membership public.student_school_memberships%rowtype;
begin
  -- Public/platform papers do not have an institution enrollment context.
  if new.organization_id is null then
    return new;
  end if;

  select membership.* into v_membership
  from public.student_school_memberships membership
  where membership.organization_id = new.organization_id
    and membership.student_id = new.student_id
    and membership.status::text = 'active'
  order by membership.updated_at desc, membership.created_at desc, membership.id
  limit 1;

  if v_membership.id is null then
    raise exception 'An active institution enrollment is required before starting this test.' using errcode = '42501';
  end if;

  new.enrollment_snapshot := jsonb_build_object(
    'version', 1,
    'capturedAt', now(),
    'membershipId', v_membership.id,
    'organizationId', v_membership.organization_id,
    'academicYear', v_membership.academic_year,
    'grade', v_membership.grade,
    'sectionId', v_membership.section_id,
    'section', v_membership.section,
    'board', v_membership.board,
    'programmes', coalesce(to_jsonb(v_membership.tracks), '[]'::jsonb)
  );

  return new;
end
$$;

revoke all on function public.capture_exam_attempt_enrollment_snapshot_v15()
from public, anon, authenticated;

create or replace function public.protect_exam_attempt_enrollment_snapshot_v15()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if old.enrollment_snapshot is distinct from new.enrollment_snapshot then
    raise exception 'Exam attempt enrollment snapshots are immutable historical evidence.' using errcode = '23514';
  end if;
  return new;
end
$$;

revoke all on function public.protect_exam_attempt_enrollment_snapshot_v15()
from public, anon, authenticated;

drop trigger if exists exam_attempt_capture_enrollment_snapshot_v15 on public.exam_attempts;
create trigger exam_attempt_capture_enrollment_snapshot_v15
before insert on public.exam_attempts
for each row execute function public.capture_exam_attempt_enrollment_snapshot_v15();

drop trigger if exists exam_attempt_protect_enrollment_snapshot_v15 on public.exam_attempts;
create trigger exam_attempt_protect_enrollment_snapshot_v15
before update on public.exam_attempts
for each row execute function public.protect_exam_attempt_enrollment_snapshot_v15();

comment on trigger exam_attempt_capture_enrollment_snapshot_v15 on public.exam_attempts is
  'B5 freezes active institution enrollment at the instant an attempt is created.';
comment on trigger exam_attempt_protect_enrollment_snapshot_v15 on public.exam_attempts is
  'B5 prevents later roster changes or application writes from rewriting frozen enrollment context.';

commit;
