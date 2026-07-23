-- Evidara V8.0 Papers: stable blueprints, review workflow, publication and export
-- Run after migrations 32 and 33.

begin;

-- ---------------------------------------------------------------------------
-- Preserve blueprint IDs while editing. This makes row-specific regeneration
-- reliable and keeps generated-question references attached to the same rule.
-- ---------------------------------------------------------------------------
create or replace function public.save_paper_blueprints_v8(
  p_paper_id uuid,
  p_rules jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  paper_record public.question_papers%rowtype;
  rule_item jsonb;
  rule_id_value uuid;
  section_value uuid;
  retained_ids uuid[] := '{}';
  saved_count integer := 0;
begin
  select * into paper_record
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;
  if paper_record.workflow_status in ('published','closed','archived') then
    raise exception 'Create a new paper version before changing this blueprint.' using errcode='55000';
  end if;

  select coalesce(array_agg((rule_value->>'id')::uuid),array[]::uuid[])
  into retained_ids
  from jsonb_array_elements(coalesce(p_rules,'[]'::jsonb)) rule_value
  where nullif(rule_value->>'id','') is not null;

  delete from public.paper_blueprints
  where paper_id=p_paper_id
    and id<>all(retained_ids);

  for rule_item in
    select * from jsonb_array_elements(coalesce(p_rules,'[]'::jsonb))
  loop
    rule_id_value := nullif(rule_item->>'id','')::uuid;
    section_value := nullif(rule_item->>'section_id','')::uuid;

    if section_value is null or not exists(
      select 1 from public.paper_sections section
      where section.id=section_value and section.paper_id=p_paper_id
    ) then
      raise exception 'Every blueprint row must belong to a section in this paper.' using errcode='23514';
    end if;
    if coalesce((rule_item->>'requested_count')::integer,0)<1 then
      raise exception 'Every blueprint row must request at least one question.' using errcode='23514';
    end if;

    if rule_id_value is not null and exists(
      select 1 from public.paper_blueprints
      where id=rule_id_value and paper_id=p_paper_id
    ) then
      update public.paper_blueprints set
        section_id=section_value,
        rule_order=coalesce((rule_item->>'rule_order')::integer,saved_count),
        subject_id=nullif(rule_item->>'subject_id','')::uuid,
        chapter_id=nullif(rule_item->>'chapter_id','')::uuid,
        topic_id=nullif(rule_item->>'topic_id','')::uuid,
        difficulty=nullif(rule_item->>'difficulty',''),
        question_type=nullif(rule_item->>'question_type',''),
        positive_marks=nullif(rule_item->>'positive_marks','')::numeric,
        negative_marks=nullif(rule_item->>'negative_marks','')::numeric,
        estimated_seconds_min=nullif(rule_item->>'estimated_seconds_min','')::integer,
        estimated_seconds_max=nullif(rule_item->>'estimated_seconds_max','')::integer,
        language=nullif(rule_item->>'language',''),
        required_tags=coalesce(array(select jsonb_array_elements_text(coalesce(rule_item->'required_tags','[]'::jsonb))),array[]::text[]),
        excluded_question_ids=coalesce(array(select jsonb_array_elements_text(coalesce(rule_item->'excluded_question_ids','[]'::jsonb)))::uuid[],array[]::uuid[]),
        previous_usage_rule=coalesce(nullif(rule_item->>'previous_usage_rule',''),'allow'),
        requested_count=(rule_item->>'requested_count')::integer,
        metadata=coalesce(metadata,'{}'::jsonb) || coalesce(rule_item->'metadata','{}'::jsonb),
        updated_at=now()
      where id=rule_id_value;
    else
      insert into public.paper_blueprints(
        paper_id,section_id,rule_order,subject_id,chapter_id,topic_id,difficulty,
        question_type,positive_marks,negative_marks,estimated_seconds_min,
        estimated_seconds_max,language,required_tags,excluded_question_ids,
        previous_usage_rule,requested_count,metadata
      ) values (
        p_paper_id,section_value,coalesce((rule_item->>'rule_order')::integer,saved_count),
        nullif(rule_item->>'subject_id','')::uuid,
        nullif(rule_item->>'chapter_id','')::uuid,
        nullif(rule_item->>'topic_id','')::uuid,
        nullif(rule_item->>'difficulty',''),
        nullif(rule_item->>'question_type',''),
        nullif(rule_item->>'positive_marks','')::numeric,
        nullif(rule_item->>'negative_marks','')::numeric,
        nullif(rule_item->>'estimated_seconds_min','')::integer,
        nullif(rule_item->>'estimated_seconds_max','')::integer,
        nullif(rule_item->>'language',''),
        coalesce(array(select jsonb_array_elements_text(coalesce(rule_item->'required_tags','[]'::jsonb))),array[]::text[]),
        coalesce(array(select jsonb_array_elements_text(coalesce(rule_item->'excluded_question_ids','[]'::jsonb)))::uuid[],array[]::uuid[]),
        coalesce(nullif(rule_item->>'previous_usage_rule',''),'allow'),
        (rule_item->>'requested_count')::integer,
        coalesce(rule_item->'metadata','{}'::jsonb)
      );
    end if;
    saved_count := saved_count+1;
  end loop;

  update public.question_papers
  set updated_by=auth.uid(),updated_at=now(),last_saved_at=now(),draft_revision=draft_revision+1
  where id=p_paper_id;

  insert into public.paper_audit_history(paper_id,actor_id,actor_role,action,new_value)
  values(
    p_paper_id,auth.uid(),public.current_evidara_role(),'paper.blueprint_saved',
    jsonb_build_object('rule_count',saved_count,'stable_ids',true)
  );

  return public.refresh_paper_blueprint_availability_v8(p_paper_id);
end
$$;

grant execute on function public.save_paper_blueprints_v8(uuid,jsonb)
to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- One export contract drives JSON backup, printable views and future Excel/CSV
-- adapters without copying Question Bank text into the paper definition tables.
-- ---------------------------------------------------------------------------
create or replace function public.export_paper_definition_v8(p_paper_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public,auth
as $$
declare
  paper_record public.question_papers%rowtype;
  exported jsonb;
begin
  select * into paper_record
  from public.question_papers
  where id=p_paper_id;

  if not found or not public.is_paper_reviewer_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;

  select jsonb_build_object(
    'schema_version','evidara.paper.v8',
    'exported_at',now(),
    'paper',to_jsonb(paper_record)-'access_code',
    'subjects',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',subject.id,
        'name',subject.name,
        'code',subject.code,
        'display_order',paper_subject.display_order
      ) order by paper_subject.display_order)
      from public.paper_subjects paper_subject
      join public.subjects subject on subject.id=paper_subject.subject_id
      where paper_subject.paper_id=p_paper_id
    ),'[]'::jsonb),
    'sections',coalesce((
      select jsonb_agg(
        to_jsonb(section) || jsonb_build_object(
          'questions',coalesce((
            select jsonb_agg(
              to_jsonb(paper_question)-'paper_id' || jsonb_build_object(
                'question_bank',jsonb_build_object(
                  'id',question.id,
                  'external_question_id',coalesce(question.metadata->>'external_question_id',question.metadata->>'external_id'),
                  'subject_id',question.subject_id,
                  'chapter_id',question.chapter_id,
                  'topic_id',question.topic_id,
                  'status',question.status,
                  'version_number',question.version_number
                )
              ) order by paper_question.display_order
            )
            from public.paper_questions paper_question
            join public.questions question on question.id=paper_question.question_id
            where paper_question.section_id=section.id
          ),'[]'::jsonb)
        ) order by section.display_order
      )
      from public.paper_sections section
      where section.paper_id=p_paper_id
    ),'[]'::jsonb),
    'blueprint',coalesce((
      select jsonb_agg(to_jsonb(blueprint) order by blueprint.rule_order)
      from public.paper_blueprints blueprint
      where blueprint.paper_id=p_paper_id
    ),'[]'::jsonb),
    'latest_validation',(
      select jsonb_build_object(
        'id',validation.id,
        'critical_errors',validation.critical_errors,
        'warnings',validation.warnings,
        'accepted_warning_reason',validation.accepted_warning_reason,
        'validated_at',validation.validated_at
      )
      from public.paper_validation_results validation
      where validation.paper_id=p_paper_id
      order by validation.validated_at desc
      limit 1
    ),
    'versions',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',version.id,
        'version_number',version.version_number,
        'workflow_status',version.workflow_status,
        'change_summary',version.change_summary,
        'created_at',version.created_at,
        'published_at',version.published_at
      ) order by version.version_number)
      from public.paper_versions version
      where version.paper_id=p_paper_id
    ),'[]'::jsonb)
  ) into exported;

  return exported;
