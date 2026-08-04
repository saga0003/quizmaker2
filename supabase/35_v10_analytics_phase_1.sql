-- Evidara V10 Analytics Phase 1
-- Run after supabase/34_v9_product_catalogue.sql.
-- Adds normalized academic sections, teacher assignments and secure live student analytics.

begin;

create table if not exists public.academic_sections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  academic_year text not null,
  grade integer not null check (grade between 1 and 12),
  name text not null,
  code text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(name)) between 1 and 80)
);

create unique index if not exists academic_sections_unique_idx
  on public.academic_sections(organization_id, academic_year, grade, lower(name));
create index if not exists academic_sections_scope_idx
  on public.academic_sections(organization_id, academic_year, grade, is_active, name);

alter table public.student_school_memberships
  add column if not exists section_id uuid references public.academic_sections(id) on delete set null;

create index if not exists student_memberships_section_idx
  on public.student_school_memberships(section_id, status, student_id);

create table if not exists public.teacher_section_assignments (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.academic_sections(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  subject_label text not null default 'All subjects',
  is_active boolean not null default true,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(section_id, teacher_id, subject_label)
);

create index if not exists teacher_section_teacher_idx
  on public.teacher_section_assignments(teacher_id, is_active, section_id);
create index if not exists teacher_section_section_idx
  on public.teacher_section_assignments(section_id, is_active, teacher_id);

-- Convert existing free-text sections into normalized records.
insert into public.academic_sections(
  organization_id, academic_year, grade, name, code, created_by
)
select distinct
  membership.organization_id,
  membership.academic_year,
  membership.grade,
  btrim(membership.section),
  upper(regexp_replace(btrim(membership.section), '[^a-zA-Z0-9]+', '-', 'g')),
  organization.created_by
from public.student_school_memberships membership
join public.organizations organization on organization.id = membership.organization_id
where nullif(btrim(coalesce(membership.section, '')), '') is not null
on conflict do nothing;

update public.student_school_memberships membership
set section_id = section_row.id
from public.academic_sections section_row
where membership.section_id is null
  and section_row.organization_id = membership.organization_id
  and section_row.academic_year = membership.academic_year
  and section_row.grade = membership.grade
  and lower(section_row.name) = lower(btrim(coalesce(membership.section, '')));

create or replace function public.analytics_is_platform_admin_v10()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_evidara_platform_admin();
$$;

create or replace function public.analytics_is_school_admin_v10(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.analytics_is_platform_admin_v10()
    or exists(
      select 1
      from public.organization_members member
      where member.organization_id = p_organization_id
        and member.user_id = auth.uid()
        and member.is_active = true
        and member.member_role in ('institute_owner', 'institute_admin')
    );
$$;

create or replace function public.analytics_can_view_student_v10(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() = p_student_id
    or public.analytics_is_platform_admin_v10()
    or exists(
      select 1
      from public.student_school_memberships membership
      where membership.student_id = p_student_id
        and membership.status = 'active'
        and (
          public.analytics_is_school_admin_v10(membership.organization_id)
          or exists(
            select 1
            from public.teacher_section_assignments assignment
            join public.academic_sections section_row on section_row.id = assignment.section_id
            where assignment.teacher_id = auth.uid()
              and assignment.is_active = true
              and section_row.is_active = true
              and section_row.organization_id = membership.organization_id
              and section_row.id = membership.section_id
          )
        )
    );
$$;

grant execute on function public.analytics_is_platform_admin_v10() to authenticated;
grant execute on function public.analytics_is_school_admin_v10(uuid) to authenticated;
grant execute on function public.analytics_can_view_student_v10(uuid) to authenticated;

alter table public.academic_sections enable row level security;
alter table public.teacher_section_assignments enable row level security;

drop policy if exists academic_sections_read_v10 on public.academic_sections;
create policy academic_sections_read_v10
on public.academic_sections for select to authenticated
using (
  public.analytics_is_platform_admin_v10()
  or public.is_org_member(organization_id)
  or exists(
    select 1 from public.student_school_memberships membership
    where membership.student_id = auth.uid()
      and membership.section_id = academic_sections.id
      and membership.status = 'active'
  )
);

drop policy if exists teacher_section_assignments_read_v10 on public.teacher_section_assignments;
create policy teacher_section_assignments_read_v10
on public.teacher_section_assignments for select to authenticated
using (
  teacher_id = auth.uid()
  or public.analytics_is_platform_admin_v10()
  or exists(
    select 1
    from public.academic_sections section_row
    where section_row.id = teacher_section_assignments.section_id
      and public.analytics_is_school_admin_v10(section_row.organization_id)
  )
);

revoke insert, update, delete on public.academic_sections, public.teacher_section_assignments from authenticated;
grant select on public.academic_sections, public.teacher_section_assignments to authenticated;

create or replace function public.upsert_academic_section_v10(
  p_section_id uuid,
  p_organization_id uuid,
  p_academic_year text,
  p_grade integer,
  p_name text,
  p_code text default null,
  p_is_active boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section uuid;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.analytics_is_school_admin_v10(p_organization_id) then
    raise exception 'School Admin, Evidara Admin or Super Admin access required.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_academic_year, ''))) < 4 then raise exception 'Academic year is required.'; end if;
  if p_grade not between 1 and 12 then raise exception 'Grade must be between 1 and 12.'; end if;
  if length(btrim(coalesce(p_name, ''))) < 1 then raise exception 'Section name is required.'; end if;

  if p_section_id is null then
    insert into public.academic_sections(
      organization_id, academic_year, grade, name, code, is_active, created_by
    ) values (
      p_organization_id, btrim(p_academic_year), p_grade, btrim(p_name),
      nullif(upper(btrim(coalesce(p_code, ''))), ''), p_is_active, auth.uid()
    )
    returning id into v_section;
  else
    update public.academic_sections
    set academic_year = btrim(p_academic_year),
        grade = p_grade,
        name = btrim(p_name),
        code = nullif(upper(btrim(coalesce(p_code, ''))), ''),
        is_active = p_is_active,
        updated_at = now()
    where id = p_section_id
      and organization_id = p_organization_id
    returning id into v_section;
    if v_section is null then raise exception 'Section not found.'; end if;
  end if;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
  values(
    auth.uid(), p_organization_id,
    case when p_section_id is null then 'analytics.section.created' else 'analytics.section.updated' end,
    'academic_section', v_section::text,
    jsonb_build_object('academic_year', p_academic_year, 'grade', p_grade, 'name', p_name, 'active', p_is_active)
  );
  return v_section;
end;
$$;

create or replace function public.assign_student_section_v10(
  p_membership_id uuid,
  p_section_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.student_school_memberships%rowtype;
  v_section public.academic_sections%rowtype;
begin
  select * into v_membership
  from public.student_school_memberships
  where id = p_membership_id
  for update;
  if v_membership.id is null then raise exception 'Student membership not found.'; end if;
  if not public.analytics_is_school_admin_v10(v_membership.organization_id) then
    raise exception 'School Admin, Evidara Admin or Super Admin access required.' using errcode = '42501';
  end if;

  select * into v_section from public.academic_sections where id = p_section_id and is_active = true;
  if v_section.id is null then raise exception 'Active section not found.'; end if;
  if v_section.organization_id <> v_membership.organization_id
     or v_section.academic_year <> v_membership.academic_year
     or v_section.grade <> v_membership.grade then
    raise exception 'The section must match the student school, academic year and grade.';
  end if;

  update public.student_school_memberships
  set section_id = v_section.id,
      section = v_section.name,
      updated_at = now()
  where id = v_membership.id;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), v_membership.organization_id, 'analytics.student_section.assigned', 'student_membership',
    v_membership.id::text, jsonb_build_object('student_id', v_membership.student_id, 'section_id', v_section.id));

  return v_membership.id;
end;
$$;

create or replace function public.assign_teacher_section_v10(
  p_section_id uuid,
  p_teacher_id uuid,
  p_subject_label text default 'All subjects'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_section public.academic_sections%rowtype;
  v_assignment uuid;
  v_subject text := coalesce(nullif(btrim(p_subject_label), ''), 'All subjects');
begin
  select * into v_section from public.academic_sections where id = p_section_id;
  if v_section.id is null then raise exception 'Section not found.'; end if;
  if not public.analytics_is_school_admin_v10(v_section.organization_id) then
    raise exception 'School Admin, Evidara Admin or Super Admin access required.' using errcode = '42501';
  end if;
  if not exists(
    select 1 from public.organization_members member
    where member.organization_id = v_section.organization_id
      and member.user_id = p_teacher_id
      and member.is_active = true
      and member.member_role in ('teacher', 'reviewer', 'invigilator')
  ) then
    raise exception 'Choose an active teacher from this school.';
  end if;

  insert into public.teacher_section_assignments(
    section_id, teacher_id, subject_label, is_active, assigned_by
  ) values (
    p_section_id, p_teacher_id, v_subject, true, auth.uid()
  )
  on conflict(section_id, teacher_id, subject_label)
  do update set is_active = true, assigned_by = auth.uid(), updated_at = now()
  returning id into v_assignment;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), v_section.organization_id, 'analytics.teacher_section.assigned', 'teacher_section_assignment',
    v_assignment::text, jsonb_build_object('teacher_id', p_teacher_id, 'section_id', p_section_id, 'subject', v_subject));

  return v_assignment;
end;
$$;

create or replace function public.set_teacher_section_assignment_v10(
  p_assignment_id uuid,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select section_row.organization_id into v_org
  from public.teacher_section_assignments assignment
  join public.academic_sections section_row on section_row.id = assignment.section_id
  where assignment.id = p_assignment_id;

  if v_org is null then raise exception 'Teacher assignment not found.'; end if;
  if not public.analytics_is_school_admin_v10(v_org) then
    raise exception 'School Admin, Evidara Admin or Super Admin access required.' using errcode = '42501';
  end if;

  update public.teacher_section_assignments
  set is_active = p_is_active, updated_at = now()
  where id = p_assignment_id;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
  values(auth.uid(), v_org, 'analytics.teacher_section.status_changed', 'teacher_section_assignment',
    p_assignment_id::text, jsonb_build_object('active', p_is_active));
end;
$$;

grant execute on function public.upsert_academic_section_v10(uuid,uuid,text,integer,text,text,boolean) to authenticated;
grant execute on function public.assign_student_section_v10(uuid,uuid) to authenticated;
grant execute on function public.assign_teacher_section_v10(uuid,uuid,text) to authenticated;
grant execute on function public.set_teacher_section_assignment_v10(uuid,boolean) to authenticated;

create or replace function public.list_analytics_scope_v10()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  select role::text into v_role from public.profiles where id = v_user;

  return jsonb_build_object(
    'viewer_role', case
      when v_role = 'super_admin' then 'super_admin'
      when v_role in ('evidara_admin', 'admin', 'platform_admin') then 'evidara_admin'
      when v_role in ('institute_owner', 'institute_admin', 'school_owner', 'school_admin') then 'school_admin'
      when v_role in ('teacher', 'reviewer', 'invigilator', 'school_teacher') then 'school_teacher'
      else 'student'
    end,
    'organizations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', organization.id,
        'name', organization.name,
        'city', organization.city,
        'state', organization.state,
        'board', organization.board
      ) order by organization.name)
      from public.organizations organization
      where public.analytics_is_platform_admin_v10()
        or public.is_org_member(organization.id)
        or exists(
          select 1 from public.student_school_memberships membership
          where membership.organization_id = organization.id
            and membership.student_id = v_user
            and membership.status = 'active'
        )
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', section_row.id,
        'organization_id', section_row.organization_id,
        'academic_year', section_row.academic_year,
        'grade', section_row.grade,
        'name', section_row.name,
        'code', section_row.code,
        'is_active', section_row.is_active
      ) order by section_row.academic_year desc, section_row.grade, section_row.name)
      from public.academic_sections section_row
      where section_row.is_active = true
        and (
          public.analytics_is_platform_admin_v10()
          or public.analytics_is_school_admin_v10(section_row.organization_id)
          or exists(
            select 1 from public.teacher_section_assignments assignment
            where assignment.section_id = section_row.id
              and assignment.teacher_id = v_user
              and assignment.is_active = true
          )
          or exists(
            select 1 from public.student_school_memberships membership
            where membership.section_id = section_row.id
              and membership.student_id = v_user
              and membership.status = 'active'
          )
        )
    ), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', membership.student_id,
        'membership_id', membership.id,
        'full_name', coalesce(profile.full_name, 'Student'),
        'organization_id', membership.organization_id,
        'academic_year', membership.academic_year,
        'grade', membership.grade,
        'section_id', membership.section_id,
        'section_name', coalesce(section_row.name, membership.section, 'Unassigned'),
        'board', membership.board,
        'tracks', membership.tracks
      ) order by organization.name, membership.grade, coalesce(section_row.name, membership.section, ''), profile.full_name)
      from public.student_school_memberships membership
      join public.profiles profile on profile.id = membership.student_id
      join public.organizations organization on organization.id = membership.organization_id
      left join public.academic_sections section_row on section_row.id = membership.section_id
      where membership.status = 'active'
        and (
          membership.student_id = v_user
          or public.analytics_is_platform_admin_v10()
          or public.analytics_is_school_admin_v10(membership.organization_id)
          or exists(
            select 1 from public.teacher_section_assignments assignment
            where assignment.section_id = membership.section_id
              and assignment.teacher_id = v_user
              and assignment.is_active = true
          )
        )
    ), '[]'::jsonb),
    'teachers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'teacher_id', member.user_id,
        'full_name', coalesce(profile.full_name, 'Teacher'),
        'organization_id', member.organization_id,
        'member_role', member.member_role
      ) order by organization.name, profile.full_name)
      from public.organization_members member
      join public.profiles profile on profile.id = member.user_id
      join public.organizations organization on organization.id = member.organization_id
      where member.is_active = true
        and member.member_role in ('teacher', 'reviewer', 'invigilator')
        and (
          public.analytics_is_platform_admin_v10()
          or public.analytics_is_school_admin_v10(member.organization_id)
        )
    ), '[]'::jsonb),
    'teacher_assignments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', assignment.id,
        'section_id', assignment.section_id,
        'teacher_id', assignment.teacher_id,
        'subject_label', assignment.subject_label,
        'is_active', assignment.is_active
      ) order by assignment.assigned_at desc)
      from public.teacher_section_assignments assignment
      join public.academic_sections section_row on section_row.id = assignment.section_id
      where public.analytics_is_platform_admin_v10()
         or public.analytics_is_school_admin_v10(section_row.organization_id)
         or assignment.teacher_id = v_user
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.list_analytics_scope_v10() to authenticated;

