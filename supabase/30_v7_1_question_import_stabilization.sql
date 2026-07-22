begin;

-- ============================================================
-- Evidara V7.1 question import compatibility
-- ============================================================
-- Older question-bank functions call btrim() directly on app_role enum values.
-- PostgreSQL does not implicitly cast enums for function resolution, so those
-- calls fail with: function btrim(app_role) does not exist.
create or replace function public.btrim(value public.app_role)
returns text
language sql
immutable
strict
parallel safe
set search_path = pg_catalog, public
as $$
  select pg_catalog.btrim(value::text)
$$;

comment on function public.btrim(public.app_role) is
  'V7.1 compatibility overload for legacy role helpers that trim app_role values.';

-- ============================================================
-- Cross-role question visibility
-- ============================================================
-- Platform administrators may review every question. School staff may read
-- approved Evidara master questions and every question belonging to their own
-- organization. Students remain outside the Questions workspace.
drop policy if exists questions_v71_role_visibility on public.questions;
create policy questions_v71_role_visibility
on public.questions
for select
to authenticated
using (
  public.is_evidara_platform_admin()
  or (
    organization_id is null
    and status = 'approved'
    and public.current_evidara_role() in (
      'school_admin',
      'school_teacher',
      'institute_owner',
      'institute_admin',
      'school_owner',
      'teacher',
      'reviewer',
      'invigilator'
    )
  )
  or (
    organization_id is not null
    and public.is_evidara_school_staff(organization_id)
  )
);

-- Ensure answer options follow the visibility of their parent question.
do $$
begin
  if to_regclass('public.question_options') is not null then
    execute 'alter table public.question_options enable row level security';
    execute 'drop policy if exists question_options_v71_parent_visibility on public.question_options';
    execute $policy$
      create policy question_options_v71_parent_visibility
      on public.question_options
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.questions question
          where question.id = question_options.question_id
        )
      )
    $policy$;
  end if;
end
$$;

-- ============================================================
-- Supabase Storage for question images
-- ============================================================
-- V7.1 uses Supabase Storage directly. Cloudflare R2 is optional and is not
-- required to import an Excel file plus its matching image ZIP.
insert into storage.buckets (id, name, public)
values ('question-assets', 'question-assets', true)
on conflict (id) do update
set public = true;

drop policy if exists question_assets_public_read on storage.objects;
create policy question_assets_public_read
on storage.objects
for select
to public
using (bucket_id = 'question-assets');

drop policy if exists question_assets_authenticated_insert on storage.objects;
create policy question_assets_authenticated_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'question-assets'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_evidara_platform_admin()
  )
);

drop policy if exists question_assets_authenticated_update on storage.objects;
create policy question_assets_authenticated_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'question-assets'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_evidara_platform_admin()
  )
)
with check (
  bucket_id = 'question-assets'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_evidara_platform_admin()
  )
);

drop policy if exists question_assets_authenticated_delete on storage.objects;
create policy question_assets_authenticated_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'question-assets'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_evidara_platform_admin()
  )
);

-- ============================================================
-- Preflight: fail before users click Import
-- ============================================================
create or replace function public.question_import_preflight_v71(
  p_organization_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth, storage
as $$
declare
  role_name text := coalesce(public.current_evidara_role(), 'student');
  allowed boolean := false;
  storage_ready boolean := false;
  reason text := '';
begin
  storage_ready := exists (
    select 1 from storage.buckets where id = 'question-assets'
  );

  if role_name in ('super_admin', 'evidara_admin', 'admin', 'platform_admin') then
    allowed := true;
  elsif role_name in (
    'school_admin', 'school_teacher', 'institute_owner', 'institute_admin',
    'school_owner', 'teacher', 'reviewer', 'invigilator'
  ) then
    allowed := p_organization_id is not null
      and public.is_evidara_school_staff(p_organization_id);
    if not allowed then
      reason := 'This account is not linked to the selected school organization.';
    end if;
  else
    reason := 'Students cannot import questions.';
  end if;

  if allowed and not storage_ready then
    reason := 'The question-assets storage bucket is not ready. Apply migration 30.';
  end if;

  return jsonb_build_object(
    'ok', allowed and storage_ready,
    'role', role_name,
    'can_import', allowed,
    'storage_ready', storage_ready,
    'organization_id', p_organization_id,
    'message', case
      when allowed and storage_ready then 'Database, role and image storage checks passed.'
      when reason <> '' then reason
      else 'Question import is not ready.'
    end
  );
end
$$;

revoke all on function public.question_import_preflight_v71(uuid)
from public, anon;
grant execute on function public.question_import_preflight_v71(uuid)
to authenticated, service_role;

-- ============================================================
-- V7.1 import wrapper with understandable row-level errors
-- ============================================================
create or replace function public.bulk_import_questions_v71(
  p_organization_id uuid,
  p_filename text,
  p_format text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, storage
as $$
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
      'release', '7.1.0',
      'reviewed_before_import', true,
      'original_format', lower(coalesce(p_format, ''))
    )
  ) returning id into batch_id;

  for row_item in
    select value as payload, ordinality::integer as row_number
    from jsonb_array_elements(p_rows) with ordinality
  loop
    begin
      perform public.save_question(
        null::uuid,
        p_organization_id,
        row_item.payload
      );
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
$$;

revoke all on function public.bulk_import_questions_v71(uuid, text, text, jsonb)
from public, anon;
grant execute on function public.bulk_import_questions_v71(uuid, text, text, jsonb)
to authenticated, service_role;

commit;
