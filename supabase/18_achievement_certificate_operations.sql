-- Evidara V6.7: deterministic achievement evaluation and certificate lifecycle.
-- Apply after 17_achievement_badge_schema.sql.

create or replace function public.sync_achievement_award(
  p_student_id uuid,
  p_organization_id uuid,
  p_definition_code text,
  p_qualifies boolean,
  p_source_type text,
  p_source_id uuid,
  p_evidence jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_definition public.achievement_definitions%rowtype;
  v_existing public.student_achievements%rowtype;
  v_id uuid;
begin
  select * into v_definition
  from public.achievement_definitions
  where code = p_definition_code and is_active = true;
  if not found then return null; end if;

  select * into v_existing
  from public.student_achievements
  where student_id = p_student_id
    and organization_id = p_organization_id
    and definition_code = p_definition_code
  for update;

  if p_qualifies then
    if not found then
      insert into public.student_achievements(
        student_id, organization_id, definition_code, rule_version,
        source_type, source_id, evidence, status, awarded_at, last_evaluated_at
      ) values (
        p_student_id, p_organization_id, p_definition_code, v_definition.rule_version,
        p_source_type, p_source_id, coalesce(p_evidence, '{}'::jsonb), 'active', now(), now()
      ) returning id into v_id;

      insert into public.achievement_audit_events(
        achievement_id, student_id, organization_id, actor_id, event_type, details
      ) values (
        v_id, p_student_id, p_organization_id, auth.uid(), 'achievement.awarded',
        jsonb_build_object('definition_code', p_definition_code, 'rule_version', v_definition.rule_version, 'evidence', p_evidence)
      );
      return v_id;
    end if;

    update public.student_achievements
    set rule_version = v_definition.rule_version,
        source_type = p_source_type,
        source_id = p_source_id,
        evidence = coalesce(p_evidence, '{}'::jsonb),
        status = case
          when v_existing.status = 'revoked' and v_existing.revoked_reason = 'automatic_evidence_no_longer_valid' then 'active'
          else v_existing.status
        end,
        revoked_at = case
          when v_existing.status = 'revoked' and v_existing.revoked_reason = 'automatic_evidence_no_longer_valid' then null
          else v_existing.revoked_at
        end,
        revoked_by = case
          when v_existing.status = 'revoked' and v_existing.revoked_reason = 'automatic_evidence_no_longer_valid' then null
          else v_existing.revoked_by
        end,
        revoked_reason = case
          when v_existing.status = 'revoked' and v_existing.revoked_reason = 'automatic_evidence_no_longer_valid' then null
          else v_existing.revoked_reason
        end,
        last_evaluated_at = now(),
        updated_at = now()
    where id = v_existing.id
    returning id into v_id;

    if v_existing.status = 'revoked' and v_existing.revoked_reason = 'automatic_evidence_no_longer_valid' then
      insert into public.achievement_audit_events(
        achievement_id, student_id, organization_id, actor_id, event_type, details
      ) values (
        v_id, p_student_id, p_organization_id, auth.uid(), 'achievement.automatically_restored',
        jsonb_build_object('definition_code', p_definition_code, 'evidence', p_evidence)
      );
    end if;
    return v_id;
  end if;

  if found then
    if v_existing.status = 'active' then
      update public.student_achievements
      set status = 'revoked',
          revoked_at = now(),
          revoked_by = null,
          revoked_reason = 'automatic_evidence_no_longer_valid',
          last_evaluated_at = now(),
          updated_at = now()
      where id = v_existing.id;

      update public.achievement_certificates
      set status = 'revoked',
          revoked_at = now(),
          revoked_by = null,
          revoked_reason = 'achievement_evidence_no_longer_valid',
          updated_at = now()
      where achievement_id = v_existing.id and status = 'active';

      insert into public.achievement_audit_events(
        achievement_id, student_id, organization_id, actor_id, event_type, details
      ) values (
        v_existing.id, p_student_id, p_organization_id, auth.uid(), 'achievement.automatically_revoked',
        jsonb_build_object('definition_code', p_definition_code)
      );
    else
      update public.student_achievements
      set last_evaluated_at = now(), updated_at = now()
      where id = v_existing.id;
    end if;
    return v_existing.id;
  end if;

  return null;
end;
$$;

revoke all on function public.sync_achievement_award(uuid,uuid,text,boolean,text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.sync_achievement_award(uuid,uuid,text,boolean,text,uuid,jsonb) to service_role;

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
    and coalesce((a.metadata->>'benchmark_invalidated')::boolean, false) = false;

  select a.id, p.title, a.percentage
  into v_first_id, v_first_title, v_first_percentage
  from public.exam_attempts a
  join public.question_papers p on p.id = a.paper_id
  where a.student_id = p_student_id
    and a.status = 'submitted'
    and (a.organization_id = v_org or a.organization_id is null)
    and coalesce((a.metadata->>'benchmark_invalidated')::boolean, false) = false
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
    and coalesce((a.metadata->>'benchmark_invalidated')::boolean, false) = false
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
    and coalesce((a.metadata->>'benchmark_invalidated')::boolean, false) = false
  order by a.submitted_at asc
  limit 1;

  with recent as (
    select a.id, a.percentage
    from public.exam_attempts a
    where a.student_id = p_student_id
      and a.status = 'submitted'
      and (a.organization_id = v_org or a.organization_id is null)
      and coalesce((a.metadata->>'benchmark_invalidated')::boolean, false) = false
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
      and coalesce((a.metadata->>'benchmark_invalidated')::boolean, false) = false
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
      and coalesce((a.metadata->>'benchmark_invalidated')::boolean, false) = false
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

create or replace function public.evaluate_achievements_from_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid := new.organization_id;
begin
  if new.status <> 'submitted' then return new; end if;
  if v_org is null then
    select organization_id into v_org
    from public.student_school_memberships
    where student_id = new.student_id and status = 'active'
    order by academic_year desc, created_at desc
    limit 1;
  end if;
  if v_org is not null then
    perform public.evaluate_student_achievements(new.student_id, v_org, 'exam_attempt');
  end if;
  return new;
end;
$$;

create or replace function public.evaluate_achievements_from_benchmark()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.evaluate_student_achievements(new.student_id, new.organization_id, 'benchmark_contribution');
  return new;
end;
$$;

drop trigger if exists exam_attempt_evaluate_achievements on public.exam_attempts;
create trigger exam_attempt_evaluate_achievements
after insert or update of status, score, percentage, violation_count, metadata
on public.exam_attempts
for each row
when (new.status = 'submitted')
execute function public.evaluate_achievements_from_attempt();

drop trigger if exists benchmark_contribution_evaluate_achievements on public.benchmark_contributions;
create trigger benchmark_contribution_evaluate_achievements
after insert or update of is_valid, score, maximum_score
on public.benchmark_contributions
for each row
execute function public.evaluate_achievements_from_benchmark();

create or replace function public.backfill_organization_achievements(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
  v_students integer := 0;
begin
  if not public.is_school_manager(p_organization_id) then
    raise exception 'School-manager permission required.';
  end if;

  for v_student in
    select distinct student_id
    from public.student_school_memberships
    where organization_id = p_organization_id and status = 'active'
  loop
    perform public.evaluate_student_achievements(v_student, p_organization_id, 'backfill');
    v_students := v_students + 1;
  end loop;

  insert into public.achievement_audit_events(organization_id, actor_id, event_type, details)
  values(p_organization_id, auth.uid(), 'achievement.organization_backfilled', jsonb_build_object('students_evaluated', v_students));

  return v_students;
end;
$$;

grant execute on function public.backfill_organization_achievements(uuid) to authenticated;

create or replace function public.achievement_evidence_summary(p_code text, p_evidence jsonb)
returns text
language plpgsql
immutable
as $$
begin
  return case p_code
    when 'first_assessment' then 'Completed the first verified Evidara assessment.'
    when 'assessment_excellence' then format('Achieved %s%% on %s with %s evaluated questions.',
      coalesce(p_evidence->>'percentage','90+'), coalesce(p_evidence->>'paper_title','a verified assessment'), coalesce(p_evidence->>'question_count','10+'))
    when 'perfect_score' then format('Achieved 100%% on %s with %s evaluated questions.',
      coalesce(p_evidence->>'paper_title','a verified assessment'), coalesce(p_evidence->>'question_count','5+'))
    when 'growth_milestone' then format('Improved from %s%% to %s%% in comparable %s assessments.',
      coalesce(p_evidence->>'previous_percentage','an earlier result'), coalesce(p_evidence->>'current_percentage','a later result'), coalesce(p_evidence->>'exam_type','exam-type'))
    when 'consistent_performer' then format('Maintained at least %s%% across the three most recent verified assessments.',
      coalesce(p_evidence->>'minimum_percentage','75'))
    when 'integrity_streak' then 'Completed five recent verified assessments without a recorded integrity event.'
    when 'benchmark_participant' then 'Completed a valid shared-paper benchmark contribution.'
    when 'benchmark_top_decile' then format('Reached the %sth external percentile after the privacy minimum was satisfied.',
      coalesce(p_evidence->>'external_percentile','90'))
    else 'Awarded from verified Evidara assessment evidence.'
  end;
end;
$$;

create or replace function public.issue_achievement_certificate(p_achievement_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_achievement public.student_achievements%rowtype;
  v_definition public.achievement_definitions%rowtype;
  v_student_name text;
  v_org_name text;
  v_existing uuid;
  v_certificate uuid;
  v_number text;
  v_code text;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;

  select * into v_achievement
  from public.student_achievements
  where id = p_achievement_id
  for update;
  if not found then raise exception 'Achievement not found.'; end if;
  if v_achievement.status <> 'active' then raise exception 'Only an active achievement can receive a certificate.'; end if;

  if not (
    auth.uid() = v_achievement.student_id
    or public.is_school_manager(v_achievement.organization_id)
    or public.is_super_admin()
  ) then
    raise exception 'Certificate-issuance permission required.';
  end if;

  select * into v_definition
  from public.achievement_definitions
  where code = v_achievement.definition_code and is_active = true;
  if not found or not v_definition.certificate_eligible then
    raise exception 'This achievement does not issue a certificate.';
  end if;

  select id into v_existing
  from public.achievement_certificates
  where achievement_id = p_achievement_id and status = 'active'
  limit 1;
  if v_existing is not null then return v_existing; end if;

  select coalesce(full_name, username, 'Evidara Learner') into v_student_name
  from public.profiles where id = v_achievement.student_id;
  select name into v_org_name
  from public.organizations where id = v_achievement.organization_id;

  v_number := 'EVI-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  v_code := lower(encode(extensions.gen_random_bytes(18), 'hex'));

  insert into public.achievement_certificates(
    achievement_id, student_id, organization_id, certificate_number, verification_code,
    student_name_snapshot, organization_name_snapshot, achievement_title_snapshot,
    achievement_description_snapshot, rule_version, evidence_summary, issued_by
  ) values (
    v_achievement.id, v_achievement.student_id, v_achievement.organization_id, v_number, v_code,
    coalesce(v_student_name, 'Evidara Learner'), coalesce(v_org_name, 'Evidara School'), v_definition.title,
    v_definition.description, v_achievement.rule_version,
    public.achievement_evidence_summary(v_achievement.definition_code, v_achievement.evidence), auth.uid()
  ) returning id into v_certificate;

  insert into public.achievement_audit_events(
    achievement_id, certificate_id, student_id, organization_id, actor_id, event_type, details
  ) values (
    v_achievement.id, v_certificate, v_achievement.student_id, v_achievement.organization_id,
    auth.uid(), 'certificate.issued', jsonb_build_object('certificate_number', v_number, 'visibility', 'link_only')
  );

  return v_certificate;
end;
$$;

grant execute on function public.issue_achievement_certificate(uuid) to authenticated;

create or replace function public.set_student_achievement_status(
  p_achievement_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_achievement public.student_achievements%rowtype;
begin
  if p_status not in ('active','revoked') then raise exception 'Unsupported achievement status.'; end if;
  select * into v_achievement from public.student_achievements where id = p_achievement_id for update;
  if not found then raise exception 'Achievement not found.'; end if;
  if not (public.is_school_manager(v_achievement.organization_id) or public.is_super_admin()) then
    raise exception 'School-manager permission required.';
  end if;
  if v_achievement.status = p_status then return; end if;
  if p_status = 'active' and not public.is_super_admin() then
    raise exception 'Only Super Admin can restore a manually revoked achievement.';
  end if;

  update public.student_achievements
  set status = p_status,
      revoked_at = case when p_status = 'revoked' then now() else null end,
      revoked_by = case when p_status = 'revoked' then auth.uid() else null end,
      revoked_reason = case when p_status = 'revoked' then coalesce(nullif(trim(p_reason), ''), 'manual_school_review') else null end,
      updated_at = now()
  where id = p_achievement_id;

  if p_status = 'revoked' then
    update public.achievement_certificates
    set status = 'revoked', revoked_at = now(), revoked_by = auth.uid(),
        revoked_reason = 'linked_achievement_revoked', updated_at = now()
    where achievement_id = p_achievement_id and status = 'active';
  end if;

  insert into public.achievement_audit_events(
    achievement_id, student_id, organization_id, actor_id, event_type, details
  ) values (
    p_achievement_id, v_achievement.student_id, v_achievement.organization_id, auth.uid(),
    'achievement.status_changed', jsonb_build_object('from_status', v_achievement.status, 'to_status', p_status, 'reason', p_reason)
  );
end;
$$;

grant execute on function public.set_student_achievement_status(uuid,text,text) to authenticated;

create or replace function public.set_achievement_certificate_status(
  p_certificate_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_certificate public.achievement_certificates%rowtype;
begin
  if p_status not in ('active','revoked') then raise exception 'Unsupported certificate status.'; end if;
  select * into v_certificate from public.achievement_certificates where id = p_certificate_id for update;
  if not found then raise exception 'Certificate not found.'; end if;

  if not (
    auth.uid() = v_certificate.student_id
    or public.is_school_manager(v_certificate.organization_id)
    or public.is_super_admin()
  ) then
    raise exception 'Certificate-management permission required.';
  end if;
  if v_certificate.status = p_status then return; end if;
  if p_status = 'active' and not public.is_super_admin() then
    raise exception 'Only Super Admin can restore a revoked certificate.';
  end if;

  update public.achievement_certificates
  set status = p_status,
      revoked_at = case when p_status = 'revoked' then now() else null end,
      revoked_by = case when p_status = 'revoked' then auth.uid() else null end,
      revoked_reason = case when p_status = 'revoked' then coalesce(nullif(trim(p_reason), ''), 'certificate_withdrawn') else null end,
      updated_at = now()
  where id = p_certificate_id;

  insert into public.achievement_audit_events(
    achievement_id, certificate_id, student_id, organization_id, actor_id, event_type, details
  ) values (
    v_certificate.achievement_id, v_certificate.id, v_certificate.student_id, v_certificate.organization_id,
    auth.uid(), 'certificate.status_changed', jsonb_build_object('from_status', v_certificate.status, 'to_status', p_status, 'reason', p_reason)
  );
end;
$$;

grant execute on function public.set_achievement_certificate_status(uuid,text,text) to authenticated;
