create or replace function public.guard_attempt_limit_not_below_used_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_highest integer := 0;
begin
  if new.attempt_limit is null or new.attempt_limit < 1 then
    raise exception 'Attempts allowed must be at least 1.' using errcode='22023';
  end if;

  if tg_op = 'UPDATE' and new.attempt_limit is distinct from old.attempt_limit then
    select coalesce(max(attempt_number),0)
      into v_highest
    from public.exam_attempts
    where paper_id = new.id;

    if new.attempt_limit < v_highest then
      raise exception 'Attempts allowed cannot be lower than an attempt already used (%).', v_highest
        using errcode='22023';
    end if;
  end if;

  return new;
end
$function$;

drop trigger if exists guard_attempt_limit_not_below_used_v1 on public.question_papers;
create trigger guard_attempt_limit_not_below_used_v1
before insert or update of attempt_limit on public.question_papers
for each row execute function public.guard_attempt_limit_not_below_used_v1();
