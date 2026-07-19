-- ScholarOS V4.1: permanent revocation guard.
-- Apply after 08_version_5_school_subscription_lifecycle.sql.
-- A revoked student must never be reintroduced by individual or bulk promotion.

create table if not exists public.student_promotion_blocks (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  blocked_at timestamptz not null default now(),
  blocked_by uuid references public.profiles(id) on delete set null,
  reason text,
  source_membership_id uuid references public.student_school_memberships(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (organization_id, student_id)
);

create index if not exists student_promotion_blocks_student_idx
  on public.student_promotion_blocks(student_id, organization_id);

-- Preserve revocations created before this guard existed.
insert into public.student_promotion_blocks(
  organization_id,
  student_id,
  blocked_at,
  blocked_by,
  reason,
  source_membership_id
)
select
  m.organization_id,
  m.student_id,
  coalesce(m.revoked_at, m.updated_at, now()),
  m.revoked_by,
  m.metadata->>'revoke_reason',
  m.id
from public.student_school_memberships m
where m.status = 'revoked' or m.promotion_locked = true
on conflict (organization_id, student_id) do nothing;

alter table public.student_promotion_blocks enable row level security;

drop policy if exists promotion_blocks_read on public.student_promotion_blocks;
create policy promotion_blocks_read
  on public.student_promotion_blocks
  for select
  to authenticated
  using (
    student_id = auth.uid()
    or public.is_super_admin()
    or public.is_org_member(organization_id)
  );

create or replace function public.revoke_school_student(
  p_membership_id uuid,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.student_school_memberships%rowtype;
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

  if v.status = 'revoked' then
    insert into public.student_promotion_blocks(
      organization_id,
      student_id,
      blocked_by,
      reason,
      source_membership_id
    )
    values (
      v.organization_id,
      v.student_id,
      auth.uid(),
      coalesce(p_reason, v.metadata->>'revoke_reason'),
      v.id
    )
    on conflict (organization_id, student_id) do update
      set blocked_at = now(),
          blocked_by = auth.uid(),
          reason = coalesce(excluded.reason, public.student_promotion_blocks.reason),
          source_membership_id = excluded.source_membership_id;
    return v.id;
  end if;

  if v.status <> 'active' then
    return v.id;
  end if;

  update public.student_school_memberships
  set status = 'revoked',
      promotion_locked = true,
      revoked_at = now(),
      revoked_by = auth.uid(),
      updated_at = now(),
      metadata = metadata || jsonb_build_object('revoke_reason', p_reason)
  where id = v.id;

  insert into public.student_promotion_blocks(
    organization_id,
    student_id,
    blocked_by,
    reason,
    source_membership_id
  )
  values (
    v.organization_id,
    v.student_id,
    auth.uid(),
    p_reason,
    v.id
  )
  on conflict (organization_id, student_id) do update
    set blocked_at = now(),
        blocked_by = auth.uid(),
        reason = excluded.reason,
        source_membership_id = excluded.source_membership_id;

  insert into public.student_promotion_events(
    organization_id,
    membership_id,
    student_id,
    event_type,
    from_academic_year,
    from_grade,
    to_grade,
    actor_id,
    metadata
  )
  values (
    v.organization_id,
    v.id,
    v.student_id,
    'revoked',
    v.academic_year,
    v.grade,
    v.grade,
    auth.uid(),
    jsonb_build_object('reason', p_reason)
  );

  return v.id;
end
$$;

grant execute on function public.revoke_school_student(uuid, text) to authenticated;

create or replace function public.promote_school_student(
  p_membership_id uuid,
  p_target_academic_year text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.student_school_memberships%rowtype;
  v_new uuid;
  v_grade integer;
  v_status public.student_membership_status;
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

  if v.status <> 'active' or v.promotion_locked then
    raise exception 'Revoked or locked students cannot be promoted.';
  end if;

  if exists (
    select 1
    from public.student_promotion_blocks b
    where b.organization_id = v.organization_id
      and b.student_id = v.student_id
  ) then
    raise exception 'This student was revoked and is permanently blocked from promotion.';
  end if;

  if exists (
    select 1
    from public.student_school_memberships target
    where target.organization_id = v.organization_id
      and target.student_id = v.student_id
      and target.academic_year = p_target_academic_year
      and (target.status = 'revoked' or target.promotion_locked = true)
  ) then
    raise exception 'The target academic-year record is revoked or promotion-locked.';
  end if;

  if v.academic_year = p_target_academic_year then
    return v.id;
  end if;

  v_grade := least(12, v.grade + 1);
  v_status := case
    when v.grade = 12 then 'completed'::public.student_membership_status
    else 'active'::public.student_membership_status
  end;

  insert into public.student_school_memberships(
    organization_id,
    student_id,
    academic_year,
    grade,
    section,
    board,
    tracks,
    status,
    promotion_locked,
    parent_name,
    parent_phone,
    promoted_at,
    promoted_by,
    metadata
  )
  values (
    v.organization_id,
    v.student_id,
    p_target_academic_year,
    v_grade,
    v.section,
    v.board,
    v.tracks,
    v_status,
    false,
    v.parent_name,
    v.parent_phone,
    now(),
    auth.uid(),
    v.metadata
  )
  on conflict (organization_id, student_id, academic_year) do update
    set grade = excluded.grade,
        section = excluded.section,
        board = excluded.board,
        tracks = excluded.tracks,
        status = excluded.status,
        promoted_at = now(),
        promoted_by = auth.uid(),
        updated_at = now()
    where public.student_school_memberships.status <> 'revoked'
      and public.student_school_memberships.promotion_locked = false
  returning id into v_new;

  if v_new is null then
    raise exception 'The target student record is revoked or promotion-locked.';
  end if;

  update public.student_school_memberships
  set status = case when v.grade = 12 then 'completed' else status end,
      promoted_at = now(),
      promoted_by = auth.uid(),
      updated_at = now()
  where id = v.id;

  insert into public.student_promotion_events(
    organization_id,
    membership_id,
    student_id,
    event_type,
    from_academic_year,
    to_academic_year,
    from_grade,
    to_grade,
    actor_id
  )
  values (
    v.organization_id,
    v.id,
    v.student_id,
    case when v.grade = 12 then 'completed' else 'promoted' end,
    v.academic_year,
    p_target_academic_year,
    v.grade,
    v_grade,
    auth.uid()
  );

  return v_new;
end
$$;

grant execute on function public.promote_school_student(uuid, text) to authenticated;

create or replace function public.promote_all_school_students(
  p_organization_id uuid,
  p_from_academic_year text,
  p_target_academic_year text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_count integer := 0;
begin
  if not public.is_school_manager(p_organization_id) then
    raise exception 'School manager permission required.';
  end if;

  for r in
    select m.id
    from public.student_school_memberships m
    where m.organization_id = p_organization_id
      and m.academic_year = p_from_academic_year
      and m.status = 'active'
      and m.promotion_locked = false
      and not exists (
        select 1
        from public.student_promotion_blocks b
        where b.organization_id = m.organization_id
          and b.student_id = m.student_id
      )
    order by m.id
  loop
    perform public.promote_school_student(r.id, p_target_academic_year);
    v_count := v_count + 1;
  end loop;

  return v_count;
end
$$;

grant execute on function public.promote_all_school_students(uuid, text, text) to authenticated;
