-- Evidara V6.6 final hardening.
-- Apply after 14_benchmark_operation_hardening.sql.

-- Paper fingerprints are an internal integrity primitive. Authenticated browser
-- clients do not need direct execution permission.
revoke all on function public.benchmark_paper_fingerprint(uuid) from public, anon, authenticated;
grant execute on function public.benchmark_paper_fingerprint(uuid) to service_role;

-- Benchmark participation has its own one-submission rule. A learner's earlier
-- ordinary attempt on the same paper must not consume the benchmark opportunity.
create or replace function public.start_benchmark_attempt(p_access_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_publication public.benchmark_publications%rowtype;
  v_paper public.question_papers%rowtype;
  v_student_org uuid;
  v_existing uuid;
  v_attempt uuid;
  v_number integer;
  v_order uuid[];
  v_expiry timestamptz;
begin
  if v_user is null then raise exception 'Login required.'; end if;

  select * into v_publication
  from public.benchmark_publications
  where upper(access_code) = upper(trim(p_access_code))
    and status = 'published'
    and (opens_at is null or opens_at <= now())
    and (closes_at is null or closes_at >= now())
  limit 1;

  if not found then raise exception 'No active shared benchmark matches this access code.'; end if;

  select * into v_paper
  from public.question_papers
  where id = v_publication.paper_id and status = 'published';
  if not found then raise exception 'The linked question paper is not available.'; end if;

  if public.benchmark_paper_fingerprint(v_paper.id) is distinct from v_publication.version_fingerprint then
    raise exception 'The linked paper no longer matches the published benchmark version.';
  end if;

  select membership.organization_id into v_student_org
  from public.student_school_memberships membership
  where membership.student_id = v_user
    and membership.status = 'active'
  order by membership.academic_year desc, membership.created_at desc
  limit 1;

  if v_student_org is null then
    raise exception 'An active school membership is required for shared benchmarking.';
  end if;

  if exists(
    select 1 from public.benchmark_contributions
    where publication_id = v_publication.id and student_id = v_user
  ) or exists(
    select 1 from public.exam_attempts
    where student_id = v_user
      and status = 'submitted'
      and metadata->>'benchmark_publication_id' = v_publication.id::text
  ) then
    raise exception 'Your benchmark submission has already been recorded.';
  end if;

  select id into v_existing
  from public.exam_attempts
  where paper_id = v_paper.id
    and student_id = v_user
    and status = 'in_progress'
    and metadata->>'benchmark_publication_id' = v_publication.id::text
    and expires_at > now()
  order by started_at desc
  limit 1;

  if v_existing is not null then
    return jsonb_build_object(
      'publication_id', v_publication.id,
      'paper_id', v_paper.id,
      'attempt_id', v_existing
    );
  end if;

  update public.exam_attempts
  set status = 'expired'
  where paper_id = v_paper.id
    and student_id = v_user
    and status = 'in_progress'
    and metadata->>'benchmark_publication_id' = v_publication.id::text
    and expires_at <= now();

  select coalesce(max(attempt_number), 0) + 1 into v_number
  from public.exam_attempts
  where paper_id = v_paper.id and student_id = v_user;

  if v_paper.shuffle_questions then
    select array_agg(id order by random()) into v_order
    from public.paper_questions where paper_id = v_paper.id;
  else
    select array_agg(id order by display_order, id) into v_order
    from public.paper_questions where paper_id = v_paper.id;
  end if;

  v_expiry := now() + make_interval(mins => v_paper.duration_minutes);
  if v_paper.available_until is not null then
    v_expiry := least(v_expiry, v_paper.available_until);
  end if;
  if v_publication.closes_at is not null then
    v_expiry := least(v_expiry, v_publication.closes_at);
  end if;
  if v_expiry <= now() then raise exception 'This benchmark window has closed.'; end if;

  insert into public.exam_attempts(
    paper_id, student_id, organization_id, attempt_number, status, expires_at,
    question_order, maximum_marks, unanswered_count, metadata
  ) values (
    v_paper.id, v_user, v_student_org, v_number, 'in_progress', v_expiry,
    coalesce(v_order, '{}'), v_paper.total_marks, v_paper.total_questions,
    jsonb_build_object(
      'benchmark_publication_id', v_publication.id,
      'benchmark_fingerprint', v_publication.version_fingerprint,
      'benchmark_access_code_used', true
    )
  ) returning id into v_attempt;

  insert into public.benchmark_audit_events(publication_id, actor_id, event_type, details)
  values(v_publication.id, v_user, 'benchmark.attempt_started', jsonb_build_object(
    'attempt_id', v_attempt,
    'organization_id', v_student_org
  ));

  return jsonb_build_object(
    'publication_id', v_publication.id,
    'paper_id', v_paper.id,
    'attempt_id', v_attempt
  );
end;
$$;

grant execute on function public.start_benchmark_attempt(text) to authenticated;

-- Re-evaluate the same submitted attempt during a backfill, while preserving the
-- first-submission-only rule when a different attempt conflicts for the learner.
create or replace function public.sync_benchmark_contribution_from_attempt()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_publication public.benchmark_publications%rowtype;
  v_publication_id uuid;
  v_student_org uuid;
  v_fingerprint text;
  v_valid boolean := true;
  v_reason text := null;
  v_rows integer := 0;
begin
  if new.status <> 'submitted' or new.submitted_at is null then return new; end if;

  begin
    v_publication_id := nullif(new.metadata->>'benchmark_publication_id', '')::uuid;
  exception when others then
    return new;
  end;
  if v_publication_id is null then return new; end if;

  select * into v_publication
  from public.benchmark_publications
  where id = v_publication_id and paper_id = new.paper_id;
  if not found then return new; end if;

  v_student_org := new.organization_id;
  if v_student_org is null then
    select membership.organization_id into v_student_org
    from public.student_school_memberships membership
    where membership.student_id = new.student_id and membership.status = 'active'
    order by membership.academic_year desc, membership.created_at desc
    limit 1;
  end if;
  if v_student_org is null then return new; end if;

  v_fingerprint := public.benchmark_paper_fingerprint(new.paper_id);

  if new.maximum_marks <= 0 then
    v_valid := false; v_reason := 'maximum_marks_invalid';
  elsif new.submitted_at < coalesce(v_publication.opens_at, '-infinity'::timestamptz)
     or new.submitted_at > coalesce(v_publication.closes_at, 'infinity'::timestamptz) then
    v_valid := false; v_reason := 'outside_benchmark_window';
  elsif v_publication.closed_at is not null and new.submitted_at > v_publication.closed_at then
    v_valid := false; v_reason := 'after_manual_close';
  elsif new.violation_count > v_publication.max_violation_count then
    v_valid := false; v_reason := 'integrity_violation_limit';
  elsif coalesce((new.metadata->>'benchmark_invalidated')::boolean, false) then
    v_valid := false; v_reason := 'attempt_invalidated';
  elsif v_fingerprint is distinct from v_publication.version_fingerprint then
    v_valid := false; v_reason := 'paper_fingerprint_mismatch';
  elsif new.metadata->>'benchmark_fingerprint' is distinct from v_publication.version_fingerprint then
    v_valid := false; v_reason := 'attempt_version_mismatch';
  end if;

  insert into public.benchmark_contributions(
    publication_id, attempt_id, organization_id, student_id, attempt_number,
    score, maximum_score, is_valid, exclusion_reason, violation_count,
    source_fingerprint, submitted_at
  ) values (
    v_publication.id, new.id, v_student_org, new.student_id, new.attempt_number,
    new.score, new.maximum_marks, v_valid, v_reason, new.violation_count,
    coalesce(v_fingerprint, v_publication.version_fingerprint), new.submitted_at
  )
  on conflict (publication_id, student_id) do update set
    score = excluded.score,
    maximum_score = excluded.maximum_score,
    is_valid = excluded.is_valid,
    exclusion_reason = excluded.exclusion_reason,
    violation_count = excluded.violation_count,
    source_fingerprint = excluded.source_fingerprint,
    submitted_at = excluded.submitted_at,
    contributed_at = now()
  where public.benchmark_contributions.attempt_id = excluded.attempt_id;

  get diagnostics v_rows = row_count;

  insert into public.benchmark_audit_events(publication_id, actor_id, event_type, details)
  values(v_publication.id, new.student_id,
    case when v_rows > 0 then 'benchmark.contribution_recorded' else 'benchmark.duplicate_submission_ignored' end,
    jsonb_build_object(
      'attempt_id', new.id,
      'organization_id', v_student_org,
      'is_valid', v_valid,
      'exclusion_reason', v_reason
    )
  );

  return new;
end;
$$;

-- Published and terminal states cannot be silently reopened or returned to draft.
create or replace function public.set_benchmark_publication_status(
  p_publication_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_publication public.benchmark_publications%rowtype;
  v_current_fingerprint text;
begin
  if p_status not in ('draft','published','closed','cancelled') then
    raise exception 'Unsupported benchmark status.';
  end if;

  select * into v_publication
  from public.benchmark_publications
  where id = p_publication_id
  for update;

  if not found then raise exception 'Benchmark publication not found.'; end if;
  if not public.is_paper_manager(v_publication.publisher_organization_id) then
    raise exception 'Benchmark-manager permission required.';
  end if;
  if v_publication.status = p_status then return; end if;

  if not (
    (v_publication.status = 'draft' and p_status in ('published','cancelled'))
    or (v_publication.status = 'published' and p_status in ('closed','cancelled'))
  ) then
    raise exception 'This benchmark lifecycle transition is not allowed.';
  end if;

  if p_status = 'published' then
    v_current_fingerprint := public.benchmark_paper_fingerprint(v_publication.paper_id);
    if v_current_fingerprint is distinct from v_publication.version_fingerprint then
      raise exception 'The paper changed after this benchmark draft was created. Create a new benchmark version.';
    end if;
    if v_publication.closes_at is not null and v_publication.closes_at <= now() then
      raise exception 'The benchmark closing time has already passed.';
    end if;
  end if;

  update public.benchmark_publications
  set status = p_status,
      published_at = case when p_status = 'published' then coalesce(published_at, now()) else published_at end,
      closed_at = case when p_status in ('closed','cancelled') then coalesce(closed_at, now()) else closed_at end,
      updated_at = now()
  where id = p_publication_id;

  insert into public.benchmark_audit_events(publication_id, actor_id, event_type, details)
  values(p_publication_id, auth.uid(), 'benchmark.status_changed', jsonb_build_object(
    'from_status', v_publication.status,
    'to_status', p_status
  ));
end;
$$;

grant execute on function public.set_benchmark_publication_status(uuid,text) to authenticated;

-- Schools can remove and restore only their own manually reviewed contribution.
-- Automatic integrity exclusions require Super Admin review before restoration.
create or replace function public.set_benchmark_contribution_validity(
  p_contribution_id uuid,
  p_is_valid boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contribution public.benchmark_contributions%rowtype;
  v_publication_id uuid;
  v_allowed boolean := false;
begin
  select * into v_contribution
  from public.benchmark_contributions
  where id = p_contribution_id
  for update;

  if not found then raise exception 'Benchmark contribution not found.'; end if;
  v_publication_id := v_contribution.publication_id;
  v_allowed := public.is_super_admin() or public.is_paper_manager(v_contribution.organization_id);
  if not v_allowed then raise exception 'A school can review only its own student contributions.'; end if;

  if p_is_valid and not public.is_super_admin()
     and v_contribution.exclusion_reason is distinct from 'manually_invalidated' then
    raise exception 'Automatic integrity exclusions require Super Admin review.';
  end if;

  update public.benchmark_contributions
  set is_valid = p_is_valid,
      exclusion_reason = case
        when p_is_valid then null
        else coalesce(nullif(trim(p_reason), ''), 'manually_invalidated')
      end
  where id = p_contribution_id;

  insert into public.benchmark_audit_events(publication_id, actor_id, event_type, details)
  values(v_publication_id, auth.uid(), 'benchmark.contribution_validity_changed', jsonb_build_object(
    'contribution_id', p_contribution_id,
    'is_valid', p_is_valid,
    'reason', case when p_is_valid then null else coalesce(nullif(trim(p_reason), ''), 'manually_invalidated') end
  ));
end;
$$;

grant execute on function public.set_benchmark_contribution_validity(uuid,boolean,text) to authenticated;
