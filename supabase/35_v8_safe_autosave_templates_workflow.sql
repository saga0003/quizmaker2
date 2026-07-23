-- Evidara V8.0 Papers: non-destructive autosave, templates and workflow hardening
-- Run after migrations 32, 33 and 34.

begin;

-- ---------------------------------------------------------------------------
-- Non-destructive paper draft saving.
-- Browser section client IDs are UUIDs and become stable database IDs. Existing
-- sections/questions are updated in place, so blueprint rows and generation
-- history are not destroyed by autosave.
-- ---------------------------------------------------------------------------
create or replace function public.save_paper_definition_v8(
  p_paper_id uuid,
  p_organization_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public,extensions,auth
as $$
declare
  actor uuid := auth.uid();
  target_paper uuid;
  existing public.question_papers%rowtype;
  section_item jsonb;
  question_item jsonb;
  requested_section_id uuid;
  section_id uuid;
  section_client_key text;
  section_map jsonb := '{}'::jsonb;
  retained_section_ids uuid[] := '{}';
  retained_question_ids uuid[] := '{}';
  question_record public.questions%rowtype;
  question_snapshot jsonb;
  subject_value text;
  generated_code text;
  revision_value bigint;
  total_value numeric(10,2) := 0;
  question_count integer := 0;
  paper_title text := nullif(trim(coalesce(p_payload->>'title','')),'');
  programme_value text := nullif(trim(coalesce(p_payload->>'programme_code','')),'');
  paper_type_value text := coalesce(nullif(trim(p_payload->>'paper_type'),''),'custom_test');
begin
  if actor is null then
    raise exception 'Please sign in before saving a paper.' using errcode='42501';
  end if;
  if not public.is_paper_manager_v8(p_organization_id) then
    raise exception 'You do not have permission to create or edit papers in this workspace.' using errcode='42501';
  end if;

  if p_paper_id is not null then
    select * into existing
    from public.question_papers
    where id=p_paper_id
    for update;

    if not found or not public.is_paper_manager_v8(existing.organization_id) then
      raise exception 'Paper not found or permission denied.' using errcode='P0002';
    end if;
    if existing.workflow_status in ('published','closed','archived') then
      raise exception 'Published, closed and archived papers cannot be overwritten. Create a new version instead.' using errcode='55000';
    end if;
    if existing.organization_id is distinct from p_organization_id then
      raise exception 'A paper cannot be moved between Evidara and a school workspace.' using errcode='42501';
    end if;
  end if;

  if paper_title is null then paper_title := 'Untitled paper'; end if;
  generated_code := nullif(upper(trim(coalesce(p_payload->>'code',''))),'');
  if generated_code is null then
    generated_code := public.next_paper_code_v8(
      p_organization_id,coalesce(programme_value,'CUSTOM'),paper_type_value,null
    );
  end if;

  if p_paper_id is null then
    insert into public.question_papers(
      organization_id,created_by,updated_by,title,code,slug,description,detailed_description,
      exam_type,paper_type,academic_year,language,tags,internal_notes,programme_code,
      status,workflow_status,creation_mode,duration_minutes,reading_time_minutes,
      grace_time_minutes,auto_submit,instructions,total_marks,total_questions,
      shuffle_questions,shuffle_options,shuffle_mode,preserve_locked_positions,
      default_positive_marks,default_negative_marks,unanswered_marks,
      allow_partial_marking,numerical_tolerance,allow_previously_used,prefer_unused,
      only_unused,exclude_used_within_days,exclude_used_more_than,last_saved_at,
      draft_revision,builder_settings
    ) values (
      p_organization_id,actor,actor,paper_title,generated_code,
      nullif(trim(p_payload->>'slug'),''),nullif(p_payload->>'description',''),
      nullif(p_payload->>'detailed_description',''),coalesce(programme_value,'Custom'),
      paper_type_value,nullif(p_payload->>'academic_year',''),
      coalesce(nullif(p_payload->>'language',''),'English'),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb))),array[]::text[]),
      nullif(p_payload->>'internal_notes',''),programme_value,'draft','draft',
      coalesce(nullif(p_payload->>'creation_mode',''),'manual'),
      greatest(coalesce((p_payload->>'duration_minutes')::integer,60),1),
      greatest(coalesce((p_payload->>'reading_time_minutes')::integer,0),0),
      greatest(coalesce((p_payload->>'grace_time_minutes')::integer,0),0),
      coalesce((p_payload->>'auto_submit')::boolean,true),nullif(p_payload->>'instructions',''),
      0,0,coalesce((p_payload->>'shuffle_questions')::boolean,false),
      coalesce((p_payload->>'shuffle_options')::boolean,false),
      coalesce(nullif(p_payload->>'shuffle_mode',''),'fixed'),
      coalesce((p_payload->>'preserve_locked_positions')::boolean,true),
      nullif(p_payload->>'default_positive_marks','')::numeric,
      nullif(p_payload->>'default_negative_marks','')::numeric,
      coalesce(nullif(p_payload->>'unanswered_marks','')::numeric,0),
      coalesce((p_payload->>'allow_partial_marking')::boolean,false),
      nullif(p_payload->>'numerical_tolerance','')::numeric,
      coalesce((p_payload->>'allow_previously_used')::boolean,true),
      coalesce((p_payload->>'prefer_unused')::boolean,false),
      coalesce((p_payload->>'only_unused')::boolean,false),
      nullif(p_payload->>'exclude_used_within_days','')::integer,
      nullif(p_payload->>'exclude_used_more_than','')::integer,
      now(),1,coalesce(p_payload->'builder_settings','{}'::jsonb)
    ) returning id,draft_revision into target_paper,revision_value;
  else
    target_paper := p_paper_id;
    update public.question_papers set
      title=paper_title,
      code=generated_code,
      slug=nullif(trim(p_payload->>'slug'),''),
      description=nullif(p_payload->>'description',''),
      detailed_description=nullif(p_payload->>'detailed_description',''),
      exam_type=coalesce(programme_value,exam_type),
      paper_type=paper_type_value,
      academic_year=nullif(p_payload->>'academic_year',''),
      language=coalesce(nullif(p_payload->>'language',''),'English'),
      tags=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'tags','[]'::jsonb))),array[]::text[]),
      internal_notes=nullif(p_payload->>'internal_notes',''),
      programme_code=programme_value,
      workflow_status=case when workflow_status='changes_requested' then 'changes_requested' else 'draft' end,
      status='draft',
      creation_mode=coalesce(nullif(p_payload->>'creation_mode',''),'manual'),
      duration_minutes=greatest(coalesce((p_payload->>'duration_minutes')::integer,duration_minutes),1),
      reading_time_minutes=greatest(coalesce((p_payload->>'reading_time_minutes')::integer,0),0),
      grace_time_minutes=greatest(coalesce((p_payload->>'grace_time_minutes')::integer,0),0),
      auto_submit=coalesce((p_payload->>'auto_submit')::boolean,true),
      instructions=nullif(p_payload->>'instructions',''),
      shuffle_questions=coalesce((p_payload->>'shuffle_questions')::boolean,false),
      shuffle_options=coalesce((p_payload->>'shuffle_options')::boolean,false),
      shuffle_mode=coalesce(nullif(p_payload->>'shuffle_mode',''),'fixed'),
      preserve_locked_positions=coalesce((p_payload->>'preserve_locked_positions')::boolean,true),
      default_positive_marks=nullif(p_payload->>'default_positive_marks','')::numeric,
      default_negative_marks=nullif(p_payload->>'default_negative_marks','')::numeric,
      unanswered_marks=coalesce(nullif(p_payload->>'unanswered_marks','')::numeric,0),
      allow_partial_marking=coalesce((p_payload->>'allow_partial_marking')::boolean,false),
      numerical_tolerance=nullif(p_payload->>'numerical_tolerance','')::numeric,
      allow_previously_used=coalesce((p_payload->>'allow_previously_used')::boolean,true),
      prefer_unused=coalesce((p_payload->>'prefer_unused')::boolean,false),
      only_unused=coalesce((p_payload->>'only_unused')::boolean,false),
      exclude_used_within_days=nullif(p_payload->>'exclude_used_within_days','')::integer,
      exclude_used_more_than=nullif(p_payload->>'exclude_used_more_than','')::integer,
      builder_settings=coalesce(p_payload->'builder_settings','{}'::jsonb),
      updated_by=actor,
      updated_at=now(),
      last_saved_at=now(),
      draft_revision=draft_revision+1
    where id=target_paper
    returning draft_revision into revision_value;
  end if;

  delete from public.paper_subjects where paper_id=target_paper;
  for subject_value in
    select jsonb_array_elements_text(coalesce(p_payload->'subject_ids','[]'::jsonb))
  loop
    insert into public.paper_subjects(paper_id,subject_id,display_order)
    values(
      target_paper,subject_value::uuid,
      (select count(*) from public.paper_subjects where paper_id=target_paper)
    )
    on conflict (paper_id,subject_id) do nothing;
  end loop;

  for section_item in
    select * from jsonb_array_elements(coalesce(p_payload->'sections','[]'::jsonb))
  loop
    section_client_key := nullif(section_item->>'client_id','');
    requested_section_id := section_client_key::uuid;
    if requested_section_id is null then requested_section_id := gen_random_uuid(); end if;

    if exists(
      select 1 from public.paper_sections
      where id=requested_section_id and paper_id<>target_paper
    ) then
      raise exception 'A section identifier belongs to a different paper.' using errcode='42501';
    end if;

    insert into public.paper_sections(
      id,paper_id,title,code,description,subject_id,instructions,questions_to_attempt,
      minimum_questions_to_attempt,total_questions,maximum_marks,is_optional,
      selection_mode,duration_minutes,navigation_rules,settings,display_order
    ) values (
      requested_section_id,target_paper,
      coalesce(nullif(trim(section_item->>'title'),''),'Untitled section'),
      nullif(trim(section_item->>'code'),''),nullif(section_item->>'description',''),
      nullif(section_item->>'subject_id','')::uuid,nullif(section_item->>'instructions',''),
      nullif(section_item->>'questions_to_attempt','')::integer,
      nullif(section_item->>'minimum_questions_to_attempt','')::integer,
      nullif(section_item->>'total_questions','')::integer,
      nullif(section_item->>'maximum_marks','')::numeric,
      coalesce((section_item->>'is_optional')::boolean,false),
      coalesce(nullif(section_item->>'selection_mode',''),'manual'),
      nullif(section_item->>'duration_minutes','')::integer,
      coalesce(section_item->'navigation_rules','{}'::jsonb),
      coalesce(section_item->'settings','{}'::jsonb),
      coalesce((section_item->>'display_order')::integer,0)
    )
    on conflict (id) do update set
      title=excluded.title,
      code=excluded.code,
      description=excluded.description,
      subject_id=excluded.subject_id,
      instructions=excluded.instructions,
      questions_to_attempt=excluded.questions_to_attempt,
      minimum_questions_to_attempt=excluded.minimum_questions_to_attempt,
      total_questions=excluded.total_questions,
      maximum_marks=excluded.maximum_marks,
      is_optional=excluded.is_optional,
      selection_mode=excluded.selection_mode,
      duration_minutes=excluded.duration_minutes,
      navigation_rules=excluded.navigation_rules,
      settings=excluded.settings,
      display_order=excluded.display_order
    where public.paper_sections.paper_id=target_paper;

    section_id := requested_section_id;
    retained_section_ids := array_append(retained_section_ids,section_id);
    section_map := section_map || jsonb_build_object(section_client_key,section_id::text);
  end loop;

  for question_item in
    select * from jsonb_array_elements(coalesce(p_payload->'questions','[]'::jsonb))
  loop
    select * into question_record
    from public.questions
    where id=(question_item->>'question_id')::uuid;

    if not found then
      raise exception 'Question % no longer exists. Remove it before saving.',question_item->>'question_id';
    end if;
    if question_record.status::text<>'approved' then
      raise exception 'Only approved questions can be saved in a paper.' using errcode='23514';
    end if;
    if not (
      public.current_evidara_role() in ('super_admin','evidara_admin','admin','platform_admin')
      or (question_record.organization_id is null and public.is_evidara_school_staff(p_organization_id))
      or (
        p_organization_id is not null
        and question_record.organization_id=p_organization_id
        and public.is_evidara_school_staff(p_organization_id)
      )
    ) then
      raise exception 'A selected question is outside your question-bank scope.' using errcode='42501';
    end if;

    section_id := nullif(section_map->>(question_item->>'section_client_id'),'')::uuid;
    if section_id is null then
      raise exception 'A selected question is assigned to a missing section.' using errcode='23514';
    end if;

    question_snapshot := public.paper_question_snapshot_v8(question_record.id);
    retained_question_ids := array_append(retained_question_ids,question_record.id);

    insert into public.paper_questions(
      paper_id,section_id,question_id,display_order,marks,negative_marks,
      original_marks,original_negative_marks,is_mandatory,is_locked,
      generation_source,shuffle_restricted,position_locked,is_bonus,
      is_cancelled,grace_marks,metadata,question_snapshot
    ) values (
      target_paper,section_id,question_record.id,
      coalesce((question_item->>'display_order')::integer,question_count),
      coalesce(nullif(question_item->>'marks','')::numeric,question_record.marks),
      coalesce(nullif(question_item->>'negative_marks','')::numeric,question_record.negative_marks),
      question_record.marks,question_record.negative_marks,
      coalesce((question_item->>'is_mandatory')::boolean,true),
      coalesce((question_item->>'is_locked')::boolean,false),
      coalesce(nullif(question_item->>'generation_source',''),'manual'),
      coalesce((question_item->>'shuffle_restricted')::boolean,false),
      coalesce((question_item->>'position_locked')::boolean,false),
      coalesce((question_item->>'is_bonus')::boolean,false),
      coalesce((question_item->>'is_cancelled')::boolean,false),
      coalesce(nullif(question_item->>'grace_marks','')::numeric,0),
      coalesce(question_item->'metadata','{}'::jsonb),question_snapshot
    )
    on conflict (paper_id,question_id) do update set
      section_id=excluded.section_id,
      display_order=excluded.display_order,
      marks=excluded.marks,
      negative_marks=excluded.negative_marks,
      original_marks=excluded.original_marks,
      original_negative_marks=excluded.original_negative_marks,
      is_mandatory=excluded.is_mandatory,
      is_locked=excluded.is_locked,
      generation_source=case
        when public.paper_questions.section_id is distinct from excluded.section_id then 'manual'
        else excluded.generation_source
      end,
      blueprint_rule_id=case
        when public.paper_questions.section_id is distinct from excluded.section_id then null
        else public.paper_questions.blueprint_rule_id
      end,
      shuffle_restricted=excluded.shuffle_restricted,
      position_locked=excluded.position_locked,
      is_bonus=excluded.is_bonus,
      is_cancelled=excluded.is_cancelled,
      grace_marks=excluded.grace_marks,
      metadata=excluded.metadata,
      question_snapshot=excluded.question_snapshot;

    total_value := total_value + coalesce(nullif(question_item->>'marks','')::numeric,question_record.marks);
    question_count := question_count+1;
  end loop;

  delete from public.paper_questions
  where paper_id=target_paper
    and question_id<>all(retained_question_ids);

  delete from public.paper_sections
  where paper_id=target_paper
    and id<>all(retained_section_ids);

  update public.question_papers set
    total_marks=total_value,
    total_questions=question_count,
    last_saved_at=now(),
    updated_at=now(),
    updated_by=actor
  where id=target_paper;

  insert into public.paper_audit_history(
    paper_id,actor_id,actor_role,action,new_value
  ) values (
    target_paper,actor,public.current_evidara_role(),
    case when p_paper_id is null then 'paper.created' else 'paper.draft_saved' end,
    jsonb_build_object(
      'revision',revision_value,
      'questions',question_count,
      'marks',total_value,
      'sections_preserved',true,
      'blueprints_preserved',true
    )
  );

  return jsonb_build_object(
    'paper_id',target_paper,
    'code',generated_code,
    'workflow_status',case when existing.workflow_status='changes_requested' then 'changes_requested' else 'draft' end,
    'revision',revision_value,
    'saved_at',now(),
    'total_questions',question_count,
    'total_marks',total_value,
    'non_destructive',true
  );
