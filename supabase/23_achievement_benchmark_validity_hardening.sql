-- Evidara V6.7: exclude invalid shared-benchmark attempts from every
-- assessment-derived achievement rule.
-- Apply after 22_achievement_certificate_restore_hardening.sql.

create or replace function public.achievement_exam_attempt_is_valid(
  p_attempt_id uuid,
  p_metadata jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((p_metadata->>'benchmark_invalidated')::boolean, false) = false
    and case
      when nullif(p_metadata->>'benchmark_publication_id', '') is not null
        or exists(
          select 1
          from public.benchmark_contributions contribution
          where contribution.attempt_id = p_attempt_id
        )
      then exists(
        select 1
        from public.benchmark_contributions contribution
        where contribution.attempt_id = p_attempt_id
          and contribution.is_valid = true
      )
      else true
    end
$$;

revoke all on function public.achievement_exam_attempt_is_valid(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.achievement_exam_attempt_is_valid(uuid,jsonb) to service_role;

create or replace function public.evaluate_student_achievements(
  p_student_id uuid,
  p_organization_id uuid default null,
  p_source_type text default 'aggregate_refresh'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_org uuid := p_organization_id;
  v_attempt_count integer := 0;
  v_first_id uuid;
  v_first_title text;
  v_first_percentage numeric;
  v_excellence_id uuid;
  v_excellence_title text;
  v_excellence_percentage numeric;
  v_excellence_questions integer;
  v_perfect_id uuid;
  v_perfect_title text;
  v_perfect_questions integer;
  v_recent_three_count integer := 0;
  v_recent_three_min numeric;
  v_recent_three_average numeric;
  v_recent_three_source uuid;
  v_growth_id uuid;
  v_growth_title text;
  v_growth_exam_type text;
  v_growth_previous numeric;
  v_growth_current numeric;
  v_integrity_count integer := 0;
  v_integrity_max integer;
  v_integrity_source uuid;
  v_benchmark_id uuid;
  v_benchmark_percentage numeric;
  v_distinction_id uuid;
  v_distinction_percentage numeric;
  v_distinction_percentile numeric;
  v_changed integer := 0;
  v_id uuid;
begin
  if v_org is null then
    select membership.organization_id into v_org
    from public.student_school_memberships membership
    where membership.student_id = p_student_id and membership.status = 'active'
    order by membership.academic_year desc, membership.created_at desc
    limit 1;
  end if;
  if v_org is null then raise exception 'An active school membership is required for achievement evaluation.'; end if;

  if not (
    v_actor = p_student_id
    or public.is_school_manager(v_org)
    or public.is_super_admin()
    or current_setting('request.jwt.claim.role', true) = 'service_role'
  ) then
    raise exception 'Achievement evaluation permission required.';
  end if;

  if not exists(
    select 1 from public.student_school_memberships
    where student_id = p_student_id and organization_id = v_org and status = 'active'
  ) and not exists(
    select 1 from public.exam_attempts
    where student_id = p_student_id and organization_id = v_org
  ) then
    raise exception 'The learner is not linked to this school.';
  end if;

  select count(*) into v_attempt_count
  from public.exam_attempts a
  where a.student_id = p_student_id
    and a.status = 'submitted'
    and (a.organization_id = v_org or a.organization_id is null)
    and public.achievement_exam_attempt_is_valid(a.id, a.metadata);

  select a.id, p.title, a.percentage
  into v_first_id, v_first_title, v_first_percentage
  from public.exam_attempts a
  join public.question_papers p on p.id = a.paper_id
  where a.student_id = p_student_id
    and a.status = 'submitted'
    and (a.organization_id = v_org or a.organization_id is null)
    and public.achievement_exam_attempt_is_valid(a.id, a.metadata)
  order by a.submitted_at asc nulls last, a.created_at asc
  limit 1;

  select a.id, p.title, a.percentage,
         (a.correct_count + a.incorrect_count + a.unanswered_count)
  into v_excellence_id, v_excellence_title, v_excellence_percentage, v_excellence_questions
  from public.exam_attempts a
  join public.question_papers p on p.id = a.paper_id
  where a.student_id = p_student_id
    and a.status = 'submitted'
    and (a.organization_id = v_org or a.organization_id is null)
    and a.percentage >= 90
    and (a.correct_count + a.incorrect_count + a.unanswered_count) >= 10
    and public.achievement_exam_attempt_is_valid(a.id, a.metadata)
  order by a.percentage desc, a.submitted_at asc
  limit 1;

  select a.id, p.title,
         (a.correct_count + a.incorrect_count + a.unanswered_count)
  into v_perfect_id, v_perfect_title, v_perfect_questions
  from public.exam_attempts a
  join public.question_papers p on p.id = a.paper_id
  where a.student_id = p_student_id
    and a.status = 'submitted'
    and (a.organization_id = v_org or a.organization_id is null)
    and a.percentage >= 100
    and (a.correct_count + a.incorrect_count + a.unanswered_count) >= 5
    and public.achievement_exam_attempt_is_valid(a.id, a.metadata)
  order by a.submitted_at asc
  limit 1;

  with recent as (
    select a.id, a.percentage
    from public.exam_attempts a
    where a.student_id = p_student_id
      and a.status = 'submitted'
      and (a.organization_id = v_org or a.organization_id is null)
      and public.achievement_exam_attempt_is_valid(a.id, a.metadata)
    order by a.submitted_at desc nulls last, a.created_at desc
    limit 3
  )
  select count(*), min(percentage), round(avg(percentage), 2), max(id)
  into v_recent_three_count, v_recent_three_min, v_recent_three_average, v_recent_three_source
  from recent;

  with comparable as (
    select a.id, p.title, p.exam_type, a.percentage, a.submitted_at,
           lag(a.percentage) over(partition by p.exam_type order by a.submitted_at, a.created_at) as previous_percentage
    from public.exam_attempts a
    join public.question_papers p on p.id = a.paper_id
    where a.student_id = p_student_id
      and a.status = 'submitted'
      and (a.organization_id = v_org or a.organization_id is null)
      and public.achievement_exam_attempt_is_valid(a.id, a.metadata)
  )
  select id, title, exam_type, previous_percentage, percentage
  into v_growth_id, v_growth_title, v_growth_exam_type, v_growth_previous, v_growth_current
  from comparable
  where previous_percentage is not null and percentage - previous_percentage >= 15
  order by submitted_at desc
  limit 1;

  with recent as (
    select a.id, a.violation_count
    from public.exam_attempts a
    where a.student_id = p_student_id
      and a.status = 'submitted'
      and (a.organization_id = v_org or a.organization_id is null)
      and public.achievement_exam_attempt_is_valid(a.id, a.metadata)
    order by a.submitted_at desc nulls last, a.created_at desc
    limit 5
  )
  select count(*), max(violation_count), max(id)
  into v_integrity_count, v_integrity_max, v_integrity_source
  from recent;

  select c.id, round(c.percentage, 2)
  into v_benchmark_id, v_benchmark_percentage
  from public.benchmark_contributions c
  where c.student_id = p_student_id
    and c.organization_id = v_org
    and c.is_valid = true
  order by c.submitted_at asc
  limit 1;

  with eligible as (
    select
      own.id,
      own.percentage,
      round(
        100.0 * count(ext.id) filter(where ext.percentage <= own.percentage) / nullif(count(ext.id), 0),
        2
      ) as network_percentile,
      count(ext.id) as external_attempts,
      count(distinct ext.organization_id) as external_schools,
      publication.privacy_minimum,
      publication.privacy_minimum_schools,
      own.submitted_at
    from public.benchmark_contributions own
    join public.benchmark_publications publication on publication.id = own.publication_id
    join public.benchmark_contributions ext
      on ext.publication_id = own.publication_id
     and ext.organization_id <> v_org
     and ext.is_valid = true
    where own.student_id = p_student_id
      and own.organization_id = v_org
      and own.is_valid = true
    group by own.id, own.percentage, own.submitted_at,
             publication.privacy_minimum, publication.privacy_minimum_schools
  )
  select id, round(percentage, 2), network_percentile
  into v_distinction_id, v_distinction_percentage, v_distinction_percentile
  from eligible
  where external_attempts >= privacy_minimum
    and external_schools >= privacy_minimum_schools
    and network_percentile >= 90
  order by submitted_at desc
  limit 1;

  v_id := public.sync_achievement_award(
    p_student_id, v_org, 'first_assessment', v_attempt_count >= 1,
    coalesce(p_source_type, 'aggregate_refresh'), v_first_id,
    jsonb_build_object('submitted_attempts', v_attempt_count, 'paper_title', v_first_title, 'percentage', v_first_percentage)
  ); if v_id is not null then v_changed := v_changed + 1; end if;

  v_id := public.sync_achievement_award(
    p_student_id, v_org, 'assessment_excellence', v_excellence_id is not null,
    'exam_attempt', v_excellence_id,
    jsonb_build_object('paper_title', v_excellence_title, 'percentage', v_excellence_percentage, 'question_count', v_excellence_questions)
  ); if v_id is not null then v_changed := v_changed + 1; end if;

  v_id := public.sync_achievement_award(
    p_student_id, v_org, 'perfect_score', v_perfect_id is not null,
    'exam_attempt', v_perfect_id,
    jsonb_build_object('paper_title', v_perfect_title, 'percentage', 100, 'question_count', v_perfect_questions)
  ); if v_id is not null then v_changed := v_changed + 1; end if;

  v_id := public.sync_achievement_award(
    p_student_id, v_org, 'growth_milestone', v_growth_id is not null,
    'exam_attempt', v_growth_id,
    jsonb_build_object(
      'paper_title', v_growth_title,
      'exam_type', v_growth_exam_type,
      'previous_percentage', v_growth_previous,
      'current_percentage', v_growth_current,
      'percentage_point_improvement', case when v_growth_id is null then null else v_growth_current - v_growth_previous end
    )
  ); if v_id is not null then v_changed := v_changed + 1; end if;

  v_id := public.sync_achievement_award(
    p_student_id, v_org, 'consistent_performer', v_recent_three_count = 3 and v_recent_three_min >= 75,
    'aggregate_refresh', v_recent_three_source,
    jsonb_build_object('assessment_count', v_recent_three_count, 'minimum_percentage', v_recent_three_min, 'average_percentage', v_recent_three_average)
  ); if v_id is not null then v_changed := v_changed + 1; end if;

  v_id := public.sync_achievement_award(
    p_student_id, v_org, 'integrity_streak', v_integrity_count = 5 and coalesce(v_integrity_max, 1) = 0,
    'aggregate_refresh', v_integrity_source,
    jsonb_build_object('assessment_count', v_integrity_count, 'maximum_recorded_integrity_events', v_integrity_max)
  ); if v_id is not null then v_changed := v_changed + 1; end if;

  v_id := public.sync_achievement_award(
    p_student_id, v_org, 'benchmark_participant', v_benchmark_id is not null,
    'benchmark_contribution', v_benchmark_id,
    jsonb_build_object('percentage', v_benchmark_percentage, 'valid_contribution', v_benchmark_id is not null)
  ); if v_id is not null then v_changed := v_changed + 1; end if;

  v_id := public.sync_achievement_award(
    p_student_id, v_org, 'benchmark_top_decile', v_distinction_id is not null,
    'benchmark_contribution', v_distinction_id,
    jsonb_build_object('percentage', v_distinction_percentage, 'external_percentile', v_distinction_percentile, 'privacy_threshold_met', v_distinction_id is not null)
  ); if v_id is not null then v_changed := v_changed + 1; end if;

  return v_changed;
end;
$$;

grant execute on function public.evaluate_student_achievements(uuid,uuid,text) to authenticated, service_role;

comment on function public.achievement_exam_attempt_is_valid(uuid,jsonb) is
  'Returns true only when an ordinary attempt is not invalidated, or when a benchmark-linked attempt has a currently valid benchmark contribution.';
