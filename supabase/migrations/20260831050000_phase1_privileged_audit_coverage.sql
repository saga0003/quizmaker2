create or replace function public.audit_privileged_mutation_v20()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_row jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) else '{}'::jsonb end;
  new_row jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) else '{}'::jsonb end;
  row_data jsonb := case when tg_op = 'DELETE' then old_row else new_row end;
  entity_kind text := coalesce(nullif(tg_argv[0], ''), tg_table_name);
  entity_key text;
  org_id uuid;
  actor uuid := auth.uid();
  changed_cols text[] := array[]::text[];
  action_name text;
  student_owner uuid;
begin
  entity_key := coalesce(row_data ->> 'id', row_data ->> 'user_id', row_data ->> 'student_id', row_data ->> 'paper_id', row_data ->> 'question_id');

  if row_data ? 'organization_id' and nullif(row_data ->> 'organization_id', '') is not null then
    org_id := (row_data ->> 'organization_id')::uuid;
  elsif tg_table_name = 'question_options' and nullif(row_data ->> 'question_id', '') is not null then
    select q.organization_id into org_id from public.questions q where q.id = (row_data ->> 'question_id')::uuid;
  elsif tg_table_name in ('paper_sections','paper_questions','paper_assignment_profiles','paper_student_assignments') and nullif(row_data ->> 'paper_id', '') is not null then
    select p.organization_id into org_id from public.question_papers p where p.id = (row_data ->> 'paper_id')::uuid;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k order by k), array[]::text[])
      into changed_cols
    from (
      select key as k
      from jsonb_each(new_row)
      where old_row -> key is distinct from new_row -> key
        and key not in ('updated_at','last_seen_at')
    ) changed;

    if cardinality(changed_cols) = 0 then
      return new;
    end if;
  end if;

  if tg_table_name = 'exam_attempts' then
    student_owner := nullif(row_data ->> 'student_id', '')::uuid;
    if actor is not null and actor = student_owner then
      return case when tg_op = 'DELETE' then old else new end;
    end if;
  end if;

  action_name := entity_kind || '.' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' when 'DELETE' then 'deleted' else lower(tg_op) end;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    org_id,
    action_name,
    entity_kind,
    entity_key,
    jsonb_build_object(
      'table', tg_table_name,
      'operation', tg_op,
      'changed_columns', to_jsonb(changed_cols),
      'actor_db_role', current_user,
      'request_role', coalesce(auth.jwt() ->> 'role', '')
    )
  );

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

revoke all on function public.audit_privileged_mutation_v20() from public, anon, authenticated;

do $$
declare r record;
begin
  for r in select * from (values
    ('organizations','institution'),
    ('school_subscriptions','subscription'),
    ('profiles','account'),
    ('organization_members','account_membership'),
    ('student_school_memberships','student_membership'),
    ('module_access_settings','access_control'),
    ('credential_security_states','credential_state'),
    ('questions','question'),
    ('question_options','question_option'),
    ('question_papers','paper'),
    ('paper_sections','paper_section'),
    ('paper_questions','paper_question'),
    ('paper_assignment_profiles','paper_assignment'),
    ('paper_student_assignments','paper_assignment_student'),
    ('academic_resources','resource')
  ) as x(table_name, entity_kind)
  loop
    execute format('drop trigger if exists %I on public.%I', 'phase1_audit_' || r.table_name || '_v20', r.table_name);
    execute format(
      'create trigger %I after insert or update or delete on public.%I for each row execute function public.audit_privileged_mutation_v20(%L)',
      'phase1_audit_' || r.table_name || '_v20', r.table_name, r.entity_kind
    );
  end loop;
end
$$;

drop trigger if exists phase1_audit_exam_attempt_result_v20 on public.exam_attempts;
create trigger phase1_audit_exam_attempt_result_v20
after update of status, submitted_at, score, maximum_marks, percentage, correct_count, incorrect_count, unanswered_count on public.exam_attempts
for each row execute function public.audit_privileged_mutation_v20('result');

create or replace function public.audit_view_as_v20(p_event text, p_target_role text default null, p_organization_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  actor_role text;
begin
  if actor is null then
    raise exception 'Authentication required.' using errcode = '28000';
  end if;

  select p.role::text into actor_role from public.profiles p where p.id = actor;
  if actor_role <> 'super_admin' then
    raise exception 'Only Super Admin can use View As.' using errcode = '42501';
  end if;

  if p_event not in ('started','ended') then
    raise exception 'Invalid View As audit event.' using errcode = '22023';
  end if;

  if p_event = 'started' and coalesce(p_target_role, '') not in ('evidara_admin','school_admin','school_teacher','student') then
    raise exception 'Invalid View As target role.' using errcode = '22023';
  end if;

  insert into public.audit_logs(actor_id, organization_id, action, entity_type, entity_id, metadata)
  values (
    actor,
    p_organization_id,
    'view_as.' || p_event,
    'view_as',
    p_target_role,
    jsonb_build_object('target_role', p_target_role, 'read_only', true)
  );
end
$$;

revoke all on function public.audit_view_as_v20(text,text,uuid) from public, anon;
grant execute on function public.audit_view_as_v20(text,text,uuid) to authenticated;
