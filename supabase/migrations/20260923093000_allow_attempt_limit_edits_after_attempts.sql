create or replace function public.update_question_paper_attempt_limit_v1(
  p_paper_id uuid,
  p_attempt_limit integer
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'extensions', 'auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_organization_id uuid;
  v_current_limit integer;
  v_highest_attempt integer := 0;
begin
  if v_user is null then
    raise exception 'Login required.' using errcode = '42501';
  end if;

  if p_attempt_limit is null or p_attempt_limit < 1 then
    raise exception 'Attempts allowed must be at least 1.' using errcode = '22023';
  end if;

  select organization_id, attempt_limit
    into v_organization_id, v_current_limit
  from public.question_papers
  where id = p_paper_id
  for update;

  if not found then
    raise exception 'Paper not found.';
  end if;

  if not public.can_manage_v8_papers(v_organization_id) then
    raise exception 'Paper-builder permission required.' using errcode = '42501';
  end if;

  select coalesce(max(attempt_number), 0)
    into v_highest_attempt
  from public.exam_attempts
  where paper_id = p_paper_id;

  if p_attempt_limit < v_highest_attempt then
    raise exception 'Attempts allowed cannot be lower than an attempt already used (%).', v_highest_attempt
      using errcode = '22023';
  end if;

  update public.question_papers
  set attempt_limit = p_attempt_limit,
      updated_by = v_user,
      updated_at = now()
  where id = p_paper_id;

  insert into public.audit_logs(
    actor_id,
    organization_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_user,
    v_organization_id,
    'paper.attempt_limit.updated',
    'question_paper',
    p_paper_id::text,
    jsonb_build_object(
      'previous_attempt_limit', v_current_limit,
      'attempt_limit', p_attempt_limit,
      'highest_attempt_already_used', v_highest_attempt
    )
  );

  return p_attempt_limit;
end
$function$;

revoke all on function public.update_question_paper_attempt_limit_v1(uuid, integer) from public;
grant execute on function public.update_question_paper_attempt_limit_v1(uuid, integer) to authenticated;
grant execute on function public.update_question_paper_attempt_limit_v1(uuid, integer) to service_role;