exception
  when unique_violation then
    raise exception 'The paper code or slug is already in use. Choose another value.' using errcode='23505';
end
$$;

grant execute on function public.save_paper_definition_v8(uuid,uuid,jsonb)
to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Template lifecycle. Templates store a frozen configuration snapshot and a
-- source-paper reference. Building from a template always creates a fresh draft.
-- ---------------------------------------------------------------------------
create or replace function public.save_paper_as_template_v8(
  p_paper_id uuid,
  p_name text,
  p_description text default null,
  p_copy_scope text default 'entire'
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  paper_record public.question_papers%rowtype;
  template_id_value uuid;
  scope_value text := lower(coalesce(nullif(trim(p_copy_scope),''),'entire'));
  snapshot_value jsonb;
begin
  if scope_value not in ('entire','settings','sections','blueprint','questions') then
    raise exception 'Template scope must be entire, settings, sections, blueprint or questions.' using errcode='22023';
  end if;
  if nullif(trim(coalesce(p_name,'')),'') is null then
    raise exception 'Enter a template name.' using errcode='23514';
  end if;

  select * into paper_record
  from public.question_papers
  where id=p_paper_id;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;

  snapshot_value := public.export_paper_definition_v8(p_paper_id);

  select id into template_id_value
  from public.paper_templates
  where organization_id is not distinct from paper_record.organization_id
    and lower(name)=lower(trim(p_name))
  limit 1;

  if template_id_value is null then
    insert into public.paper_templates(
      organization_id,name,description,programme_code,paper_type,
      template_definition,is_active,created_by
    ) values (
      paper_record.organization_id,trim(p_name),nullif(trim(p_description),''),
      paper_record.programme_code,paper_record.paper_type,
      jsonb_build_object(
        'source_paper_id',p_paper_id,
        'source_version_number',paper_record.version_number,
        'copy_scope',scope_value,
        'snapshot',snapshot_value
      ),true,auth.uid()
    ) returning id into template_id_value;
  else
    update public.paper_templates set
      description=nullif(trim(p_description),''),
      programme_code=paper_record.programme_code,
      paper_type=paper_record.paper_type,
      template_definition=jsonb_build_object(
        'source_paper_id',p_paper_id,
        'source_version_number',paper_record.version_number,
        'copy_scope',scope_value,
        'snapshot',snapshot_value
      ),
      is_active=true,
      updated_at=now()
    where id=template_id_value;
  end if;

  insert into public.paper_audit_history(
    paper_id,actor_id,actor_role,action,new_value
  ) values (
    p_paper_id,auth.uid(),public.current_evidara_role(),'paper.template_saved',
    jsonb_build_object('template_id',template_id_value,'name',trim(p_name),'copy_scope',scope_value)
  );

  return jsonb_build_object(
    'template_id',template_id_value,
    'paper_id',p_paper_id,
    'name',trim(p_name),
    'copy_scope',scope_value,
    'saved',true
  );
end
$$;

grant execute on function public.save_paper_as_template_v8(uuid,text,text,text)
to authenticated,service_role;

create or replace function public.create_paper_from_template_v8(
  p_template_id uuid,
  p_new_title text
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  template_record public.paper_templates%rowtype;
  source_paper_id uuid;
  scope_value text;
  duplicate_value jsonb;
begin
  select * into template_record
  from public.paper_templates
  where id=p_template_id and is_active=true;

  if not found or not public.is_paper_manager_v8(template_record.organization_id) then
    raise exception 'Template not found or permission denied.' using errcode='P0002';
  end if;

  source_paper_id := nullif(template_record.template_definition->>'source_paper_id','')::uuid;
  scope_value := coalesce(nullif(template_record.template_definition->>'copy_scope',''),'entire');

  if source_paper_id is null or not exists(
    select 1 from public.question_papers where id=source_paper_id
  ) then
    raise exception 'The source paper for this template no longer exists. Save a new template from an active paper.' using errcode='P0002';
  end if;

  duplicate_value := public.duplicate_question_paper_v8(
    source_paper_id,scope_value,
    coalesce(nullif(trim(p_new_title),''),template_record.name)
  );

  update public.question_papers
  set based_on_template_id=p_template_id
  where id=(duplicate_value->>'paper_id')::uuid;

  return duplicate_value || jsonb_build_object(
    'template_id',p_template_id,
    'template_name',template_record.name,
    'workflow_status','draft',
    'student_access_created',false,
    'product_created',false
  );
end
$$;

grant execute on function public.create_paper_from_template_v8(uuid,text)
to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Close the legacy direct-status bypass. Academic approval and publication must
-- use the tracked review and publish functions from migration 34.
-- ---------------------------------------------------------------------------
create or replace function public.set_paper_workflow_status_v8(
  p_paper_id uuid,
  p_next_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  paper_record public.question_papers%rowtype;
  next_status text := lower(trim(p_next_status));
  legacy_status public.paper_status;
begin
  if next_status in ('approved','published') then
    raise exception 'Use the tracked review decision and publication functions for approval or publishing.' using errcode='23514';
  end if;
  if next_status not in ('draft','submitted_for_review','changes_requested','paused','closed','archived') then
    raise exception 'Unsupported paper status.' using errcode='22023';
  end if;

  select * into paper_record
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;
  if paper_record.workflow_status='published' and next_status='draft' then
    raise exception 'Create a new paper version instead of reopening a published definition.' using errcode='55000';
  end if;
  if next_status='submitted_for_review' then
    return public.submit_paper_review_v8(p_paper_id,null,p_reason);
  end if;

  legacy_status := case when next_status='archived' then 'archived'::public.paper_status else 'draft'::public.paper_status end;

  update public.question_papers set
    workflow_status=next_status,
    status=legacy_status,
    updated_by=auth.uid(),
    updated_at=now()
  where id=p_paper_id;

  insert into public.paper_audit_history(
    paper_id,actor_id,actor_role,action,previous_value,new_value,reason
  ) values (
    p_paper_id,auth.uid(),public.current_evidara_role(),'paper.status_changed',
    jsonb_build_object('workflow_status',paper_record.workflow_status),
    jsonb_build_object('workflow_status',next_status),nullif(trim(p_reason),'')
  );

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'workflow_status',next_status,
    'definition_published',false,
    'student_access_created',false,
    'product_created',false
  );
end
$$;

grant execute on function public.set_paper_workflow_status_v8(uuid,text,text)
to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Publication snapshot hardening. The snapshot itself records Published status,
-- not the pre-publication Approved state.
-- ---------------------------------------------------------------------------
create or replace function public.publish_paper_definition_v8(
  p_paper_id uuid,
  p_warning_acceptance_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  paper_record public.question_papers%rowtype;
  actor_role text := public.current_evidara_role();
  validation_value jsonb;
  export_value jsonb;
  warning_count integer;
  version_id_value uuid;
  publication_time timestamptz := now();
begin
  select * into paper_record
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;
  if actor_role not in ('super_admin','evidara_admin','admin','platform_admin','school_admin') then
    raise exception 'You do not have permission to publish paper definitions.' using errcode='42501';
  end if;
  if paper_record.workflow_status<>'approved' and actor_role not in ('super_admin','evidara_admin') then
    raise exception 'The paper must be approved before it can be published.' using errcode='23514';
  end if;

  validation_value := public.validate_paper_v8(p_paper_id);
  if not coalesce((validation_value->>'valid')::boolean,false) then
    raise exception 'Resolve all critical validation errors before publishing.' using errcode='23514';
  end if;

  warning_count := jsonb_array_length(coalesce(validation_value->'warnings','[]'::jsonb));
  if warning_count>0 and nullif(trim(coalesce(p_warning_acceptance_reason,'')),'') is null then
    raise exception 'Enter a reason for accepting the remaining validation warnings.' using errcode='23514';
  end if;

  update public.paper_validation_results
  set accepted_warning_reason=nullif(trim(p_warning_acceptance_reason),'')
  where id=(validation_value->>'validation_id')::uuid;

  update public.question_papers set
    workflow_status='published',
    status='published',
    published_at=coalesce(published_at,publication_time),
    updated_by=auth.uid(),
    updated_at=publication_time
  where id=p_paper_id;

  export_value := public.export_paper_definition_v8(p_paper_id);

  insert into public.paper_versions(
    paper_id,version_number,parent_version_id,workflow_status,change_summary,
    definition_snapshot,created_by,published_at
  ) values (
    p_paper_id,paper_record.version_number,
    (select id from public.paper_versions where paper_id=p_paper_id order by version_number desc limit 1),
    'published',paper_record.change_summary,export_value,auth.uid(),publication_time
  )
  on conflict (paper_id,version_number) do update set
    workflow_status='published',
    change_summary=excluded.change_summary,
    definition_snapshot=excluded.definition_snapshot,
    published_at=publication_time
  returning id into version_id_value;

  insert into public.paper_audit_history(
    paper_id,actor_id,actor_role,action,new_value,reason
  ) values (
    p_paper_id,auth.uid(),actor_role,'paper.published',
    jsonb_build_object(
      'paper_version_id',version_id_value,
      'version_number',paper_record.version_number,
      'warnings_accepted',warning_count,
      'definition_only',true,
      'student_access_created',false,
      'product_created',false
    ),
    nullif(trim(p_warning_acceptance_reason),'')
  );

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'paper_version_id',version_id_value,
    'version_number',paper_record.version_number,
    'workflow_status','published',
    'definition_published',true,
    'student_access_created',false,
    'product_created',false,
    'published_at',publication_time
  );
end
$$;

grant execute on function public.publish_paper_definition_v8(uuid,text)
to authenticated,service_role;

commit;
