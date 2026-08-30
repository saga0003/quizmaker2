-- NEET PYQ review-staging importer used by the Super Admin one-click archive workflow.
-- The live project already has this migration/function applied by ChatGPT.
-- Kept in source so fresh deployments remain schema-compatible.

create or replace function public.import_neet_pyq_staging_batch_v16(p_batch jsonb, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_batch_id uuid := (p_batch->>'batch_id')::uuid;
  v_created_by uuid := (p_batch->>'created_by')::uuid;
  v_inserted integer := 0;
  v_existing integer := 0;
  v_options integer := 0;
  r jsonb; o jsonb; v_qid uuid; v_image_urls text[]; v_subject text; v_subject_slug text; v_answer jsonb; v_answer_text text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role' and current_user not in ('postgres','service_role') then
    raise exception 'Server authorization is required.' using errcode='42501';
  end if;
  if v_batch_id is null or v_created_by is null then raise exception 'batch_id and created_by are required.' using errcode='22023'; end if;
  insert into public.question_staging_batches(id,external_batch_id,source_key,source_file_name,source_archive_sha256,status,total_rows,imported_rows,failed_rows,metadata,created_by,completed_at)
  values(v_batch_id,p_batch->>'external_batch_id',p_batch->>'source_key',p_batch->>'source_file_name',p_batch->>'source_archive_sha256','importing',coalesce((p_batch->>'total_rows')::integer,jsonb_array_length(p_rows)),0,0,coalesce(p_batch->'metadata','{}'::jsonb),v_created_by,null)
  on conflict(external_batch_id) do update set source_key=excluded.source_key,source_file_name=excluded.source_file_name,source_archive_sha256=excluded.source_archive_sha256,total_rows=excluded.total_rows,metadata=excluded.metadata,status='importing',updated_at=now();
  select id into v_batch_id from public.question_staging_batches where external_batch_id=p_batch->>'external_batch_id';
  for r in select value from jsonb_array_elements(p_rows) loop
    v_qid := (r->>'id')::uuid; v_subject := coalesce(r->>'source_subject','Unknown'); v_subject_slug := coalesce(r->>'source_subject_slug',lower(regexp_replace(v_subject,'[^a-zA-Z0-9]+','-','g'))); v_answer := coalesce(r->'working_answer','[]'::jsonb); v_answer_text := coalesce(r->>'source_answer_text',case when jsonb_array_length(v_answer)>0 then v_answer->>0 else null end);
    select coalesce(array_agg(value),'{}'::text[]) into v_image_urls from jsonb_array_elements_text(coalesce(r->'source_image_urls','[]'::jsonb));
    if exists(select 1 from public.question_staging where source_key=r->>'source_key' and source_record_id=r->>'source_record_id') then v_existing:=v_existing+1;
    else
      insert into public.question_staging(id,batch_id,staging_external_id,source_key,source_record_id,source_question_number,source_subject,source_subject_slug,source_chapter,source_chapter_slug,source_topic,source_exam_label,source_year,source_question_type,mapped_question_type,source_flag,source_out_of_syllabus_flag,official_exam,official_syllabus_code,official_unit,mapping_status,mapping_confidence,subject_id,chapter_id,topic_id,source_stem_latex,working_stem_latex,source_answer_text,working_answer,answer_status,answer_evidence,source_solution_latex,working_solution_latex,difficulty_estimate,difficulty_status,estimated_seconds,source_image_urls,replacement_asset_count,raw_latex_block,source_snapshot_hash,duplicate_hash,rights_status,workflow_status,review_priority,review_note,created_by)
      values(v_qid,v_batch_id,r->>'staging_external_id',r->>'source_key',r->>'source_record_id',nullif(r->>'source_question_number','')::integer,v_subject,v_subject_slug,coalesce(r->>'source_chapter','Unmapped'),coalesce(r->>'source_chapter_slug','unmapped'),r->>'source_topic',coalesce(r->>'source_exam_label',p_batch->>'external_batch_id'),coalesce(nullif(r->>'source_year','')::integer,(p_batch->>'year')::integer),'MCQ','single_correct',r->>'source_flag',false,'NEET',null,null,'subject_mapped_chapter_pending',0.5,nullif(r->>'subject_id','')::uuid,null,null,coalesce(r->>'working_stem_latex',r->>'source_stem_latex'),coalesce(r->>'working_stem_latex',r->>'source_stem_latex'),v_answer_text,v_answer,case when jsonb_array_length(v_answer)>0 then 'source_unverified' else 'missing' end,jsonb_build_object('normalized_option',case when jsonb_array_length(v_answer)>0 then v_answer->>0 else null end,'parse_flags',case when r->>'source_flag' is null then '[]'::jsonb else to_jsonb(string_to_array(r->>'source_flag','; ')) end),r->>'working_solution_latex',r->>'working_solution_latex',null,'auto_estimated',null,v_image_urls,0,'{}',coalesce(r->>'source_snapshot_hash',encode(digest(coalesce(r->>'working_stem_latex',''),'sha256'),'hex')),coalesce(r->>'duplicate_hash',encode(digest(lower(regexp_replace(coalesce(r->>'working_stem_latex',''),'\s+','','g')),'sha256'),'hex')),'restricted_review_only','imported_unreviewed',case when r->>'source_flag' is null then 75 else 90 end,'Imported from user-provided NEET/AIPMT Answers & Solutions archive. Verify taxonomy, answer, solution and visual assets before promotion.',v_created_by);
      v_inserted:=v_inserted+1;
    end if;
    select id into v_qid from public.question_staging where source_key=r->>'source_key' and source_record_id=r->>'source_record_id';
    for o in select value from jsonb_array_elements(coalesce(r->'options','[]'::jsonb)) loop
      insert into public.question_staging_options(question_id,option_key,source_content_latex,working_content_latex,source_is_correct,verified_is_correct,display_order)
      values(v_qid,o->>'option_key',coalesce(o->>'source_content_latex',''),coalesce(o->>'source_content_latex',''),case when o ? 'source_is_correct' then (o->>'source_is_correct')::boolean else null end,null,coalesce(nullif(o->>'display_order','')::integer,0)) on conflict(question_id,option_key) do nothing;
      if found then v_options:=v_options+1; end if;
    end loop;
  end loop;
  update public.question_staging_batches b set status='completed',imported_rows=(select count(*) from public.question_staging q where q.batch_id=b.id),failed_rows=0,completed_at=now(),updated_at=now() where b.id=v_batch_id;
  return jsonb_build_object('batch_id',v_batch_id,'inserted',v_inserted,'existing',v_existing,'options_inserted',v_options,'total_in_batch',(select count(*) from public.question_staging where batch_id=v_batch_id));
end $$;
revoke all on function public.import_neet_pyq_staging_batch_v16(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.import_neet_pyq_staging_batch_v16(jsonb,jsonb) to service_role;
