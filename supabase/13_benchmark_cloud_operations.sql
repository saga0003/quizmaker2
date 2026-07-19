-- Evidara V6.6: fully operational benchmark publishing, joining and contribution sync.
-- Apply after 11_shared_benchmarks.sql and 12_benchmark_aggregate_function.sql.

create or replace function public.benchmark_paper_fingerprint(p_paper_id uuid)
returns text
language sql
stable
security definer
set search_path = public, extensions
as $$
  select encode(extensions.digest(convert_to(
    jsonb_build_object(
      'paper', jsonb_build_object(
        'id', p.id,
        'title', p.title,
        'exam_type', p.exam_type,
        'duration_minutes', p.duration_minutes,
        'total_marks', p.total_marks,
        'total_questions', p.total_questions,
        'shuffle_questions', p.shuffle_questions,
        'shuffle_options', p.shuffle_options,
        'result_mode', p.result_mode
      ),
      'sections', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', s.id,
          'title', s.title,
          'subject_id', s.subject_id,
          'questions_to_attempt', s.questions_to_attempt,
          'display_order', s.display_order
        ) order by s.display_order, s.id)
        from public.paper_sections s
        where s.paper_id = p.id
      ), '[]'::jsonb),
      'questions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', q.id,
          'section_id', q.section_id,
          'question_id', q.question_id,
          'display_order', q.display_order,
          'marks', q.marks,
          'negative_marks', q.negative_marks,
          'is_mandatory', q.is_mandatory,
          'snapshot', q.question_snapshot
        ) order by q.display_order, q.id)
        from public.paper_questions q
        where q.paper_id = p.id
      ), '[]'::jsonb)
    )::text,
    'UTF8'
  ), 'sha256'), 'hex')
  from public.question_papers p
  where p.id = p_paper_id;
$$;

revoke all on function public.benchmark_paper_fingerprint(uuid) from public, anon;
grant execute on function public.benchmark_paper_fingerprint(uuid) to authenticated, service_role;

