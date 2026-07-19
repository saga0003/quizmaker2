-- Evidara V6.6 hardening for explicit backfill and immutable paper versions.

create or replace function public.backfill_benchmark_contributions(p_publication_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publication public.benchmark_publications%rowtype;
  v_attempt_id uuid;
  v_before integer;
  v_after integer;
begin
  select * into v_publication
  from public.benchmark_publications
  where id = p_publication_id;

  if not found then raise exception 'Benchmark publication not found.'; end if;
  if not public.is_paper_manager(v_publication.publisher_organization_id) then
    raise exception 'Benchmark-manager permission required.';
  end if;

  select count(*) into v_before
  from public.benchmark_contributions
  where publication_id = p_publication_id;

  for v_attempt_id in
    select id
    from public.exam_attempts
    where paper_id = v_publication.paper_id
      and status = 'submitted'
      and metadata->>'benchmark_publication_id' = p_publication_id::text
    order by submitted_at
  loop
    -- Updating this metadata field re-fires the submission trigger without
    -- changing marks, answers, status or the student's original submission time.
    update public.exam_attempts
    set metadata = metadata || jsonb_build_object('benchmark_backfill_checked_at', now())
    where id = v_attempt_id;
  end loop;

  select count(*) into v_after
  from public.benchmark_contributions
  where publication_id = p_publication_id;

  return v_after - v_before;
end;
$$;

grant execute on function public.backfill_benchmark_contributions(uuid) to authenticated;

drop function if exists public.sync_benchmark_contribution_from_attempt_record(public.exam_attempts);

create or replace function public.prevent_published_benchmark_paper_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paper_id uuid;
  v_content_change boolean := true;
begin
  if tg_table_name = 'question_papers' then
    if tg_op = 'DELETE' then
      v_paper_id := old.id;
    else
      v_paper_id := new.id;
      v_content_change :=
        old.duration_minutes is distinct from new.duration_minutes
        or old.total_marks is distinct from new.total_marks
        or old.total_questions is distinct from new.total_questions
        or old.shuffle_questions is distinct from new.shuffle_questions
        or old.shuffle_options is distinct from new.shuffle_options
        or old.result_mode is distinct from new.result_mode;
      if not v_content_change then return new; end if;
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

-- Recreate triggers against the hardened function.
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
