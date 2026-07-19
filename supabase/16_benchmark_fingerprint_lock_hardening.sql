-- Evidara V6.6 final fingerprint-lock hardening.
-- Apply after 15_benchmark_security_and_lifecycle_hardening.sql.

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
    if tg_op = 'DELETE' then
      v_paper_id := old.paper_id;
    else
      v_paper_id := new.paper_id;
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
