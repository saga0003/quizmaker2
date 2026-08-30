-- Evidara Phase 1 hardening
-- Canonical paper audience materialisation + annual per-student licence enforcement.

create table if not exists public.paper_assignment_profiles (
  paper_id uuid primary key references public.question_papers(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audience jsonb not null default '{}'::jsonb,
  assigned_count integer not null default 0 check (assigned_count >= 0),
  materialized_at timestamptz,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.paper_student_assignments (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references public.question_papers(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  membership_id uuid not null references public.student_school_memberships(id) on delete restrict,
  status text not null default 'assigned' check (status in ('assigned','revoked')),
  assignment_snapshot jsonb not null default '{}'::jsonb,
  assigned_by uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (paper_id, student_id)
);

create index if not exists paper_student_assignments_student_idx
  on public.paper_student_assignments(student_id, status, paper_id);
create index if not exists paper_student_assignments_org_paper_idx
  on public.paper_student_assignments(organization_id, paper_id, status);

alter table public.paper_assignment_profiles enable row level security;
alter table public.paper_student_assignments enable row level security;

revoke all on public.paper_assignment_profiles from anon, authenticated;
revoke all on public.paper_student_assignments from anon, authenticated;
grant select on public.paper_assignment_profiles to authenticated;
grant select on public.paper_student_assignments to authenticated;
grant all on public.paper_assignment_profiles to service_role;
grant all on public.paper_student_assignments to service_role;

drop policy if exists paper_assignment_profiles_read_v19 on public.paper_assignment_profiles;
create policy paper_assignment_profiles_read_v19 on public.paper_assignment_profiles
for select to authenticated
using (
  public.is_evidara_platform_admin()
  or public.is_evidara_school_staff(organization_id)
);

drop policy if exists paper_student_assignments_read_v19 on public.paper_student_assignments;
create policy paper_student_assignments_read_v19 on public.paper_student_assignments
for select to authenticated
using (
  student_id = auth.uid()
  or public.is_evidara_platform_admin()
  or public.is_evidara_school_staff(organization_id)
);

-- One canonical subscription state for Phase 1.
-- active: full access; grace: 7-day continuity window; expired/suspended: historical read/export only.
create or replace function public.school_license_state_v19(p_organization_id uuid, p_on_date date default current_date)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_status text;
  v_starts date;
  v_ends date;
begin
  select s.status::text, s.starts_at, s.ends_at
    into v_status, v_starts, v_ends
  from public.school_subscriptions s
  where s.organization_id = p_organization_id
  order by s.ends_at desc, s.created_at desc
  limit 1;

  if v_status is null then return 'expired'; end if;
  if v_status in ('suspended','cancelled') then return 'suspended'; end if;
  if p_on_date between v_starts and v_ends and v_status in ('active','trial') then return 'active'; end if;
  if p_on_date > v_ends and p_on_date <= (v_ends + 7) and v_status in ('active','trial','expired') then return 'grace'; end if;
  return 'expired';
end;
$$;

create or replace function public.school_can_run_new_activity_v19(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.school_license_state_v19(p_organization_id, current_date) in ('active','grace');
$$;

-- Internal helpers are not exposed to browser clients.
revoke all on function public.school_license_state_v19(uuid,date) from public, anon, authenticated;
revoke all on function public.school_can_run_new_activity_v19(uuid) from public, anon, authenticated;
grant execute on function public.school_license_state_v19(uuid,date) to service_role;
grant execute on function public.school_can_run_new_activity_v19(uuid) to service_role;

-- Enforce licensed active-student quantity at the database boundary so all
-- account-import paths obey the same commercial rule.
create or replace function public.enforce_student_licence_v19()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit integer;
  v_used integer;
  v_state text;
  v_existing_active boolean := false;
begin
  if new.status::text <> 'active' then return new; end if;

  if tg_op = 'UPDATE' then
    v_existing_active := old.status::text = 'active' and old.organization_id = new.organization_id;
  end if;
  if v_existing_active then return new; end if;

  -- Serialize activations for one institution so concurrent imports cannot over-allocate seats.
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text, 0));

  v_state := public.school_license_state_v19(new.organization_id, current_date);
  if v_state not in ('active','grace') then
    raise exception 'This institution licence is not active. Renew the annual licence before activating students.' using errcode='42501';
  end if;

  select s.seat_limit into v_limit
  from public.school_subscriptions s
  where s.organization_id = new.organization_id
  order by s.ends_at desc, s.created_at desc
  limit 1;

  if coalesce(v_limit,0) <= 0 then
    raise exception 'No student licences are configured for this institution.' using errcode='23514';
  end if;

  select count(*)::integer into v_used
  from public.student_school_memberships membership
  where membership.organization_id = new.organization_id
    and membership.status::text = 'active';

  if v_used >= v_limit then
    raise exception 'Student licence limit reached (% licensed students). Increase the licensed quantity before activating another student.', v_limit using errcode='23514';
  end if;

  return new;
end;
$$;

drop trigger if exists student_membership_licence_guard_v19 on public.student_school_memberships;
create trigger student_membership_licence_guard_v19
before insert or update of organization_id, status on public.student_school_memberships
for each row execute function public.enforce_student_licence_v19();

-- Publishing a new institutional paper requires an active/grace licence. Drafts
-- and historical records remain editable/readable according to existing permissions.
create or replace function public.enforce_paper_publish_subscription_v19()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organization_id is not null
     and new.status::text = 'published'
     and (tg_op = 'INSERT' or old.status::text is distinct from 'published')
     and not public.school_can_run_new_activity_v19(new.organization_id) then
    raise exception 'The institution licence must be active before publishing a new test.' using errcode='42501';
  end if;
  return new;
end;
$$;

drop trigger if exists question_paper_publish_subscription_guard_v19 on public.question_papers;
create trigger question_paper_publish_subscription_guard_v19
before insert or update of status on public.question_papers
for each row execute function public.enforce_paper_publish_subscription_v19();

-- Validate that the signed-in staff member can manage the requested paper and
-- return its institution. Kept private and called by the public assignment RPCs.
create or replace function public.paper_assignment_org_v19(p_paper_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.question_papers where id=p_paper_id;
  if not found or v_org is null then raise exception 'Choose an institutional paper.' using errcode='22023'; end if;
  if not public.can_manage_v8_papers(v_org) then raise exception 'Paper-builder permission required.' using errcode='42501'; end if;
  return v_org;
end;
$$;
revoke all on function public.paper_assignment_org_v19(uuid) from public, anon, authenticated;
grant execute on function public.paper_assignment_org_v19(uuid) to service_role;

create or replace function public.preview_paper_assignment_v19(p_paper_id uuid, p_audience jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_org uuid := public.paper_assignment_org_v19(p_paper_id);
  v_year text := nullif(btrim(coalesce(p_audience->>'academic_year','')), '');
  v_grades integer[] := '{}';
  v_sections uuid[] := '{}';
  v_tracks text[] := '{}';
  v_students uuid[] := '{}';
  v_count integer;
  v_limit integer;
  v_active_count integer;
  v_sample jsonb;
begin
  if jsonb_typeof(coalesce(p_audience->'grades','[]'::jsonb))='array' then
    select coalesce(array_agg(value::integer),'{}'::integer[]) into v_grades from jsonb_array_elements_text(coalesce(p_audience->'grades','[]'::jsonb));
  end if;
  if jsonb_typeof(coalesce(p_audience->'section_ids','[]'::jsonb))='array' then
    select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_sections from jsonb_array_elements_text(coalesce(p_audience->'section_ids','[]'::jsonb));
  end if;
  if jsonb_typeof(coalesce(p_audience->'tracks','[]'::jsonb))='array' then
    select coalesce(array_agg(btrim(value)) filter(where btrim(value)<>''),'{}'::text[]) into v_tracks from jsonb_array_elements_text(coalesce(p_audience->'tracks','[]'::jsonb));
  end if;
  if jsonb_typeof(coalesce(p_audience->'student_ids','[]'::jsonb))='array' then
    select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_students from jsonb_array_elements_text(coalesce(p_audience->'student_ids','[]'::jsonb));
  end if;

  with eligible as (
    select membership.*, coalesce(profile.full_name,'Student') as full_name,
      coalesce(section_row.name,membership.section,'Unassigned') as section_name
    from public.student_school_memberships membership
    left join public.profiles profile on profile.id=membership.student_id
    left join public.academic_sections section_row on section_row.id=membership.section_id
    where membership.organization_id=v_org
      and membership.status::text='active'
      and (v_year is null or membership.academic_year=v_year)
      and (cardinality(v_grades)=0 or membership.grade=any(v_grades))
      and (cardinality(v_sections)=0 or membership.section_id=any(v_sections))
      and (cardinality(v_tracks)=0 or membership.tracks && v_tracks)
      and (cardinality(v_students)=0 or membership.student_id=any(v_students))
  )
  select count(*)::integer,
    coalesce(jsonb_agg(jsonb_build_object(
      'student_id',student_id,'membership_id',id,'name',full_name,'grade',grade,
      'section',section_name,'academic_year',academic_year,'tracks',tracks
    ) order by full_name) filter(where sample_rank<=10),'[]'::jsonb)
  into v_count,v_sample
  from (
    select eligible.*, row_number() over(order by full_name,student_id) as sample_rank from eligible
  ) ranked;

  select s.seat_limit into v_limit from public.school_subscriptions s where s.organization_id=v_org order by s.ends_at desc,s.created_at desc limit 1;
  select count(*)::integer into v_active_count from public.student_school_memberships m where m.organization_id=v_org and m.status::text='active';

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'organization_id',v_org,
    'audience',jsonb_build_object('academic_year',v_year,'grades',to_jsonb(v_grades),'section_ids',to_jsonb(v_sections),'tracks',to_jsonb(v_tracks),'student_ids',to_jsonb(v_students)),
    'assigned_count',coalesce(v_count,0),
    'sample',coalesce(v_sample,'[]'::jsonb),
    'licence',jsonb_build_object('state',public.school_license_state_v19(v_org,current_date),'licensed_students',coalesce(v_limit,0),'active_students',coalesce(v_active_count,0))
  );
end;
$$;

create or replace function public.assign_paper_audience_v19(p_paper_id uuid, p_audience jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org uuid := public.paper_assignment_org_v19(p_paper_id);
  v_preview jsonb;
  v_count integer;
  v_year text;
  v_grades integer[] := '{}';
  v_sections uuid[] := '{}';
  v_tracks text[] := '{}';
  v_students uuid[] := '{}';
begin
  if not public.school_can_run_new_activity_v19(v_org) then
    raise exception 'Renew the institution licence before assigning a new test.' using errcode='42501';
  end if;
  if exists(select 1 from public.exam_attempts where paper_id=p_paper_id) then
    raise exception 'This test already has student attempts. Its assigned cohort is frozen; clone the paper for a different audience.' using errcode='23514';
  end if;

  v_preview := public.preview_paper_assignment_v19(p_paper_id,p_audience);
  v_count := coalesce((v_preview->>'assigned_count')::integer,0);
  if v_count < 1 then raise exception 'The selected audience contains no active students.' using errcode='22023'; end if;
  v_year := nullif(btrim(coalesce(v_preview->'audience'->>'academic_year','')), '');
  select coalesce(array_agg(value::integer),'{}'::integer[]) into v_grades from jsonb_array_elements_text(coalesce(v_preview->'audience'->'grades','[]'::jsonb));
  select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_sections from jsonb_array_elements_text(coalesce(v_preview->'audience'->'section_ids','[]'::jsonb));
  select coalesce(array_agg(value),'{}'::text[]) into v_tracks from jsonb_array_elements_text(coalesce(v_preview->'audience'->'tracks','[]'::jsonb));
  select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_students from jsonb_array_elements_text(coalesce(v_preview->'audience'->'student_ids','[]'::jsonb));

  delete from public.paper_student_assignments where paper_id=p_paper_id;

  insert into public.paper_student_assignments(
    paper_id,organization_id,student_id,membership_id,status,assignment_snapshot,assigned_by,assigned_at
  )
  select p_paper_id,v_org,membership.student_id,membership.id,'assigned',jsonb_build_object(
    'academic_year',membership.academic_year,
    'grade',membership.grade,
    'section_id',membership.section_id,
    'section',coalesce(section_row.name,membership.section,'Unassigned'),
    'board',membership.board,
    'tracks',membership.tracks
  ),auth.uid(),now()
  from public.student_school_memberships membership
  left join public.academic_sections section_row on section_row.id=membership.section_id
  where membership.organization_id=v_org
    and membership.status::text='active'
    and (v_year is null or membership.academic_year=v_year)
    and (cardinality(v_grades)=0 or membership.grade=any(v_grades))
    and (cardinality(v_sections)=0 or membership.section_id=any(v_sections))
    and (cardinality(v_tracks)=0 or membership.tracks && v_tracks)
    and (cardinality(v_students)=0 or membership.student_id=any(v_students));

  get diagnostics v_count = row_count;

  insert into public.paper_assignment_profiles(paper_id,organization_id,audience,assigned_count,materialized_at,updated_by,updated_at)
  values(p_paper_id,v_org,coalesce(v_preview->'audience','{}'::jsonb),v_count,now(),auth.uid(),now())
  on conflict(paper_id) do update set
    organization_id=excluded.organization_id,
    audience=excluded.audience,
    assigned_count=excluded.assigned_count,
    materialized_at=excluded.materialized_at,
    updated_by=excluded.updated_by,
    updated_at=excluded.updated_at;

  update public.question_papers
  set settings=coalesce(settings,'{}'::jsonb) || jsonb_build_object('assignment',coalesce(v_preview->'audience','{}'::jsonb),'assigned_student_count',v_count),
      updated_by=auth.uid(),updated_at=now()
  where id=p_paper_id;

  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),v_org,'paper.assignment.materialized','question_paper',p_paper_id::text,jsonb_build_object('assigned_count',v_count,'audience',v_preview->'audience'));

  return v_preview || jsonb_build_object('assigned_count',v_count,'materialized',true,'materialized_at',now());
end;
$$;

create or replace function public.paper_assignment_allows_student_v19(p_paper_id uuid, p_student_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when not exists(select 1 from public.paper_assignment_profiles profile where profile.paper_id=p_paper_id)
      then exists(
        select 1 from public.question_papers paper
        where paper.id=p_paper_id and paper.organization_id is not null
          and public.is_active_student_member(paper.organization_id,p_student_id)
      )
    else exists(
      select 1 from public.paper_student_assignments assignment
      where assignment.paper_id=p_paper_id and assignment.student_id=p_student_id and assignment.status='assigned'
    )
  end;
$$;
revoke all on function public.paper_assignment_allows_student_v19(uuid,uuid) from public, anon, authenticated;
grant execute on function public.paper_assignment_allows_student_v19(uuid,uuid) to service_role;

grant execute on function public.preview_paper_assignment_v19(uuid,jsonb) to authenticated;
grant execute on function public.assign_paper_audience_v19(uuid,jsonb) to authenticated;

-- Student-facing paper visibility now respects both materialised assignment and licence state.
create or replace function public.list_available_papers()
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'title',p.title,'description',p.description,'exam_type',p.exam_type,
    'grade_level',p.grade_level,'test_type',p.test_type,'custom_test_type',p.custom_test_type,
    'duration_minutes',p.duration_minutes,'total_marks',p.total_marks,'total_questions',p.total_questions,
    'available_from',p.available_from,'available_until',p.available_until,'open_forever',p.open_forever,
    'attempt_limit',p.attempt_limit,
    'attempts_used',(select count(*) from public.exam_attempts a where a.paper_id=p.id and a.student_id=auth.uid()),
    'result_mode',p.result_mode,'access_mode',p.access_mode,
    'access_label',case when exists(select 1 from public.product_papers pp where pp.paper_id=p.id) then 'paid' when p.organization_id is not null then 'included' else coalesce(p.access_label::text,'included') end
  ) order by p.available_from nulls first,p.created_at desc),'[]'::jsonb)
  from public.question_papers p
  where auth.uid() is not null
    and p.status='published'
    and (p.open_forever or p.available_from is null or p.available_from<=now())
    and (p.open_forever or p.available_until is null or p.available_until>=now())
    and (
      (p.organization_id is not null
        and public.school_can_run_new_activity_v19(p.organization_id)
        and (public.is_org_member(p.organization_id) or public.paper_assignment_allows_student_v19(p.id,auth.uid())))
      or (p.organization_id is null and public.can_access_product_paper_v9(p.id,auth.uid()))
    );
