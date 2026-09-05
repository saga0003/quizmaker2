-- Evidara Phase 1 C6: one authoritative correct-answer model.
-- questions.correct_answer is canonical for scoring/snapshots. question_options.is_correct
-- is redundant authoring metadata and must agree with the canonical answer before an
-- approved question can exist or remain approved.

create or replace function public.validate_question_correct_answer_v1(p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_question public.questions%rowtype;
  v_answer_keys text[] := '{}'::text[];
  v_option_keys text[] := '{}'::text[];
  v_flagged_keys text[] := '{}'::text[];
  v_answer_count integer := 0;
  v_option_count integer := 0;
begin
  select * into v_question
  from public.questions
  where id = p_question_id;

  if not found or v_question.status is distinct from 'approved' then
    return;
  end if;

  if v_question.correct_answer is null
     or jsonb_typeof(v_question.correct_answer) <> 'array'
     or jsonb_array_length(v_question.correct_answer) = 0 then
    raise exception 'Question cannot be approved: canonical correct_answer must be a non-empty JSON array';
  end if;

  select coalesce(array_agg(answer_key order by answer_key), '{}'::text[]), count(*)
    into v_answer_keys, v_answer_count
  from (
    select distinct upper(btrim(value)) as answer_key
    from jsonb_array_elements_text(v_question.correct_answer)
    where nullif(btrim(value), '') is not null
  ) answers;

  if v_answer_count <> jsonb_array_length(v_question.correct_answer) then
    raise exception 'Question cannot be approved: canonical correct_answer contains blank or duplicate values';
  end if;

  if v_question.question_type in ('single_correct', 'assertion_reason', 'image_based')
     and v_answer_count <> 1 then
    raise exception 'Question cannot be approved: this question type requires exactly one canonical correct answer';
  end if;

  if v_question.question_type = 'multiple_correct' and v_answer_count < 1 then
    raise exception 'Question cannot be approved: multiple-correct questions require at least one canonical correct answer';
  end if;

  select
    coalesce(array_agg(upper(btrim(o.option_key)) order by upper(btrim(o.option_key))), '{}'::text[]),
    count(*)
    into v_option_keys, v_option_count
  from public.question_options o
  where o.question_id = p_question_id;

  if v_option_count > 0 then
    if exists (
      select 1
      from unnest(v_answer_keys) answer_key
      where not (answer_key = any(v_option_keys))
    ) then
      raise exception 'Question cannot be approved: canonical correct_answer references an option key that does not exist';
    end if;

    select coalesce(array_agg(upper(btrim(o.option_key)) order by upper(btrim(o.option_key))), '{}'::text[])
      into v_flagged_keys
    from public.question_options o
    where o.question_id = p_question_id
      and o.is_correct = true;

    if v_flagged_keys is distinct from v_answer_keys then
      raise exception 'Question cannot be approved: option is_correct flags must exactly match canonical correct_answer';
    end if;
  elsif v_question.question_type in ('single_correct', 'multiple_correct', 'assertion_reason', 'image_based') then
    raise exception 'Question cannot be approved: option-based question has no options';
  end if;
end;
$$;

revoke all on function public.validate_question_correct_answer_v1(uuid) from public, anon, authenticated;
grant execute on function public.validate_question_correct_answer_v1(uuid) to service_role;

create or replace function public.enforce_question_correct_answer_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_question_id uuid;
begin
  v_question_id := coalesce(new.id, old.id);
  perform public.validate_question_correct_answer_v1(v_question_id);
  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_question_correct_answer_v1() from public, anon, authenticated;
grant execute on function public.enforce_question_correct_answer_v1() to service_role;

create or replace function public.enforce_question_option_correct_answer_v1()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_question_id uuid;
begin
  v_question_id := coalesce(new.question_id, old.question_id);
  perform public.validate_question_correct_answer_v1(v_question_id);
  return coalesce(new, old);
end;
$$;

revoke all on function public.enforce_question_option_correct_answer_v1() from public, anon, authenticated;
grant execute on function public.enforce_question_option_correct_answer_v1() to service_role;

-- Deferred constraint triggers are intentional: save_question writes the canonical question
-- before replacing its option rows. Validation runs at transaction end, after both sides are final.
drop trigger if exists trg_question_correct_answer_v1 on public.questions;
create constraint trigger trg_question_correct_answer_v1
after insert or update of status, question_type, correct_answer on public.questions
deferrable initially deferred
for each row
execute function public.enforce_question_correct_answer_v1();

drop trigger if exists trg_question_option_correct_answer_v1 on public.question_options;
create constraint trigger trg_question_option_correct_answer_v1
after insert or update of question_id, option_key, is_correct or delete on public.question_options
deferrable initially deferred
for each row
execute function public.enforce_question_option_correct_answer_v1();

comment on function public.validate_question_correct_answer_v1(uuid) is
  'Phase 1 C6: treats questions.correct_answer as canonical and blocks approved option questions whose option correctness metadata disagrees.';
