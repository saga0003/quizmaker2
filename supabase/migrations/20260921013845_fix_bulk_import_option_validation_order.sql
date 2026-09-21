-- Fix reviewed question imports that validated approved option-based questions
-- before save_question had finished writing their question_options rows.
--
-- The correct-answer and duplicate constraint triggers are intentionally
-- DEFERRABLE. Keep them deferred while save_question writes the parent question
-- and its options, then force validation inside the per-row exception block so
-- a genuinely invalid row is isolated without failing the whole batch.

create or replace function public.bulk_import_questions_v71(
  p_organization_id uuid,
  p_filename text,
  p_format text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth', 'storage'
as $function$
declare
  preflight jsonb;
  imported_count integer := 0;
  failed_count integer := 0;
  row_item record;
  error_items jsonb := '[]'::jsonb;
  technical_message text;
  sql_state text;
  friendly_message text;
  batch_id uuid;
  normalized_format text;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'The reviewed import payload must be a JSON array.'
      using errcode = '22023';
  end if;

  preflight := public.question_import_preflight_v71(p_organization_id);
  if not coalesce((preflight ->> 'ok')::boolean, false) then
    raise exception '%', coalesce(preflight ->> 'message', 'Question import preflight failed.')
      using errcode = '42501';
  end if;

  normalized_format := case
    when lower(coalesce(p_format, '')) in (
      'csv', 'xlsx', 'xls', 'docx', 'pdf', 'tex', 'txt', 'json', 'image_zip'
    ) then lower(p_format)
    else 'json'
  end;

  insert into public.question_import_batches (
    organization_id,
    created_by,
    file_name,
    source_format,
    status,
    total_rows,
    metadata
  ) values (
    p_organization_id,
    auth.uid(),
    coalesce(nullif(pg_catalog.btrim(p_filename), ''), 'reviewed-question-import'),
    normalized_format,
    'importing',
    jsonb_array_length(p_rows),
    jsonb_build_object(
      'release', '7.1.1',
      'reviewed_before_import', true,
      'original_format', lower(coalesce(p_format, '')),
      'option_validation_order_fix', true
    )
  ) returning id into batch_id;

  for row_item in
    select value as payload, ordinality::integer as row_number
    from jsonb_array_elements(p_rows) with ordinality
  loop
    begin
      set constraints trg_question_duplicate_finalize_v2, trg_question_correct_answer_v1 deferred;

      perform public.save_question(
        null::uuid,
        p_organization_id,
        row_item.payload
      );

      set constraints trg_question_duplicate_finalize_v2, trg_question_correct_answer_v1 immediate;

      imported_count := imported_count + 1;
    exception when others then
      get stacked diagnostics
        technical_message = message_text,
        sql_state = returned_sqlstate;

      friendly_message := case
        when technical_message ilike '%btrim(app_role)%'
          then 'The database role compatibility update is missing. Apply migration 30 and retry.'
        when sql_state = '42501'
          then 'Your account does not have permission to publish this row. Teachers must use Draft or In Review.'
        when sql_state = '23503'
          then 'The selected subject, chapter or topic no longer exists. Refresh taxonomy and review this row.'
        when sql_state = '23514'
          then 'A fixed field contains an unsupported value. Review question type, difficulty, status, marks and language.'
        when technical_message ilike '%duplicate%'
          then 'A matching question already exists in this question bank.'
        else regexp_replace(technical_message, '\s+', ' ', 'g')
      end;

      failed_count := failed_count + 1;
      error_items := error_items || jsonb_build_array(
        jsonb_build_object(
          'row', row_item.row_number,
          'error', friendly_message,
          'code', sql_state
        )
      );
    end;
  end loop;

  set constraints trg_question_duplicate_finalize_v2, trg_question_correct_answer_v1 deferred;

  update public.question_import_batches
  set
    status = case
      when imported_count = 0 and failed_count > 0 then 'failed'
      when failed_count > 0 then 'completed_with_errors'
      else 'completed'
    end,
    imported_rows = imported_count,
    failed_rows = failed_count,
    completed_at = now(),
    metadata = metadata || jsonb_build_object('errors', error_items)
  where id = batch_id;

  return jsonb_build_object(
    'batch_id', batch_id,
    'imported', imported_count,
    'failed', failed_count,
    'errors', error_items
  );
end
$function$;

revoke all on function public.bulk_import_questions_v71(uuid,text,text,jsonb) from public, anon;
grant execute on function public.bulk_import_questions_v71(uuid,text,text,jsonb) to authenticated, service_role;

comment on function public.bulk_import_questions_v71(uuid,text,text,jsonb) is
  'Imports reviewed questions and forces deferred duplicate/correct-answer checks only after question options are persisted, preserving row-isolated validation.';