$$;

create or replace function public.find_paper_by_code(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce((select jsonb_build_object(
    'id',p.id,'title',p.title,'description',p.description,'exam_type',p.exam_type,
    'grade_level',p.grade_level,'test_type',p.test_type,'custom_test_type',p.custom_test_type,
    'duration_minutes',p.duration_minutes,'total_marks',p.total_marks,'total_questions',p.total_questions,
    'available_from',p.available_from,'available_until',p.available_until,'attempt_limit',p.attempt_limit,
    'attempts_used',(select count(*) from public.exam_attempts a where a.paper_id=p.id and a.student_id=auth.uid()),
    'result_mode',p.result_mode,'access_mode',p.access_mode,'access_label','included'
  ) from public.question_papers p
  where auth.uid() is not null and p.status='published' and p.access_mode='code'
    and upper(btrim(p.access_code))=upper(btrim(p_code))
    and (p.available_from is null or p.available_from<=now())
    and (p.available_until is null or p.available_until>=now())
    and (
      (p.organization_id is not null
        and public.school_can_run_new_activity_v19(p.organization_id)
        and (public.is_org_member(p.organization_id) or public.paper_assignment_allows_student_v19(p.id,auth.uid())))
      or (p.organization_id is null and public.can_access_product_paper_v9(p.id,auth.uid()))
    )
  limit 1),'null'::jsonb);
$$;

-- Start wrapper repeats the existing entitlement safeguards while adding the two
-- Phase 1 gates: active annual licence + assigned student cohort.
create or replace function public.start_exam_attempt(p_paper_id uuid, p_access_code text default null::text)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid := auth.uid();
  v_paper public.question_papers%rowtype;
  v_existing uuid;
  v_attempt uuid;
  v_number integer;
  v_order uuid[];
  v_expiry timestamptz;
  v_product_id uuid;
  v_entitlement public.entitlements%rowtype;
  v_product_attempts integer := 0;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  select * into v_paper from public.question_papers where id=p_paper_id and status='published';
  if not found then raise exception 'This test is not available.'; end if;
  if v_paper.available_from is not null and now()<v_paper.available_from then raise exception 'This test has not opened yet.'; end if;
  if v_paper.available_until is not null and now()>v_paper.available_until then raise exception 'This test has closed.'; end if;

  if v_paper.organization_id is not null then
    if not public.school_can_run_new_activity_v19(v_paper.organization_id) then
      raise exception 'This institution licence is not active. Contact your school administrator.' using errcode='42501';
    end if;
    if not public.is_org_member(v_paper.organization_id) and not public.paper_assignment_allows_student_v19(v_paper.id,v_user) then
      raise exception 'This test is not assigned to your student account.' using errcode='42501';
    end if;
  end if;
  if v_paper.access_mode='code' and upper(btrim(coalesce(p_access_code,'')))<>upper(btrim(coalesce(v_paper.access_code,''))) then
    raise exception 'Invalid test access code.';
  end if;

  select id into v_existing from public.exam_attempts
  where paper_id=p_paper_id and student_id=v_user and status='in_progress' and expires_at>now()
  order by started_at desc limit 1;
  if v_existing is not null then return v_existing; end if;
  update public.exam_attempts set status='expired' where paper_id=p_paper_id and student_id=v_user and status='in_progress' and expires_at<=now();
  select count(*)+1 into v_number from public.exam_attempts where paper_id=p_paper_id and student_id=v_user;
  if v_number>v_paper.attempt_limit then raise exception 'You have used all attempts for this test.'; end if;

  select pp.product_id into v_product_id from public.product_papers pp where pp.paper_id=p_paper_id order by pp.display_order,pp.created_at limit 1;
  if v_product_id is not null then
    select entitlement.* into v_entitlement from public.entitlements entitlement
    where entitlement.id=(
      select candidate.id from (
        select direct_entitlement.id,0 as priority from public.entitlements direct_entitlement
        where direct_entitlement.product_id=v_product_id and direct_entitlement.user_id=v_user and direct_entitlement.status='active' and (direct_entitlement.expires_at is null or direct_entitlement.expires_at>now())
        union all
        select school_entitlement.id,1 as priority from public.entitlements school_entitlement
        join public.student_school_memberships membership on membership.organization_id=school_entitlement.organization_id and membership.student_id=v_user and membership.status::text='active'
        where school_entitlement.product_id=v_product_id and school_entitlement.organization_id is not null and school_entitlement.status='active' and (school_entitlement.expires_at is null or school_entitlement.expires_at>now())
          and (school_entitlement.seat_limit is null or exists(select 1 from public.product_seat_assignments seat where seat.entitlement_id=school_entitlement.id and seat.student_id=v_user and seat.status='active'))
      ) candidate order by candidate.priority,candidate.id limit 1
    ) for update;
    if not found then raise exception 'Purchase this paper series or ask your school to assign a product seat before starting the test.'; end if;
    select count(*)::integer into v_product_attempts from public.product_attempt_usage usage where usage.entitlement_id=v_entitlement.id and usage.entitlement_started_at=v_entitlement.starts_at;
    if v_entitlement.attempts_limit is not null and v_product_attempts>=v_entitlement.attempts_limit then raise exception 'You have used all purchased attempts for this paper series.'; end if;
  end if;

  if v_paper.shuffle_questions then select array_agg(id order by random()) into v_order from public.paper_questions where paper_id=p_paper_id;
  else select array_agg(id order by display_order,id) into v_order from public.paper_questions where paper_id=p_paper_id; end if;
  v_expiry:=now()+make_interval(mins=>v_paper.duration_minutes);
  if v_paper.available_until is not null then v_expiry:=least(v_expiry,v_paper.available_until); end if;
  insert into public.exam_attempts(paper_id,student_id,organization_id,attempt_number,status,expires_at,question_order,maximum_marks,unanswered_count)
  values(p_paper_id,v_user,v_paper.organization_id,v_number,'in_progress',v_expiry,coalesce(v_order,'{}'),v_paper.total_marks,v_paper.total_questions)
  returning id into v_attempt;
  if v_product_id is not null then
    insert into public.product_attempt_usage(entitlement_id,product_id,paper_id,student_id,attempt_id,entitlement_started_at,attempts_used)
    values(v_entitlement.id,v_product_id,p_paper_id,v_user,v_attempt,v_entitlement.starts_at,v_product_attempts+1);
    update public.entitlements set attempts_used=v_product_attempts+1,updated_at=now() where id=v_entitlement.id;
  end if;
  return v_attempt;
end;
$$;