create or replace function public.get_student_analytics_overview_v10(
  p_student_id uuid default auth.uid(),
  p_product_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_student uuid := coalesce(p_student_id, auth.uid());
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.analytics_can_view_student_v10(v_student) then
    raise exception 'You do not have access to this student analytics profile.' using errcode = '42501';
  end if;
  if p_from is not null and p_to is not null and p_to < p_from then
    raise exception 'The end date must be on or after the start date.';
  end if;

  with
  active_membership as (
    select membership.*, organization.name as organization_name
    from public.student_school_memberships membership
    join public.organizations organization on organization.id = membership.organization_id
    where membership.student_id = v_student and membership.status = 'active'
    order by membership.academic_year desc, membership.updated_at desc
    limit 1
  ),
  candidate_products as (
    select distinct product.id, product.name, product.exam_type
    from public.products product
    where product.status = 'published'
      and (
        exists(
          select 1 from public.entitlements entitlement
          where entitlement.product_id = product.id
            and entitlement.status = 'active'
            and (entitlement.expires_at is null or entitlement.expires_at > now())
            and (
              entitlement.user_id = v_student
              or (
                entitlement.organization_id in (select organization_id from active_membership)
                and (
                  entitlement.seat_limit is null
                  or exists(
                    select 1 from public.product_seat_assignments seat
                    where seat.entitlement_id = entitlement.id
                      and seat.student_id = v_student
                      and seat.status = 'active'
                  )
                )
              )
            )
        )
        or exists(
          select 1
          from public.product_papers product_paper
          join public.exam_attempts attempt on attempt.paper_id = product_paper.paper_id
          where product_paper.product_id = product.id
            and attempt.student_id = v_student
        )
      )
  ),
  product_rows as (
    select
      product.id,
      product.name,
      product.exam_type,
      count(distinct product_paper.paper_id)::integer as total_tests,
      count(distinct case when attempt.status = 'submitted' then product_paper.paper_id end)::integer as completed_tests,
      min(attempt.submitted_at)::date as first_completed_date,
      max(attempt.submitted_at)::date as last_completed_date
    from candidate_products product
    left join public.product_papers product_paper on product_paper.product_id = product.id
    left join public.exam_attempts attempt
      on attempt.paper_id = product_paper.paper_id
     and attempt.student_id = v_student
     and attempt.status = 'submitted'
    group by product.id, product.name, product.exam_type
  ),
  selected_attempts as (
    select
      attempt.*,
      paper.title as paper_title,
      paper.exam_type,
      paper.duration_minutes,
      paper.total_questions,
      paper.total_marks
    from public.exam_attempts attempt
    join public.question_papers paper on paper.id = attempt.paper_id
    where attempt.student_id = v_student
      and attempt.status = 'submitted'
      and (p_from is null or attempt.submitted_at::date >= p_from)
      and (p_to is null or attempt.submitted_at::date <= p_to)
      and (
        p_product_id is null
        or exists(
          select 1 from public.product_papers product_paper
          where product_paper.product_id = p_product_id
            and product_paper.paper_id = attempt.paper_id
        )
      )
  ),
  response_medians as (
    select response.attempt_id,
      percentile_cont(0.5) within group(order by response.time_spent_seconds)
        filter (where response.time_spent_seconds > 0) as median_seconds
    from public.exam_responses response
    join selected_attempts attempt on attempt.id = response.attempt_id
    group by response.attempt_id
  ),
  response_pacing as (
    select
      response.attempt_id,
      count(*) filter(where response.time_spent_seconds > 0) as timed_count,
      count(*) filter(
        where response.time_spent_seconds > 0
          and response.time_spent_seconds <= greatest(10, coalesce(median_row.median_seconds, 0) * 3)
      ) as controlled_count,
      count(*) filter(
        where response.time_spent_seconds >= greatest(2, coalesce(median_row.median_seconds, 0) * 0.2)
      ) as non_rushed_count
    from public.exam_responses response
    join selected_attempts attempt on attempt.id = response.attempt_id
    left join response_medians median_row on median_row.attempt_id = response.attempt_id
    group by response.attempt_id
  ),
  selected_with_time as (
    select
      attempt.*,
      round(least(10::numeric, greatest(0::numeric,
        10 * (
          0.35 * least(1::numeric, (attempt.correct_count + attempt.incorrect_count)::numeric / greatest(attempt.total_questions, 1))
          + 0.25 * case when coalesce(pacing.timed_count, 0) = 0 then 1
              else pacing.controlled_count::numeric / greatest(pacing.timed_count, 1) end
          + 0.20 * case when coalesce(pacing.timed_count, 0) = 0 then 1
              else pacing.non_rushed_count::numeric / greatest(pacing.timed_count, 1) end
          + 0.20 * case when attempt.submitted_at <= attempt.expires_at then 1 else 0 end
        )
      )), 1) as time_score
    from selected_attempts attempt
    left join response_pacing pacing on pacing.attempt_id = attempt.id
  ),
  selected_papers as (
    select distinct paper_id from selected_attempts
  ),
  cohort_attempts as (
    select attempt.*
    from public.exam_attempts attempt
    where attempt.status = 'submitted'
      and attempt.paper_id in (select paper_id from selected_papers)
  ),
  cohort_by_paper as (
    select
      attempt.paper_id,
      count(*)::integer as cohort_size,
      avg(attempt.percentage)::numeric as average_percentage,
      max(attempt.percentage)::numeric as highest_percentage,
      min(attempt.percentage)::numeric as lowest_percentage,
      percentile_cont(0.90) within group(order by attempt.percentage)::numeric as top10_threshold,
      percentile_cont(0.95) within group(order by attempt.percentage)::numeric as top5_threshold
    from cohort_attempts attempt
    group by attempt.paper_id
  ),
  trend_rows as (
    select
      attempt.id,
      attempt.paper_id,
      attempt.paper_title,
      attempt.submitted_at,
      attempt.score,
      attempt.maximum_marks,
      attempt.percentage,
      attempt.correct_count,
      attempt.incorrect_count,
      attempt.unanswered_count,
      attempt.time_score,
      cohort.cohort_size,
      case when cohort.cohort_size >= 5 then cohort.average_percentage end as average_percentage,
      case when cohort.cohort_size >= 5 then cohort.highest_percentage end as highest_percentage,
      case when cohort.cohort_size >= 5 then cohort.lowest_percentage end as lowest_percentage,
      case when cohort.cohort_size >= 5 then cohort.top5_threshold end as top5_threshold,
      case when cohort.cohort_size >= 5 then cohort.top10_threshold end as top10_threshold,
      case when cohort.cohort_size >= 2 then round(
        100 * (
          (select count(*) from cohort_attempts lower_attempt where lower_attempt.paper_id = attempt.paper_id and lower_attempt.percentage < attempt.percentage)
          + 0.5 * greatest(0, (select count(*) from cohort_attempts equal_attempt where equal_attempt.paper_id = attempt.paper_id and equal_attempt.percentage = attempt.percentage) - 1)
        ) / greatest(cohort.cohort_size - 1, 1), 1
      ) end as percentile
    from selected_with_time attempt
    left join cohort_by_paper cohort on cohort.paper_id = attempt.paper_id
  ),
  student_subject as (
    select
      coalesce(subject.name, section_row.title, question.question_snapshot->>'subject_name', 'General') as subject_name,
      sum(coalesce(response.marks_awarded, 0))::numeric as awarded_marks,
      sum(question.marks)::numeric as maximum_marks,
      count(*)::integer as questions,
      count(*) filter(where response.is_correct = true)::integer as correct,
      count(*) filter(where response.is_correct = false)::integer as incorrect
    from selected_attempts attempt
    join public.exam_responses response on response.attempt_id = attempt.id
    join public.paper_questions question on question.id = response.paper_question_id
    join public.paper_sections section_row on section_row.id = question.section_id
    left join public.subjects subject on subject.id = section_row.subject_id
    group by 1
  ),
  cohort_subject_attempt as (
    select
      cohort_attempt.id as attempt_id,
      coalesce(subject.name, section_row.title, question.question_snapshot->>'subject_name', 'General') as subject_name,
      100 * sum(coalesce(response.marks_awarded, 0))::numeric / greatest(sum(question.marks), 1) as percentage
    from cohort_attempts cohort_attempt
    join public.exam_responses response on response.attempt_id = cohort_attempt.id
    join public.paper_questions question on question.id = response.paper_question_id
    join public.paper_sections section_row on section_row.id = question.section_id
    left join public.subjects subject on subject.id = section_row.subject_id
    group by cohort_attempt.id, 2
  ),
  cohort_subject_stats as (
    select
      subject_name,
      count(*)::integer as cohort_size,
      avg(percentage)::numeric as average_percentage,
      max(percentage)::numeric as highest_percentage,
      min(percentage)::numeric as lowest_percentage,
      percentile_cont(0.90) within group(order by percentage)::numeric as top10_threshold,
      percentile_cont(0.95) within group(order by percentage)::numeric as top5_threshold
    from cohort_subject_attempt
    group by subject_name
  ),
  subject_rows as (
    select
      student.subject_name,
      round(100 * student.awarded_marks / greatest(student.maximum_marks, 1), 1) as student_percentage,
      round(student.awarded_marks, 1) as student_marks,
      round(student.maximum_marks, 1) as maximum_marks,
      student.questions,
      student.correct,
      student.incorrect,
      cohort.cohort_size,
      case when cohort.cohort_size >= 5 then round(cohort.average_percentage, 1) end as average_percentage,
      case when cohort.cohort_size >= 5 then round(cohort.highest_percentage, 1) end as highest_percentage,
      case when cohort.cohort_size >= 5 then round(cohort.lowest_percentage, 1) end as lowest_percentage,
      case when cohort.cohort_size >= 5 then round(cohort.top5_threshold, 1) end as top5_threshold,
      case when cohort.cohort_size >= 5 then round(cohort.top10_threshold, 1) end as top10_threshold
    from student_subject student
    left join cohort_subject_stats cohort on cohort.subject_name = student.subject_name
  ),
  selected_product as (
    select * from product_rows where id = p_product_id
  ),
  summary as (
    select
      count(*)::integer as completed_tests,
      round(avg(percentage), 1) as average_percentage,
      round(
        100 * sum(correct_count)::numeric / greatest(sum(correct_count + incorrect_count), 1),
        1
      ) as accuracy,
      sum(correct_count)::integer as correct,
      sum(incorrect_count)::integer as incorrect,
      sum(unanswered_count)::integer as unanswered,
      round(avg(time_score), 1) as time_score,
      round(avg(percentile), 1) as average_percentile,
      max(cohort_size)::integer as cohort_size,
      min(submitted_at)::date as from_date,
      max(submitted_at)::date as to_date
    from trend_rows
  )
  select jsonb_build_object(
    'student', (
      select jsonb_build_object(
        'id', profile.id,
        'full_name', coalesce(profile.full_name, 'Student'),
        'organization_id', membership.organization_id,
        'organization_name', membership.organization_name,
        'academic_year', membership.academic_year,
        'grade', membership.grade,
        'section_id', membership.section_id,
        'section_name', coalesce(section_row.name, membership.section, 'Unassigned'),
        'board', membership.board,
        'tracks', membership.tracks
      )
      from public.profiles profile
      left join active_membership membership on true
      left join public.academic_sections section_row on section_row.id = membership.section_id
      where profile.id = v_student
    ),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', product.id,
        'name', product.name,
        'exam_type', product.exam_type,
        'total_tests', product.total_tests,
        'completed_tests', product.completed_tests,
        'first_completed_date', product.first_completed_date,
        'last_completed_date', product.last_completed_date
      ) order by product.name)
      from product_rows product
    ), '[]'::jsonb),
    'selected_product', (
      select jsonb_build_object(
        'id', product.id,
        'name', product.name,
        'exam_type', product.exam_type,
        'total_tests', product.total_tests,
        'completed_tests', product.completed_tests,
        'percentile_available', product.total_tests > 0 and product.completed_tests >= product.total_tests
      ) from selected_product product
    ),
    'summary', (
      select jsonb_build_object(
        'completed_tests', coalesce(summary.completed_tests, 0),
        'average_percentage', summary.average_percentage,
        'accuracy', summary.accuracy,
        'correct', coalesce(summary.correct, 0),
        'incorrect', coalesce(summary.incorrect, 0),
        'unanswered', coalesce(summary.unanswered, 0),
        'time_score', summary.time_score,
        'average_percentile', case
          when p_product_id is not null
           and exists(select 1 from selected_product product where product.total_tests > 0 and product.completed_tests >= product.total_tests)
          then summary.average_percentile
          else null
        end,
        'percentile_available', p_product_id is not null
          and exists(select 1 from selected_product product where product.total_tests > 0 and product.completed_tests >= product.total_tests),
        'cohort_size', summary.cohort_size,
        'from_date', summary.from_date,
        'to_date', summary.to_date
      ) from summary
    ),
    'subjects', coalesce((
      select jsonb_agg(to_jsonb(subject) order by subject.subject_name)
      from subject_rows subject
    ), '[]'::jsonb),
    'trends', coalesce((
      select jsonb_agg(jsonb_build_object(
        'attempt_id', trend.id,
        'paper_id', trend.paper_id,
        'paper_title', trend.paper_title,
        'submitted_at', trend.submitted_at,
        'score', trend.score,
        'maximum_marks', trend.maximum_marks,
        'percentage', round(trend.percentage, 1),
        'percentile', trend.percentile,
        'accuracy', round(100 * trend.correct_count::numeric / greatest(trend.correct_count + trend.incorrect_count, 1), 1),
        'time_score', trend.time_score,
        'correct', trend.correct_count,
        'incorrect', trend.incorrect_count,
        'unanswered', trend.unanswered_count,
        'cohort_size', trend.cohort_size,
        'average_percentage', round(trend.average_percentage, 1),
        'highest_percentage', round(trend.highest_percentage, 1),
        'lowest_percentage', round(trend.lowest_percentage, 1),
        'top5_threshold', round(trend.top5_threshold, 1),
        'top10_threshold', round(trend.top10_threshold, 1)
      ) order by trend.submitted_at)
      from trend_rows trend
    ), '[]'::jsonb),
    'timeline', case
      when p_product_id is not null then coalesce((
        select jsonb_agg(jsonb_build_object(
          'paper_id', product_paper.paper_id,
          'display_name', product_paper.display_name,
          'display_order', product_paper.display_order,
          'completed', attempt.id is not null,
          'submitted_at', attempt.submitted_at,
          'percentage', attempt.percentage
        ) order by product_paper.display_order)
        from public.product_papers product_paper
        left join lateral (
          select selected.id, selected.submitted_at, selected.percentage
          from public.exam_attempts selected
          where selected.paper_id = product_paper.paper_id
            and selected.student_id = v_student
            and selected.status = 'submitted'
          order by selected.submitted_at desc
          limit 1
        ) attempt on true
        where product_paper.product_id = p_product_id
      ), '[]'::jsonb)
      else coalesce((
        select jsonb_agg(jsonb_build_object(
          'paper_id', trend.paper_id,
          'display_name', trend.paper_title,
          'completed', true,
          'submitted_at', trend.submitted_at,
          'percentage', trend.percentage
        ) order by trend.submitted_at)
        from trend_rows trend
      ), '[]'::jsonb)
    end,
    'generated_at', now()
  ) into v_result;

  return coalesce(v_result, jsonb_build_object(
    'student', null, 'products', '[]'::jsonb, 'selected_product', null,
    'summary', jsonb_build_object('completed_tests', 0, 'percentile_available', false),
    'subjects', '[]'::jsonb, 'trends', '[]'::jsonb, 'timeline', '[]'::jsonb,
    'generated_at', now()
  ));
end;
$$;

grant execute on function public.get_student_analytics_overview_v10(uuid,uuid,date,date) to authenticated;

insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
values(null, 'analytics.v10.phase1.schema_ready', 'system', '35_v10_analytics_phase_1',
  jsonb_build_object('sections', true, 'teacher_assignments', true, 'student_analytics_rpc', true));

commit;