create or replace function public.create_benchmark_publication(
  p_paper_id uuid,
  p_title text,
  p_paper_version text,
  p_access_code text,
  p_grade_label text default null,
  p_preparation_track text default null,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_paper public.question_papers%rowtype;
  v_fingerprint text;
  v_publication_id uuid;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;

  select * into v_paper from public.question_papers where id = p_paper_id;
  if not found then raise exception 'Question paper not found.'; end if;
  if v_paper.organization_id is null then raise exception 'A shared benchmark must belong to a school organization.'; end if;
  if not public.is_paper_manager(v_paper.organization_id) then raise exception 'Paper-manager permission required.'; end if;
  if v_paper.status <> 'published' then raise exception 'Publish the question paper before creating a benchmark.'; end if;
  if length(trim(coalesce(p_title, ''))) < 3 then raise exception 'Benchmark title is required.'; end if;
  if length(trim(coalesce(p_paper_version, ''))) < 3 then raise exception 'Exact paper version is required.'; end if;
  if length(trim(coalesce(p_access_code, ''))) < 6 then raise exception 'Benchmark access code must contain at least six characters.'; end if;
  if p_closes_at is not null and p_opens_at is not null and p_closes_at <= p_opens_at then
    raise exception 'Closing time must be after opening time.';
  end if;

  v_fingerprint := public.benchmark_paper_fingerprint(p_paper_id);
  if v_fingerprint is null then raise exception 'The paper fingerprint could not be calculated.'; end if;

  insert into public.benchmark_publications(
    paper_id, publisher_organization_id, title, paper_version, version_fingerprint,
    grade_label, preparation_track, access_code, status, opens_at, closes_at, created_by
  ) values (
    p_paper_id, v_paper.organization_id, trim(p_title), trim(p_paper_version), v_fingerprint,
    nullif(trim(p_grade_label), ''), nullif(trim(p_preparation_track), ''),
    upper(trim(p_access_code)), 'draft', p_opens_at, p_closes_at, auth.uid()
  ) returning id into v_publication_id;

  insert into public.benchmark_audit_events(publication_id, actor_id, event_type, details)
  values(v_publication_id, auth.uid(), 'benchmark.created', jsonb_build_object(
    'paper_id', p_paper_id,
    'version_fingerprint', v_fingerprint
  ));

  return v_publication_id;
end;
$$;

grant execute on function public.create_benchmark_publication(uuid,text,text,text,text,text,timestamptz,timestamptz) to authenticated;

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
      closed_at = case when p_status in ('closed','cancelled') then coalesce(closed_at, now()) else null end,
      updated_at = now()
  where id = p_publication_id;

  insert into public.benchmark_audit_events(publication_id, actor_id, event_type, details)
  values(p_publication_id, auth.uid(), 'benchmark.status_changed', jsonb_build_object('status', p_status));
end;
$$;

grant execute on function public.set_benchmark_publication_status(uuid,text) to authenticated;

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

  select * into v_paper from public.question_papers where id = v_publication.paper_id and status = 'published';
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

  if v_student_org is null then raise exception 'An active school membership is required for shared benchmarking.'; end if;

  if exists(
    select 1 from public.benchmark_contributions
    where publication_id = v_publication.id and student_id = v_user
  ) then
    raise exception 'Your first submitted attempt has already been recorded for this benchmark.';
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
    return jsonb_build_object('publication_id', v_publication.id, 'paper_id', v_paper.id, 'attempt_id', v_existing);
  end if;

  update public.exam_attempts
  set status = 'expired'
  where paper_id = v_paper.id
    and student_id = v_user
    and status = 'in_progress'
    and metadata->>'benchmark_publication_id' = v_publication.id::text
    and expires_at <= now();

  select count(*) + 1 into v_number
  from public.exam_attempts
  where paper_id = v_paper.id and student_id = v_user;

  if v_number > v_paper.attempt_limit then
    raise exception 'You have used all attempts for this paper.';
  end if;

  if v_paper.shuffle_questions then
    select array_agg(id order by random()) into v_order
    from public.paper_questions where paper_id = v_paper.id;
  else
    select array_agg(id order by display_order, id) into v_order
    from public.paper_questions where paper_id = v_paper.id;
  end if;

  v_expiry := now() + make_interval(mins => v_paper.duration_minutes);
  if v_paper.available_until is not null then v_expiry := least(v_expiry, v_paper.available_until); end if;
  if v_publication.closes_at is not null then v_expiry := least(v_expiry, v_publication.closes_at); end if;

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

  return jsonb_build_object('publication_id', v_publication.id, 'paper_id', v_paper.id, 'attempt_id', v_attempt);
end;
$$;

grant execute on function public.start_benchmark_attempt(text) to authenticated;

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
  ) on conflict (publication_id, student_id) do nothing;

  insert into public.benchmark_audit_events(publication_id, actor_id, event_type, details)
  values(v_publication.id, new.student_id, 'benchmark.contribution_recorded', jsonb_build_object(
    'attempt_id', new.id,
    'organization_id', v_student_org,
    'is_valid', v_valid,
    'exclusion_reason', v_reason
  ));

  return new;
end;
$$;

drop trigger if exists exam_attempt_sync_benchmark on public.exam_attempts;
create trigger exam_attempt_sync_benchmark
after insert or update of status, submitted_at, score, maximum_marks, violation_count, metadata
on public.exam_attempts
for each row
when (new.status = 'submitted')
execute function public.sync_benchmark_contribution_from_attempt();

