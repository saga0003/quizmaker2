-- Production hotfix discovered during E8 load-fixture setup.
-- Avoid CASE record-field evaluation across different trigger row types.
create or replace function public.finalize_question_duplicate_hash_v2()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_question_id uuid;
  v_hash text;
begin
  if tg_table_name = 'question_options' then
    if tg_op = 'DELETE' then v_question_id := old.question_id;
    else v_question_id := new.question_id;
    end if;
  else
    if tg_op = 'DELETE' then v_question_id := old.id;
    else v_question_id := new.id;
    end if;
  end if;

  if v_question_id is null or not exists(select 1 from public.questions where id=v_question_id) then return null; end if;
  v_hash := public.question_duplicate_hash_v2(v_question_id);
  update public.questions set duplicate_hash=v_hash where id=v_question_id and duplicate_hash is distinct from v_hash;
  return null;
end;
$$;
revoke all on function public.finalize_question_duplicate_hash_v2() from public, anon, authenticated;
grant execute on function public.finalize_question_duplicate_hash_v2() to service_role;
