-- Evidara V6.6 review hardening.
-- Resolves closed-window submissions, benchmark-specific attempt limits and
-- every question-paper field included in the published fingerprint.

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
  where id = v_publication.paper_id
    and status = 'published';

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
    select 1
    from public.benchmark_contributions
    where publication_id = v_publication.id
      and student_id = v_user
  ) or exists(
    select 1
    from public.exam_attempts
    where paper_id = v_paper.id
      and student_id = v_user
      and status = 'submitted'
      and metadata->>'benchmark_publication_id' = v_publication.id::text
  ) then
    raise exception 'Your submitted attempt has already been recorded for this benchmark.';
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

  -- attempt_number must remain globally unique for this paper and student, but
  -- ordinary attempts do not consume the benchmark-specific submission right.
  select count(*) + 1 into v_number
  from public.exam_attempts
  where paper_id = v_paper.id
    and student_id = v_user;

  if v_paper.shuffle_questions then
    select array_agg(id order by random()) into v_order
    from public.paper_questions
    where paper_id = v_paper.id;
  else
    select array_agg(id order by display_order, id) into v_order
    from public.paper_questions
    where paper_id = v_paper.id;
  end if;

  v_expiry := now() + make_interval(mins => v_paper.duration_minutes);
  if v_paper.available_until is not null then
    v_expiry := least(v_expiry, v_paper.available_until);
  end if;
  if v_publication.closes_at is not null then
    v_expiry := least(v_expiry, v_publication.closes_at);
  end if;

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
  v_contribution_id uuid;
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
  where id = v_publication_id
    and paper_id = new.paper_id;

  if not found then return new; end if;

  v_student_org := new.organization_id;
  if v_student_org is null then
    select membership.organization_id into v_student_org
    from public.student_school_memberships membership
    where membership.student_id = new.student_id
      and membership.status = 'active'
    order by membership.academic_year desc, membership.created_at desc
    limit 1;
  end if;
  if v_student_org is null then return new; end if;

  v_fingerprint := public.benchmark_paper_fingerprint(new.paper_id);

  if v_publication.status <> 'published' then
    v_valid := false; v_reason := 'benchmark_not_open';
  elsif new.maximum_marks <= 0 then
    v_valid := false; v_reason := 'maximum_marks_invalid';
  elsif new.submitted_at < coalesce(v_publication.opens_at, '-infinity'::timestamptz)
     or new.submitted_at > coalesce(v_publication.closes_at, 'infinity'::timestamptz)
     or new.submitted_at > coalesce(v_publication.closed_at, 'infinity'::timestamptz) then
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
  ) on conflict (publication_id, student_id) do nothing
  returning id into v_contribution_id;

  if v_contribution_id is not null then
    insert into public.benchmark_audit_events(publication_id, actor_id, event_type, details)
    values(v_publication.id, new.student_id, 'benchmark.contribution_recorded', jsonb_build_object(
      'attempt_id', new.id,
      'organization_id', v_student_org,
      'is_valid', v_valid,
      'exclusion_reason', v_reason
    ));
  end if;

  return new;
end;
$$;

-- The trigger already points to this function name; recreate it explicitly so
-- databases upgraded from earlier V6.6 drafts receive the hardened behaviour.
drop trigger if exists exam_attempt_sync_benchmark on public.exam_attempts;
create trigger exam_attempt_sync_benchmark
after insert or update of status, submitted_at, score, maximum_marks, violation_count, metadata
on public.exam_attempts
for each row
when (new.status = 'submitted')
execute function public.sync_benchmark_contribution_from_attempt();

create or replace function public.prevent_published_benchmark_paper_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paper_id uuid;
  v_fingerprint_change boolean := true;
begin
  if tg_table_name = 'question_papers' then
    if tg_op = 'DELETE' then
      v_paper_id := old.id;
    else
      v_paper_id := new.id;
      v_fingerprint_change :=
        old.title is distinct from new.title
        or old.exam_type is distinct from new.exam_type
        or old.duration_minutes is distinct from new.duration_minutes
        or old.total_marks is distinct from new.total_marks
        or old.total_questions is distinct from new.total_questions
        or old.shuffle_questions is distinct from new.shuffle_questions
        or old.shuffle_options is distinct from new.shuffle_options
        or old.result_mode is distinct from new.result_mode;
      if not v_fingerprint_change then return new; end if;
    end if;
  else
    if tg_op = 'DELETE' then v_paper_id := old.paper_id;
    else v_paper_id := new.paper_id;
    end if;
  end if;

  if exists(
    select 1
    from public.benchmark_publications
    where paper_id = v_paper_id
      and status in ('published','closed')
  ) then
    raise exception 'This exact paper version is locked by a published benchmark. Create a new paper version.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
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