end
$$;

grant execute on function public.export_paper_definition_v8(uuid)
to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Review workflow with full-paper, section and question comments.
-- ---------------------------------------------------------------------------
create or replace function public.submit_paper_review_v8(
  p_paper_id uuid,
  p_assigned_reviewer_id uuid default null,
  p_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  paper_record public.question_papers%rowtype;
  review_id_value uuid;
  validation_value jsonb;
begin
  select * into paper_record
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;
  if paper_record.workflow_status in ('published','closed','archived') then
    raise exception 'This paper cannot be submitted from its current status.' using errcode='55000';
  end if;
  if not exists(select 1 from public.paper_sections where paper_id=p_paper_id) then
    raise exception 'Create at least one section before submitting this paper for review.' using errcode='23514';
  end if;

  validation_value := public.validate_paper_v8(p_paper_id);

  insert into public.paper_reviews(
    paper_id,requested_by,assigned_reviewer_id,status,summary
  ) values (
    p_paper_id,auth.uid(),p_assigned_reviewer_id,'submitted',nullif(trim(p_summary),'')
  ) returning id into review_id_value;

  update public.question_papers
  set workflow_status='submitted_for_review',status='draft',updated_by=auth.uid(),updated_at=now()
  where id=p_paper_id;

  insert into public.paper_audit_history(paper_id,actor_id,actor_role,action,new_value)
  values(
    p_paper_id,auth.uid(),public.current_evidara_role(),'paper.submitted_for_review',
    jsonb_build_object('review_id',review_id_value,'validation',validation_value)
  );

  return jsonb_build_object(
    'review_id',review_id_value,
    'paper_id',p_paper_id,
    'workflow_status','submitted_for_review',
    'validation',validation_value
  );
end
$$;

grant execute on function public.submit_paper_review_v8(uuid,uuid,text)
to authenticated,service_role;

create or replace function public.add_paper_review_comment_v8(
  p_review_id uuid,
  p_section_id uuid default null,
  p_paper_question_id uuid default null,
  p_comment_type text default 'general',
  p_body text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  review_record public.paper_reviews%rowtype;
  paper_record public.question_papers%rowtype;
  comment_id_value uuid;
begin
  select * into review_record from public.paper_reviews where id=p_review_id;
  if not found then raise exception 'Review not found.' using errcode='P0002'; end if;
  select * into paper_record from public.question_papers where id=review_record.paper_id;
  if not public.is_paper_reviewer_v8(paper_record.organization_id) then
    raise exception 'You do not have permission to comment on this paper review.' using errcode='42501';
  end if;
  if nullif(trim(coalesce(p_body,'')),'') is null then
    raise exception 'Enter a review comment.' using errcode='23514';
  end if;
  if p_section_id is not null and not exists(
    select 1 from public.paper_sections where id=p_section_id and paper_id=paper_record.id
  ) then raise exception 'Section not found in this paper.' using errcode='23514'; end if;
  if p_paper_question_id is not null and not exists(
    select 1 from public.paper_questions where id=p_paper_question_id and paper_id=paper_record.id
  ) then raise exception 'Question not found in this paper.' using errcode='23514'; end if;

  insert into public.paper_review_comments(
    review_id,paper_id,section_id,paper_question_id,comment_type,body,created_by
  ) values (
    p_review_id,paper_record.id,p_section_id,p_paper_question_id,
    coalesce(nullif(trim(p_comment_type),''),'general'),trim(p_body),auth.uid()
  ) returning id into comment_id_value;

  update public.paper_reviews
  set status=case when status='submitted' then 'in_review' else status end
  where id=p_review_id;

  return jsonb_build_object(
    'comment_id',comment_id_value,
    'review_id',p_review_id,
    'paper_id',paper_record.id,
    'resolved',false
  );
end
$$;

grant execute on function public.add_paper_review_comment_v8(uuid,uuid,uuid,text,text)
to authenticated,service_role;

create or replace function public.resolve_paper_review_comment_v8(
  p_comment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  comment_record public.paper_review_comments%rowtype;
  paper_record public.question_papers%rowtype;
begin
  select * into comment_record from public.paper_review_comments where id=p_comment_id;
  if not found then raise exception 'Review comment not found.' using errcode='P0002'; end if;
  select * into paper_record from public.question_papers where id=comment_record.paper_id;
  if not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'You do not have permission to resolve this review comment.' using errcode='42501';
  end if;

  update public.paper_review_comments
  set is_resolved=true,resolved_by=auth.uid(),resolved_at=now()
  where id=p_comment_id;

  return jsonb_build_object('comment_id',p_comment_id,'resolved',true,'resolved_at',now());
end
$$;

grant execute on function public.resolve_paper_review_comment_v8(uuid)
to authenticated,service_role;

create or replace function public.decide_paper_review_v8(
  p_review_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  review_record public.paper_reviews%rowtype;
  paper_record public.question_papers%rowtype;
  decision_value text := lower(trim(p_decision));
  validation_value jsonb;
  workflow_value text;
begin
  if decision_value not in ('approved','changes_requested','rejected') then
    raise exception 'Decision must be approved, changes_requested or rejected.' using errcode='22023';
  end if;
  select * into review_record from public.paper_reviews where id=p_review_id for update;
  if not found then raise exception 'Review not found.' using errcode='P0002'; end if;
  select * into paper_record from public.question_papers where id=review_record.paper_id for update;
  if not public.is_paper_reviewer_v8(paper_record.organization_id) then
    raise exception 'You do not have permission to decide this paper review.' using errcode='42501';
  end if;

  if decision_value='approved' then
    validation_value := public.validate_paper_v8(paper_record.id);
    if not coalesce((validation_value->>'valid')::boolean,false) then
      raise exception 'Resolve all critical validation errors before approving this paper.' using errcode='23514';
    end if;
    if exists(
      select 1 from public.paper_review_comments
      where review_id=p_review_id and is_resolved=false
    ) then
      raise exception 'Resolve all review comments before approving this paper.' using errcode='23514';
    end if;
    workflow_value := 'approved';
  else
    workflow_value := 'changes_requested';
  end if;

  update public.paper_reviews
  set
    status=case when decision_value='approved' then 'approved' when decision_value='rejected' then 'rejected' else 'changes_requested' end,
    decision_reason=nullif(trim(p_reason),''),
    decided_at=now()
  where id=p_review_id;

  update public.question_papers
  set workflow_status=workflow_value,status='draft',updated_by=auth.uid(),updated_at=now()
  where id=paper_record.id;

  insert into public.paper_audit_history(paper_id,actor_id,actor_role,action,new_value,reason)
  values(
    paper_record.id,auth.uid(),public.current_evidara_role(),
    case when decision_value='approved' then 'paper.approved' else 'paper.changes_requested' end,
    jsonb_build_object('review_id',p_review_id,'decision',decision_value,'workflow_status',workflow_value),
    nullif(trim(p_reason),'')
  );

  return jsonb_build_object(
    'review_id',p_review_id,
    'paper_id',paper_record.id,
    'decision',decision_value,
    'workflow_status',workflow_value
  );
end
$$;

grant execute on function public.decide_paper_review_v8(uuid,text,text)
to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Publish only an approved definition. Warnings require an acceptance reason.
-- Publication creates an immutable version snapshot but no product/access.
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

  export_value := public.export_paper_definition_v8(p_paper_id);

  insert into public.paper_versions(
    paper_id,version_number,parent_version_id,workflow_status,change_summary,
    definition_snapshot,created_by,published_at
  ) values (
    p_paper_id,paper_record.version_number,
    (select id from public.paper_versions where paper_id=p_paper_id order by version_number desc limit 1),
    'published',paper_record.change_summary,export_value,auth.uid(),now()
  )
  on conflict (paper_id,version_number) do update set
    workflow_status='published',
    change_summary=excluded.change_summary,
    definition_snapshot=excluded.definition_snapshot,
    published_at=now()
  returning id into version_id_value;

  update public.question_papers
  set workflow_status='published',status='published',published_at=coalesce(published_at,now()),updated_by=auth.uid(),updated_at=now()
  where id=p_paper_id;

  insert into public.paper_audit_history(paper_id,actor_id,actor_role,action,new_value,reason)
  values(
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
    'published_at',now()
  );
end
$$;

grant execute on function public.publish_paper_definition_v8(uuid,text)
to authenticated,service_role;

commit;
