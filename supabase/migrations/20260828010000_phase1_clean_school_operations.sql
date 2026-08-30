-- Evidara Phase 1 Clean school operations
-- 1) Import reviewed questions, reuse institution duplicates, and optionally create a draft paper.
-- 2) Keep institution taxonomy ownership explicit and safe for analytics.

-- Phase 1 Founding Institution plan uses 0 as the explicit unlimited-student marker.
-- Keep positive values available for future limited-seat plans.
alter table if exists public.school_subscriptions
  drop constraint if exists school_subscriptions_seat_limit_check;

alter table if exists public.school_subscriptions
  add constraint school_subscriptions_seat_limit_check check (seat_limit >= 0);

alter table if exists public.school_subscriptions
  alter column seat_limit set default 0;

alter table if exists public.school_subscriptions
  alter column plan_name set default 'Founding Institution Plan';

comment on column public.school_subscriptions.seat_limit is
  '0 means unlimited students; positive values are reserved for explicitly seat-limited plans.';

create or replace function public.bulk_import_questions_and_paper_phase1(
  p_organization_id uuid,
  p_filename text,
  p_format text,
  p_rows jsonb,
  p_paper jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  preflight jsonb;
  batch_id uuid;
  row_item record;
  v_question uuid;
  v_hash text;
  v_existing uuid;
  v_question_ids uuid[] := '{}';
  imported_count integer := 0;
  reused_count integer := 0;
  failed_count integer := 0;
  error_items jsonb := '[]'::jsonb;
  technical_message text;
  sql_state text;
  friendly_message text;
  normalized_format text;
  v_paper uuid;
  v_section uuid;
  v_section_key text;
  v_section_map jsonb := '{}'::jsonb;
  v_section_order integer := 0;
  v_display_order integer := 0;
  v_total numeric := 0;
  v_options jsonb;
  v_snapshot jsonb;
  q record;
begin
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'The reviewed import payload must be a JSON array.' using errcode = '22023';
  end if;

  preflight := public.question_import_preflight_v71(p_organization_id);
  if not coalesce((preflight ->> 'ok')::boolean, false) then
    raise exception '%', coalesce(preflight ->> 'message', 'Question import preflight failed.') using errcode = '42501';
  end if;

  normalized_format := case
    when lower(coalesce(p_format, '')) in ('csv','xlsx','xls','docx','pdf','tex','txt','json','image_zip') then lower(p_format)
    else 'json'
  end;

  insert into public.question_import_batches(
    organization_id, created_by, file_name, source_format, status, total_rows, metadata
  ) values (
    p_organization_id, auth.uid(), coalesce(nullif(btrim(p_filename),''),'reviewed-question-import'),
    normalized_format, 'importing', jsonb_array_length(p_rows),
    jsonb_build_object('release','phase1-clean','reviewed_before_import',true,'create_paper',p_paper is not null)
  ) returning id into batch_id;

  for row_item in
    select value as payload, ordinality::integer as row_number
    from jsonb_array_elements(p_rows) with ordinality
  loop
    begin
      v_hash := public.question_duplicate_hash(row_item.payload ->> 'stem_text', coalesce(row_item.payload -> 'options','[]'::jsonb));
      v_existing := null;
      if p_organization_id is null then
        select id into v_existing from public.questions
        where organization_id is null and duplicate_hash = v_hash
        order by updated_at desc limit 1;
      else
        select id into v_existing from public.questions
        where organization_id = p_organization_id and duplicate_hash = v_hash
        order by updated_at desc limit 1;
      end if;

      if v_existing is not null then
        v_question := v_existing;
        reused_count := reused_count + 1;
      else
        select public.save_question(null::uuid, p_organization_id, row_item.payload) into v_question;
        imported_count := imported_count + 1;
      end if;
      v_question_ids := array_append(v_question_ids, v_question);
    exception when others then
      get stacked diagnostics technical_message = message_text, sql_state = returned_sqlstate;
      friendly_message := case
        when sql_state = '42501' then 'Your account does not have permission to save this question.'
        when sql_state = '23503' then 'The selected subject, chapter or topic no longer exists.'
        when sql_state = '23514' then 'One or more fixed fields contain an unsupported value.'
        else regexp_replace(technical_message, '\s+', ' ', 'g')
      end;
      failed_count := failed_count + 1;
      error_items := error_items || jsonb_build_array(jsonb_build_object('row',row_item.row_number,'error',friendly_message,'code',sql_state));
    end;
  end loop;

  if p_paper is not null and coalesce(array_length(v_question_ids,1),0) > 0 then
    if p_organization_id is null then
      if not public.is_super_admin() then raise exception 'Only Super Admin can create a platform paper.' using errcode='42501'; end if;
    elsif not public.is_org_question_manager(p_organization_id) then
      raise exception 'School question-bank permission is required to create this paper.' using errcode='42501';
    end if;

    insert into public.question_papers(
      organization_id, created_by, updated_by, title, code, description, exam_type,
      status, duration_minutes, instructions, access_mode, attempt_limit,
      shuffle_questions, shuffle_options, result_mode, total_marks, total_questions,
      settings, grade_level, test_type, custom_test_type, paper_origin
    ) values (
      p_organization_id, auth.uid(), auth.uid(),
      coalesce(nullif(btrim(p_paper->>'title'),''), regexp_replace(coalesce(p_filename,'Imported paper'),'\.[^.]+$','','i')),
      nullif(btrim(p_paper->>'code'),''), nullif(btrim(p_paper->>'description'),''),
      coalesce(nullif(btrim(p_paper->>'exam_type'),''),'Custom'), 'draft',
      greatest(1,least(1440,coalesce(nullif(p_paper->>'duration_minutes','')::integer,60))),
      nullif(p_paper->>'instructions',''), 'organization', 1,
      coalesce((p_paper->>'shuffle_questions')::boolean,false),
      coalesce((p_paper->>'shuffle_options')::boolean,false),
      'score_and_answers', 0, 0,
      jsonb_build_object('source','question_import','source_file',p_filename,'set_name',nullif(p_paper->>'set_name',''),'import_batch_id',batch_id),
      coalesce(nullif(p_paper->>'grade_level',''),'Grade 11'),
      coalesce(nullif(p_paper->>'test_type',''),'full_length_mock'),
      nullif(p_paper->>'custom_test_type',''), 'file_import'
    ) returning id into v_paper;

    for q in
      select qu.*, coalesce(s.name,'General') as subject_name
      from public.questions qu
      left join public.subjects s on s.id = qu.subject_id
      where qu.id = any(v_question_ids)
      order by array_position(v_question_ids, qu.id)
    loop
      v_section_key := coalesce(q.subject_id::text,'general');
      v_section := nullif(v_section_map->>v_section_key,'')::uuid;
      if v_section is null then
        v_section_order := v_section_order + 1;
        insert into public.paper_sections(paper_id,title,subject_id,display_order)
        values(v_paper,q.subject_name,q.subject_id,v_section_order)
        returning id into v_section;
        v_section_map := v_section_map || jsonb_build_object(v_section_key,v_section::text);
      end if;

      select coalesce(jsonb_agg(jsonb_build_object(
        'option_key',o.option_key,'content_text',o.content_text,'content_latex',o.content_latex,
        'image_url',o.image_url,'is_correct',o.is_correct,'display_order',o.display_order
      ) order by o.display_order),'[]'::jsonb)
      into v_options from public.question_options o where o.question_id=q.id;

      v_snapshot := jsonb_build_object(
        'id',q.id,'stem_text',q.stem_text,'stem_latex',q.stem_latex,'question_image_url',q.question_image_url,
        'passage_text',q.passage_text,'question_type',q.question_type,'difficulty',q.difficulty,
        'correct_answer',q.correct_answer,'solution_text',q.solution_text,'solution_latex',q.solution_latex,
        'subject_id',q.subject_id,'chapter_id',q.chapter_id,'topic_id',q.topic_id,'exam_types',q.exam_types,
        'class_level',q.class_level,'metadata',q.metadata,'version_number',q.version_number,'options',v_options
      );

      v_display_order := v_display_order + 1;
      insert into public.paper_questions(paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot)
      values(v_paper,v_section,q.id,v_display_order,q.marks,q.negative_marks,true,v_snapshot)
      on conflict (paper_id,question_id) do nothing;
      v_total := v_total + q.marks;
    end loop;

    update public.question_papers
    set total_marks=v_total,total_questions=(select count(*) from public.paper_questions where paper_id=v_paper),updated_at=now()
    where id=v_paper;
  end if;

  update public.question_import_batches
  set status=case when imported_count=0 and reused_count=0 and failed_count>0 then 'failed' when failed_count>0 then 'completed_with_errors' else 'completed' end,
      imported_rows=imported_count, failed_rows=failed_count, completed_at=now(),
      metadata=metadata || jsonb_build_object('errors',error_items,'reused_questions',reused_count,'paper_id',v_paper)
  where id=batch_id;

  return jsonb_build_object(
    'batch_id',batch_id,'imported',imported_count,'reused',reused_count,'failed',failed_count,
    'errors',error_items,'paper_id',v_paper,'question_ids',to_jsonb(v_question_ids)
  );
end
$$;

revoke all on function public.bulk_import_questions_and_paper_phase1(uuid,text,text,jsonb,jsonb) from public, anon;
grant execute on function public.bulk_import_questions_and_paper_phase1(uuid,text,text,jsonb,jsonb) to authenticated, service_role;