create or replace function public.backfill_benchmark_contributions(p_publication_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publication public.benchmark_publications%rowtype;
  v_attempt public.exam_attempts%rowtype;
  v_before integer;
  v_after integer;
begin
  select * into v_publication from public.benchmark_publications where id = p_publication_id;
  if not found then raise exception 'Benchmark publication not found.'; end if;
  if not public.is_paper_manager(v_publication.publisher_organization_id) then
    raise exception 'Benchmark-manager permission required.';
  end if;

  select count(*) into v_before from public.benchmark_contributions where publication_id = p_publication_id;

  for v_attempt in
    select * from public.exam_attempts
    where paper_id = v_publication.paper_id
      and status = 'submitted'
      and metadata->>'benchmark_publication_id' = p_publication_id::text
    order by submitted_at
  loop
    perform public.sync_benchmark_contribution_from_attempt_record(v_attempt);
  end loop;

  select count(*) into v_after from public.benchmark_contributions where publication_id = p_publication_id;
  return v_after - v_before;
end;
$$;

-- Record helper used by explicit backfill. It mirrors the trigger through a
-- temporary update that safely re-fires the contribution trigger.
create or replace function public.sync_benchmark_contribution_from_attempt_record(p_attempt public.exam_attempts)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.exam_attempts
  set metadata = metadata || jsonb_build_object('benchmark_backfill_checked_at', now())
  where id = p_attempt.id;
end;
$$;

grant execute on function public.backfill_benchmark_contributions(uuid) to authenticated;
revoke all on function public.sync_benchmark_contribution_from_attempt_record(public.exam_attempts) from public, anon, authenticated;
grant execute on function public.sync_benchmark_contribution_from_attempt_record(public.exam_attempts) to service_role;

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
  v_publication_id uuid;
  v_org uuid;
begin
  select contribution.publication_id, publication.publisher_organization_id
  into v_publication_id, v_org
  from public.benchmark_contributions contribution
  join public.benchmark_publications publication on publication.id = contribution.publication_id
  where contribution.id = p_contribution_id;

  if not found then raise exception 'Benchmark contribution not found.'; end if;
  if not public.is_paper_manager(v_org) then raise exception 'Benchmark-manager permission required.'; end if;

  update public.benchmark_contributions
  set is_valid = p_is_valid,
      exclusion_reason = case when p_is_valid then null else coalesce(nullif(trim(p_reason), ''), 'manually_invalidated') end
  where id = p_contribution_id;

  insert into public.benchmark_audit_events(publication_id, actor_id, event_type, details)
  values(v_publication_id, auth.uid(), 'benchmark.contribution_validity_changed', jsonb_build_object(
    'contribution_id', p_contribution_id,
    'is_valid', p_is_valid,
    'reason', p_reason
  ));
end;
$$;

grant execute on function public.set_benchmark_contribution_validity(uuid,boolean,text) to authenticated;

create or replace function public.get_student_benchmark_result(
  p_publication_id uuid,
  p_student_id uuid,
  p_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_contribution public.benchmark_contributions%rowtype;
  v_summary jsonb;
  v_percentile numeric;
  v_ready boolean;
begin
  select * into v_contribution
  from public.benchmark_contributions
  where publication_id = p_publication_id
    and student_id = p_student_id
    and organization_id = p_organization_id;

  if not found then return null; end if;

  v_summary := public.get_private_benchmark_summary(p_publication_id, p_organization_id);
  v_ready := coalesce((v_summary->>'privacy_ready')::boolean, false);

  if v_ready and v_contribution.is_valid then
    select round(
      (100.0 * count(*) filter (where percentage <= v_contribution.percentage)) / nullif(count(*), 0),
      2
    ) into v_percentile
    from public.benchmark_contributions
    where publication_id = p_publication_id
      and organization_id <> p_organization_id
      and is_valid = true;
  end if;

  return jsonb_build_object(
    'publication_id', p_publication_id,
    'attempt_id', v_contribution.attempt_id,
    'score', v_contribution.score,
    'maximum_score', v_contribution.maximum_score,
    'percentage', round(v_contribution.percentage, 2),
    'is_valid', v_contribution.is_valid,
    'exclusion_reason', v_contribution.exclusion_reason,
    'submitted_at', v_contribution.submitted_at,
    'privacy_ready', v_ready,
    'network_percentile', case when v_ready then v_percentile else null end,
    'external_valid_attempts', v_summary->'external_valid_attempts'
  );
end;
$$;

revoke all on function public.get_student_benchmark_result(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_student_benchmark_result(uuid,uuid,uuid) to service_role;

create or replace function public.prevent_published_benchmark_paper_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paper_id uuid;
begin
  if tg_table_name = 'question_papers' then
    v_paper_id := coalesce(new.id, old.id);
    if tg_op = 'UPDATE' and not (
      old.duration_minutes is distinct from new.duration_minutes
      or old.total_marks is distinct from new.total_marks
      or old.total_questions is distinct from new.total_questions
      or old.shuffle_questions is distinct from new.shuffle_questions
      or old.shuffle_options is distinct from new.shuffle_options
      or old.result_mode is distinct from new.result_mode
    ) then
      return new;
    end if;
  else
    v_paper_id := coalesce(new.paper_id, old.paper_id);
  end if;

  if exists(
    select 1 from public.benchmark_publications
    where paper_id = v_paper_id and status in ('published','closed')
  ) then
    raise exception 'This exact paper version is locked by a published benchmark. Create a new paper version.';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists benchmark_lock_question_paper on public.question_papers;
create trigger benchmark_lock_question_paper
before update or delete on public.question_papers
for each row execute function public.prevent_published_benchmark_paper_mutation();

drop trigger if exists benchmark_lock_paper_sections on public.paper_sections;
create trigger benchmark_lock_paper_sections
before insert or update or delete on public.paper_sections
for each row execute function public.prevent_published_benchmark_paper_mutation();

drop trigger if exists benchmark_lock_paper_questions on public.paper_questions;
create trigger benchmark_lock_paper_questions
before insert or update or delete on public.paper_questions
for each row execute function public.prevent_published_benchmark_paper_mutation();
