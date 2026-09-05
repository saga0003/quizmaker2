-- Phase 1 B7: academic-year rollover without rewriting prior enrollment history.

begin;

create or replace function public.promote_school_student(
  p_membership_id uuid,
  p_target_academic_year text
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v public.student_school_memberships%rowtype;
  v_existing_event public.student_promotion_events%rowtype;
  v_new uuid;
  v_grade integer;
  v_target_year text := btrim(coalesce(p_target_academic_year,''));
begin
  select * into v
  from public.student_school_memberships
  where id = p_membership_id
  for update;

  if v.id is null then
    raise exception 'Student membership not found.';
  end if;

  if not public.is_school_manager(v.organization_id) then
    raise exception 'School manager permission required.';
  end if;

  if v_target_year !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Use an academic year such as 2027-28.' using errcode='22023';
  end if;

  -- Retry-safe: return the result of an already-recorded rollover instead of duplicating history.
  select event.* into v_existing_event
  from public.student_promotion_events event
  where event.membership_id = v.id
    and event.to_academic_year = v_target_year
    and event.event_type in ('promoted','completed')
  order by event.id desc
  limit 1;

  if v_existing_event.id is not null then
    if v_existing_event.event_type = 'completed' then
      return v.id;
    end if;
    select target.id into v_new
    from public.student_school_memberships target
    where target.organization_id = v.organization_id
      and target.student_id = v.student_id
      and target.academic_year = v_target_year;
    if v_new is not null then return v_new; end if;
    raise exception 'Recorded promotion target is missing.' using errcode='P0002';
  end if;

  if v.academic_year = v_target_year then
    return v.id;
  end if;

  if v.status <> 'active' or v.promotion_locked then
    raise exception 'Only active, unlocked students can be promoted.';
  end if;

  if exists (
    select 1 from public.student_promotion_blocks block_row
    where block_row.organization_id = v.organization_id
      and block_row.student_id = v.student_id
  ) then
    raise exception 'This student is permanently blocked from promotion.';
  end if;

  if exists (
    select 1 from public.student_school_memberships target
    where target.organization_id = v.organization_id
      and target.student_id = v.student_id
      and target.academic_year = v_target_year
      and (target.status in ('withdrawn','completed','revoked') or target.promotion_locked = true)
  ) then
    raise exception 'The target academic-year record is historical or promotion-locked.';
  end if;

  -- Grade 12 rollover is graduation/completion: preserve this record and do not manufacture
  -- another enrollment for a year after school completion.
  if v.grade >= 12 then
    update public.student_school_memberships
    set status = 'completed',
        promoted_at = now(),
        promoted_by = auth.uid(),
        lifecycle_changed_at = now(),
        lifecycle_changed_by = auth.uid(),
        lifecycle_reason = 'Academic-year completion',
        updated_at = now()
    where id = v.id;

    insert into public.student_promotion_events(
      organization_id,membership_id,student_id,event_type,
      from_academic_year,to_academic_year,from_grade,to_grade,actor_id,metadata
    ) values (
      v.organization_id,v.id,v.student_id,'completed',
      v.academic_year,v_target_year,v.grade,v.grade,auth.uid(),
      jsonb_build_object('phase1_version','b7','target_membership_id',null,'prior_membership_status','completed')
    );

    return v.id;
  end if;

  v_grade := v.grade + 1;

  -- Close the prior-year membership first. If target creation fails, this whole function rolls back.
  update public.student_school_memberships
  set status = 'completed',
      promoted_at = now(),
      promoted_by = auth.uid(),
      lifecycle_changed_at = now(),
      lifecycle_changed_by = auth.uid(),
      lifecycle_reason = 'Promoted to ' || v_target_year,
      updated_at = now()
  where id = v.id;

  insert into public.student_school_memberships(
    organization_id,student_id,academic_year,grade,section,section_id,board,tracks,status,
    promotion_locked,parent_name,parent_phone,promoted_at,promoted_by,metadata
  ) values (
    v.organization_id,v.student_id,v_target_year,v_grade,v.section,null,v.board,v.tracks,'active',
    false,v.parent_name,v.parent_phone,now(),auth.uid(),
    coalesce(v.metadata,'{}'::jsonb) || jsonb_build_object(
      'rollover_from_membership_id',v.id,
      'rollover_from_academic_year',v.academic_year,
      'rollover_at',now()
    )
  )
  on conflict (organization_id,student_id,academic_year) do update
    set grade = excluded.grade,
        board = excluded.board,
        tracks = excluded.tracks,
        status = 'active',
        promoted_at = now(),
        promoted_by = auth.uid(),
        updated_at = now(),
        metadata = coalesce(public.student_school_memberships.metadata,'{}'::jsonb) || excluded.metadata
    where public.student_school_memberships.status not in ('withdrawn','completed','revoked')
      and public.student_school_memberships.promotion_locked = false
  returning id into v_new;

  if v_new is null then
    raise exception 'The target student record is historical or promotion-locked.';
  end if;

  insert into public.student_promotion_events(
    organization_id,membership_id,student_id,event_type,
    from_academic_year,to_academic_year,from_grade,to_grade,actor_id,metadata
  ) values (
    v.organization_id,v.id,v.student_id,'promoted',
    v.academic_year,v_target_year,v.grade,v_grade,auth.uid(),
    jsonb_build_object('phase1_version','b7','target_membership_id',v_new,'prior_membership_status','completed')
  );

  return v_new;
end
$function$;

revoke all on function public.promote_school_student(uuid,text) from public, anon;
grant execute on function public.promote_school_student(uuid,text) to authenticated;

comment on function public.promote_school_student(uuid,text) is
  'B7 rollover: prior enrollment becomes immutable historical Completed state; next-year enrollment is separate and active; Grade 12 completes without creating a synthetic next-year enrollment; recorded retries are idempotent.';

commit;
