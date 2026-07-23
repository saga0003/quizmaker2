-- Evidara V8.0 Papers: automatic and hybrid generation engine
-- Run after supabase/32_v8_paper_builder_foundation.sql.
-- This migration selects approved Question Bank records into paper definitions.
-- It does not create student access, products, prices, payments or attempts.

begin;

-- Forward declaration used by save_paper_blueprints_v8. The complete
-- implementation later in this migration replaces this temporary body.
create or replace function public.refresh_paper_blueprint_availability_v8(
  p_paper_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
begin
  return jsonb_build_object(
    'paper_id',p_paper_id,
    'rules','[]'::jsonb,
    'ready',false,
    'refreshed_at',now()
  );
end
$$;

-- ---------------------------------------------------------------------------
-- Complete, unpaged eligibility query for database-side generation.
-- ---------------------------------------------------------------------------
create or replace function public.paper_eligible_questions_v8(
  p_paper_id uuid,
  p_subject_id uuid default null,
  p_chapter_id uuid default null,
  p_topic_id uuid default null,
  p_difficulty text default null,
  p_question_type text default null,
  p_language text default null,
  p_required_tags text[] default '{}',
  p_usage_rule text default 'allow',
  p_excluded_ids uuid[] default '{}'
)
returns table (
  question_id uuid,
  usage_count bigint,
  last_used_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  paper_record public.question_papers%rowtype;
  programme_tokens text[] := '{}';
begin
  select * into paper_record
  from public.question_papers
  where id=p_paper_id;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;

  select coalesce(array_agg(programme_token.value),array[]::text[])
  into programme_tokens
  from public.paper_programmes programme,
       lateral jsonb_array_elements_text(coalesce(programme.metadata->'question_tokens','[]'::jsonb)) as programme_token(value)
  where programme.code=paper_record.programme_code;

  return query
  select
    question.id,
    coalesce(usage_summary.usage_count,0),
    usage_summary.last_used_at
  from public.questions question
  left join lateral (
    select
      count(*)::bigint as usage_count,
      max(coalesce(used_paper.published_at,used_paper.updated_at)) as last_used_at
    from public.paper_questions used_question
    join public.question_papers used_paper on used_paper.id=used_question.paper_id
    where used_question.question_id=question.id
      and used_question.paper_id<>p_paper_id
      and coalesce(used_paper.workflow_status,used_paper.status::text) not in ('archived','closed')
  ) usage_summary on true
  where question.status::text='approved'
    and (
      public.current_evidara_role() in ('super_admin','evidara_admin','admin','platform_admin')
      or (
        question.organization_id is null
        and public.is_evidara_school_staff(paper_record.organization_id)
      )
      or (
        paper_record.organization_id is not null
        and question.organization_id=paper_record.organization_id
        and public.is_evidara_school_staff(paper_record.organization_id)
      )
    )
    and (p_subject_id is null or question.subject_id=p_subject_id)
    and (p_chapter_id is null or question.chapter_id=p_chapter_id)
    and (p_topic_id is null or question.topic_id=p_topic_id)
    and (p_difficulty is null or question.difficulty::text=p_difficulty)
    and (p_question_type is null or question.question_type::text=p_question_type)
    and (p_language is null or lower(question.language)=lower(p_language))
    and (
      coalesce(cardinality(p_required_tags),0)=0
      or coalesce(question.tags,array[]::text[]) @> p_required_tags
    )
    and question.id<>all(coalesce(p_excluded_ids,array[]::uuid[]))
    and (
      paper_record.programme_code is null
      or coalesce(cardinality(programme_tokens),0)=0
      or question.class_level=any(programme_tokens)
      or coalesce(question.exam_types,array[]::text[]) && programme_tokens
    )
    and (
      p_usage_rule not in ('only_unused','unused_only')
      or coalesce(usage_summary.usage_count,0)=0
    )
    and (
      paper_record.exclude_used_more_than is null
      or coalesce(usage_summary.usage_count,0)<=paper_record.exclude_used_more_than
    )
    and (
      paper_record.exclude_used_within_days is null
      or usage_summary.last_used_at is null
      or usage_summary.last_used_at < now() - make_interval(days=>paper_record.exclude_used_within_days)
    );
end
$$;

grant execute on function public.paper_eligible_questions_v8(
  uuid,uuid,uuid,uuid,text,text,text,text[],text,uuid[]
) to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Exact paper-level availability. This replaces the migration-32 preview that
-- intentionally read only one browser page.
-- ---------------------------------------------------------------------------
create or replace function public.paper_question_availability_v8(
  p_organization_id uuid default null,
  p_programme_code text default null,
  p_subject_id uuid default null,
  p_chapter_id uuid default null,
  p_topic_id uuid default null,
  p_difficulty text default null,
  p_question_type text default null,
  p_excluded_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  programme_tokens text[] := '{}';
  total_count bigint := 0;
  unused_count bigint := 0;
  used_count bigint := 0;
  by_difficulty jsonb := '{}'::jsonb;
  by_type jsonb := '{}'::jsonb;
begin
  if not (
    public.current_evidara_role() in ('super_admin','evidara_admin','admin','platform_admin')
    or public.is_evidara_school_staff(p_organization_id)
  ) then
    raise exception 'You do not have permission to inspect this Question Bank.' using errcode='42501';
  end if;

  select coalesce(array_agg(programme_token.value),array[]::text[])
  into programme_tokens
  from public.paper_programmes programme,
       lateral jsonb_array_elements_text(coalesce(programme.metadata->'question_tokens','[]'::jsonb)) as programme_token(value)
  where programme.code=p_programme_code;

  with eligible as (
    select
      question.id,
      question.difficulty::text as difficulty,
      question.question_type::text as question_type,
      exists(select 1 from public.paper_questions used where used.question_id=question.id) as previously_used
    from public.questions question
    where question.status::text='approved'
      and (
        public.current_evidara_role() in ('super_admin','evidara_admin','admin','platform_admin')
        or (question.organization_id is null and public.is_evidara_school_staff(p_organization_id))
        or (p_organization_id is not null and question.organization_id=p_organization_id and public.is_evidara_school_staff(p_organization_id))
      )
      and (p_subject_id is null or question.subject_id=p_subject_id)
      and (p_chapter_id is null or question.chapter_id=p_chapter_id)
      and (p_topic_id is null or question.topic_id=p_topic_id)
      and (p_difficulty is null or question.difficulty::text=p_difficulty)
      and (p_question_type is null or question.question_type::text=p_question_type)
      and question.id<>all(coalesce(p_excluded_ids,array[]::uuid[]))
      and (
        p_programme_code is null
        or coalesce(cardinality(programme_tokens),0)=0
        or question.class_level=any(programme_tokens)
        or coalesce(question.exam_types,array[]::text[]) && programme_tokens
      )
  )
  select
    count(*),
    count(*) filter(where not previously_used),
    count(*) filter(where previously_used),
    coalesce((select jsonb_object_agg(difficulty,count_value) from (select difficulty,count(*) count_value from eligible group by difficulty) difficulty_counts),'{}'::jsonb),
    coalesce((select jsonb_object_agg(question_type,count_value) from (select question_type,count(*) count_value from eligible group by question_type) type_counts),'{}'::jsonb)
  into total_count,unused_count,used_count,by_difficulty,by_type
  from eligible;

  return jsonb_build_object(
    'total_approved',total_count,
    'unused',unused_count,
    'previously_used',used_count,
    'by_difficulty',by_difficulty,
    'by_question_type',by_type,
    'status',case when total_count=0 then 'no_questions' else 'ready' end
  );
end
$$;

grant execute on function public.paper_question_availability_v8(
  uuid,text,uuid,uuid,uuid,text,text,uuid[]
) to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Save blueprint rows independently from draft saving. This keeps the draft
-- editor fast and allows blueprint validation before generation.
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
  section_value uuid;
  inserted_count integer := 0;
begin
  select * into paper_record
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;
  if paper_record.workflow_status in ('published','closed','archived') then
    raise exception 'Create a new paper version before changing a published, closed or archived blueprint.' using errcode='55000';
  end if;

  delete from public.paper_blueprints where paper_id=p_paper_id;

  for rule_item in
    select * from jsonb_array_elements(coalesce(p_rules,'[]'::jsonb))
  loop
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

    insert into public.paper_blueprints(
      paper_id,section_id,rule_order,subject_id,chapter_id,topic_id,difficulty,
      question_type,positive_marks,negative_marks,estimated_seconds_min,
      estimated_seconds_max,language,required_tags,excluded_question_ids,
      previous_usage_rule,requested_count,metadata
    ) values (
      p_paper_id,section_value,coalesce((rule_item->>'rule_order')::integer,inserted_count),
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
    inserted_count := inserted_count+1;
  end loop;

  update public.question_papers
  set updated_by=auth.uid(),updated_at=now(),last_saved_at=now(),draft_revision=draft_revision+1
  where id=p_paper_id;

  insert into public.paper_audit_history(paper_id,actor_id,actor_role,action,new_value)
  values(
    p_paper_id,auth.uid(),public.current_evidara_role(),'paper.blueprint_saved',
    jsonb_build_object('rule_count',inserted_count)
  );

  return public.refresh_paper_blueprint_availability_v8(p_paper_id);
end
$$;

-- Forward declaration target is defined below. PostgreSQL resolves it when this
-- migration transaction commits.

-- ---------------------------------------------------------------------------
-- Recalculate rule-by-rule requested, selected, locked, available and shortage.
-- Existing unlocked generated questions are considered replaceable; locked
-- questions are retained and counted toward the requested total.
-- ---------------------------------------------------------------------------
create or replace function public.refresh_paper_blueprint_availability_v8(
  p_paper_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  paper_record public.question_papers%rowtype;
  rule_record public.paper_blueprints%rowtype;
  retained_ids uuid[];
  selected_value integer;
  locked_value integer;
  candidate_value integer;
  previous_used_value integer;
  remaining_needed integer;
  shortage_value integer;
  surplus_value integer;
  status_value text;
  result_rows jsonb := '[]'::jsonb;
begin
  select * into paper_record
  from public.question_papers
  where id=p_paper_id;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;

  select coalesce(array_agg(question_id),array[]::uuid[])
  into retained_ids
  from public.paper_questions
  where paper_id=p_paper_id and is_locked=true;

  for rule_record in
    select * from public.paper_blueprints
    where paper_id=p_paper_id
    order by rule_order,id
  loop
    select count(*)
    into selected_value
    from public.paper_questions paper_question
    join public.questions question on question.id=paper_question.question_id
    where paper_question.paper_id=p_paper_id
      and paper_question.section_id=rule_record.section_id
      and (rule_record.subject_id is null or question.subject_id=rule_record.subject_id)
      and (rule_record.chapter_id is null or question.chapter_id=rule_record.chapter_id)
      and (rule_record.topic_id is null or question.topic_id=rule_record.topic_id)
      and (rule_record.difficulty is null or question.difficulty::text=rule_record.difficulty)
      and (rule_record.question_type is null or question.question_type::text=rule_record.question_type);

    select count(*)
    into locked_value
    from public.paper_questions paper_question
    join public.questions question on question.id=paper_question.question_id
    where paper_question.paper_id=p_paper_id
      and paper_question.section_id=rule_record.section_id
      and paper_question.is_locked=true
      and (rule_record.subject_id is null or question.subject_id=rule_record.subject_id)
      and (rule_record.chapter_id is null or question.chapter_id=rule_record.chapter_id)
      and (rule_record.topic_id is null or question.topic_id=rule_record.topic_id)
      and (rule_record.difficulty is null or question.difficulty::text=rule_record.difficulty)
      and (rule_record.question_type is null or question.question_type::text=rule_record.question_type);

    select count(*),count(*) filter(where eligible.usage_count>0)
    into candidate_value,previous_used_value
    from public.paper_eligible_questions_v8(
      p_paper_id,rule_record.subject_id,rule_record.chapter_id,rule_record.topic_id,
      rule_record.difficulty,rule_record.question_type,rule_record.language,
      rule_record.required_tags,rule_record.previous_usage_rule,
      retained_ids || coalesce(rule_record.excluded_question_ids,array[]::uuid[])
    ) eligible;

    remaining_needed := greatest(rule_record.requested_count-locked_value,0);
    shortage_value := greatest(remaining_needed-candidate_value,0);
    surplus_value := greatest(candidate_value-remaining_needed,0);
    status_value := case
      when remaining_needed=0 then 'ready'
      when candidate_value=0 then 'no_questions'
      when shortage_value>0 then 'insufficient'
      when surplus_value<greatest(2,ceil(remaining_needed*.1)::integer) then 'warning'
      else 'ready'
    end;

    update public.paper_blueprints
    set
      selected_count=selected_value,
      locked_count=locked_value,
      availability_count=candidate_value+locked_value,
      rule_status=status_value,
      metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
        'remaining_needed',remaining_needed,
        'candidate_count',candidate_value,
        'previously_used_candidates',previous_used_value,
        'shortage',shortage_value,
        'surplus',surplus_value,
        'refreshed_at',now()
      ),
      updated_at=now()
    where id=rule_record.id;

    result_rows := result_rows || jsonb_build_array(jsonb_build_object(
      'id',rule_record.id,
      'section_id',rule_record.section_id,
      'rule_order',rule_record.rule_order,
      'subject_id',rule_record.subject_id,
      'chapter_id',rule_record.chapter_id,
      'topic_id',rule_record.topic_id,
      'difficulty',rule_record.difficulty,
      'question_type',rule_record.question_type,
      'language',rule_record.language,
      'required_tags',rule_record.required_tags,
      'previous_usage_rule',rule_record.previous_usage_rule,
      'requested_count',rule_record.requested_count,
      'selected_count',selected_value,
      'locked_count',locked_value,
      'available_count',candidate_value+locked_value,
      'candidate_count',candidate_value,
      'previously_used_candidates',previous_used_value,
      'remaining_needed',remaining_needed,
      'shortage',shortage_value,
      'surplus',surplus_value,
      'status',status_value
    ));
  end loop;

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'rules',result_rows,
    'ready',not exists(
      select 1 from public.paper_blueprints
      where paper_id=p_paper_id and rule_status in ('insufficient','no_questions')
    ),
    'refreshed_at',now()
  );
end
$$;

grant execute on function public.refresh_paper_blueprint_availability_v8(uuid)
to authenticated,service_role;
grant execute on function public.save_paper_blueprints_v8(uuid,jsonb)
to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Helper that constructs the immutable paper snapshot for one Question Bank ID.
-- ---------------------------------------------------------------------------
create or replace function public.paper_question_snapshot_v8(p_question_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',question.id,
    'stem_text',question.stem_text,
    'stem_latex',question.stem_latex,
    'question_image_url',question.question_image_url,
    'passage_text',question.passage_text,
    'question_type',question.question_type,
    'difficulty',question.difficulty,
    'correct_answer',question.correct_answer,
    'solution_text',question.solution_text,
    'solution_latex',question.solution_latex,
    'subject_id',question.subject_id,
    'chapter_id',question.chapter_id,
    'topic_id',question.topic_id,
    'estimated_seconds',question.estimated_seconds,
    'version_number',question.version_number,
    'options',coalesce((
      select jsonb_agg(jsonb_build_object(
        'option_key',option_row.option_key,
        'content_text',option_row.content_text,
        'content_latex',option_row.content_latex,
        'image_url',option_row.image_url,
        'is_correct',option_row.is_correct,
        'display_order',option_row.display_order
      ) order by option_row.display_order)
      from public.question_options option_row
      where option_row.question_id=question.id
    ),'[]'::jsonb)
  )
  from public.questions question
  where question.id=p_question_id
$$;

revoke all on function public.paper_question_snapshot_v8(uuid) from public,authenticated;
grant execute on function public.paper_question_snapshot_v8(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Generate, regenerate a section, or regenerate one blueprint row.
-- Locked questions remain untouched and count toward the requested blueprint.
-- ---------------------------------------------------------------------------
create or replace function public.generate_paper_from_blueprint_v8(
  p_paper_id uuid,
  p_section_id uuid default null,
  p_rule_id uuid default null,
  p_seed text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  paper_record public.question_papers%rowtype;
  rule_record public.paper_blueprints%rowtype;
  section_record public.paper_sections%rowtype;
  seed_value text := coalesce(nullif(trim(p_seed),''),replace(gen_random_uuid()::text,'-',''));
  shortage_rows jsonb := '[]'::jsonb;
  generation_rows jsonb := '[]'::jsonb;
  selected_ids uuid[] := '{}';
  excluded_ids uuid[];
  candidate_record record;
  needed_count integer;
  locked_count_value integer;
  inserted_count integer;
  next_order integer;
  generation_source_value text;
  total_generated integer := 0;
  total_questions_value integer;
  total_marks_value numeric(10,2);
  run_id uuid;
begin
  select * into paper_record
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;
  if paper_record.workflow_status in ('published','closed','archived') then
    raise exception 'Create a new version before regenerating a published, closed or archived paper.' using errcode='55000';
  end if;
  if p_rule_id is not null and not exists(
    select 1 from public.paper_blueprints where id=p_rule_id and paper_id=p_paper_id
  ) then
    raise exception 'Blueprint row not found in this paper.' using errcode='P0002';
  end if;
  if p_section_id is not null and not exists(
    select 1 from public.paper_sections where id=p_section_id and paper_id=p_paper_id
  ) then
    raise exception 'Section not found in this paper.' using errcode='P0002';
  end if;

  perform public.refresh_paper_blueprint_availability_v8(p_paper_id);

  select coalesce(jsonb_agg(jsonb_build_object(
    'rule_id',blueprint.id,
    'section_id',blueprint.section_id,
    'requested',blueprint.requested_count,
    'available',blueprint.availability_count,
    'shortage',coalesce((blueprint.metadata->>'shortage')::integer,0)
  )),'[]'::jsonb)
  into shortage_rows
  from public.paper_blueprints blueprint
  where blueprint.paper_id=p_paper_id
    and (p_section_id is null or blueprint.section_id=p_section_id)
    and (p_rule_id is null or blueprint.id=p_rule_id)
    and coalesce((blueprint.metadata->>'shortage')::integer,0)>0;

  if jsonb_array_length(shortage_rows)>0 then
    raise exception 'Generation stopped because the blueprint has shortages: %',shortage_rows::text
      using errcode='23514';
  end if;

  -- Remove only replaceable questions in the requested scope. Locked questions
  -- are retained. Manual unlocked questions in automatic/hybrid sections are
  -- intentionally replaceable because only locked questions are compulsory.
  delete from public.paper_questions paper_question
  using public.paper_sections section
  where paper_question.paper_id=p_paper_id
    and section.id=paper_question.section_id
    and section.paper_id=p_paper_id
    and section.selection_mode in ('automatic','hybrid')
    and paper_question.is_locked=false
    and (p_section_id is null or paper_question.section_id=p_section_id)
    and (p_rule_id is null or paper_question.blueprint_rule_id=p_rule_id);

  select coalesce(max(display_order),-1)+1
  into next_order
  from public.paper_questions
  where paper_id=p_paper_id;

  for rule_record in
    select *
    from public.paper_blueprints
    where paper_id=p_paper_id
      and (p_section_id is null or section_id=p_section_id)
      and (p_rule_id is null or id=p_rule_id)
    order by rule_order,id
  loop
    select * into section_record
    from public.paper_sections
    where id=rule_record.section_id;

    if section_record.selection_mode not in ('automatic','hybrid') then
      generation_rows := generation_rows || jsonb_build_array(jsonb_build_object(
        'rule_id',rule_record.id,
        'status','skipped',
        'message','Section is configured for manual selection.'
      ));
      continue;
    end if;

    select count(*)
    into locked_count_value
    from public.paper_questions paper_question
    join public.questions question on question.id=paper_question.question_id
    where paper_question.paper_id=p_paper_id
      and paper_question.section_id=rule_record.section_id
      and paper_question.is_locked=true
      and (rule_record.subject_id is null or question.subject_id=rule_record.subject_id)
      and (rule_record.chapter_id is null or question.chapter_id=rule_record.chapter_id)
      and (rule_record.topic_id is null or question.topic_id=rule_record.topic_id)
      and (rule_record.difficulty is null or question.difficulty::text=rule_record.difficulty)
      and (rule_record.question_type is null or question.question_type::text=rule_record.question_type);

    needed_count := greatest(rule_record.requested_count-locked_count_value,0);
    inserted_count := 0;

    select coalesce(array_agg(question_id),array[]::uuid[])
    into excluded_ids
    from public.paper_questions
    where paper_id=p_paper_id;
    excluded_ids := excluded_ids || coalesce(rule_record.excluded_question_ids,array[]::uuid[]);

    for candidate_record in
      select eligible.question_id,question.marks,question.negative_marks
      from public.paper_eligible_questions_v8(
        p_paper_id,rule_record.subject_id,rule_record.chapter_id,rule_record.topic_id,
        rule_record.difficulty,rule_record.question_type,rule_record.language,
        rule_record.required_tags,rule_record.previous_usage_rule,excluded_ids
      ) eligible
      join public.questions question on question.id=eligible.question_id
      order by md5(eligible.question_id::text||seed_value||rule_record.id::text)
      limit needed_count
    loop
      generation_source_value := case when section_record.selection_mode='hybrid' then 'hybrid' else 'automatic' end;
      insert into public.paper_questions(
        paper_id,section_id,question_id,display_order,marks,negative_marks,
        original_marks,original_negative_marks,is_mandatory,is_locked,
        generation_source,blueprint_rule_id,shuffle_restricted,position_locked,
        is_bonus,is_cancelled,grace_marks,metadata,question_snapshot
      ) values (
        p_paper_id,rule_record.section_id,candidate_record.question_id,next_order,
        coalesce(rule_record.positive_marks,candidate_record.marks),
        coalesce(rule_record.negative_marks,candidate_record.negative_marks),
        candidate_record.marks,candidate_record.negative_marks,true,false,
        generation_source_value,rule_record.id,false,false,false,false,0,
        jsonb_build_object('generation_seed',seed_value,'generated_at',now()),
        public.paper_question_snapshot_v8(candidate_record.question_id)
      );
      selected_ids := array_append(selected_ids,candidate_record.question_id);
      excluded_ids := array_append(excluded_ids,candidate_record.question_id);
      next_order := next_order+1;
      inserted_count := inserted_count+1;
      total_generated := total_generated+1;
    end loop;

    if inserted_count<>needed_count then
      raise exception 'Generation changed while running. Rule % needed % questions but only % remained available.',
        rule_record.id,needed_count,inserted_count using errcode='40001';
    end if;

    generation_rows := generation_rows || jsonb_build_array(jsonb_build_object(
      'rule_id',rule_record.id,
      'section_id',rule_record.section_id,
      'requested',rule_record.requested_count,
      'locked',locked_count_value,
      'generated',inserted_count,
      'status','completed'
    ));
  end loop;

  select count(*),coalesce(sum(marks),0)
  into total_questions_value,total_marks_value
  from public.paper_questions
  where paper_id=p_paper_id;

  update public.question_papers
  set
    total_questions=total_questions_value,
    total_marks=total_marks_value,
    updated_by=auth.uid(),
    updated_at=now(),
    last_saved_at=now(),
    draft_revision=draft_revision+1
  where id=p_paper_id;

  perform public.refresh_paper_blueprint_availability_v8(p_paper_id);

  insert into public.paper_generation_runs(
    paper_id,paper_version,generated_by,random_seed,generation_mode,
    blueprint_snapshot,selected_question_ids,excluded_question_ids,
    shortages,regenerated_sections,replaced_questions
  ) values (
    p_paper_id,paper_record.version_number,auth.uid(),seed_value,
    case
      when p_rule_id is not null then 'regeneration'
      when p_section_id is not null then 'regeneration'
      when exists(select 1 from public.paper_sections where paper_id=p_paper_id and selection_mode='hybrid') then 'hybrid'
      else 'automatic'
    end,
    (select coalesce(jsonb_agg(to_jsonb(blueprint) order by blueprint.rule_order),'[]'::jsonb) from public.paper_blueprints blueprint where blueprint.paper_id=p_paper_id),
    selected_ids,array[]::uuid[],shortage_rows,
    case when p_section_id is null then array[]::uuid[] else array[p_section_id] end,
    '[]'::jsonb
  ) returning id into run_id;

  insert into public.paper_audit_history(paper_id,actor_id,actor_role,action,new_value)
  values(
    p_paper_id,auth.uid(),public.current_evidara_role(),
    case when p_rule_id is not null or p_section_id is not null then 'paper.regenerated' else 'paper.generated' end,
    jsonb_build_object('run_id',run_id,'seed',seed_value,'generated',total_generated,'rules',generation_rows)
  );

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'generation_run_id',run_id,
    'seed',seed_value,
    'generated_count',total_generated,
    'total_questions',total_questions_value,
    'total_marks',total_marks_value,
    'rules',generation_rows,
    'shortages','[]'::jsonb
  );
end
$$;

grant execute on function public.generate_paper_from_blueprint_v8(uuid,uuid,uuid,text)
to authenticated,service_role;

-- ---------------------------------------------------------------------------
-- Replace one unlocked generated question using the same blueprint row.
-- ---------------------------------------------------------------------------
create or replace function public.replace_paper_question_v8(
  p_paper_question_id uuid,
  p_seed text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public,auth
as $$
declare
  paper_question_record public.paper_questions%rowtype;
  paper_record public.question_papers%rowtype;
  rule_record public.paper_blueprints%rowtype;
  candidate_record record;
  excluded_ids uuid[];
  seed_value text := coalesce(nullif(trim(p_seed),''),replace(gen_random_uuid()::text,'-',''));
  old_question_id uuid;
begin
  select * into paper_question_record
  from public.paper_questions
  where id=p_paper_question_id
  for update;
  if not found then raise exception 'Paper question not found.' using errcode='P0002'; end if;

  select * into paper_record
  from public.question_papers
  where id=paper_question_record.paper_id;
  if not found or not public.is_paper_manager_v8(paper_record.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='P0002';
  end if;
  if paper_question_record.is_locked then
    raise exception 'Unlock this question before replacing it.' using errcode='55000';
  end if;
  if paper_record.workflow_status in ('published','closed','archived') then
    raise exception 'Create a new version before replacing a question in this paper.' using errcode='55000';
  end if;
  if paper_question_record.blueprint_rule_id is null then
    raise exception 'This question is not connected to a blueprint row. Replace it manually from the Question Bank.' using errcode='23514';
  end if;

  select * into rule_record
  from public.paper_blueprints
  where id=paper_question_record.blueprint_rule_id;

  select coalesce(array_agg(question_id),array[]::uuid[])
  into excluded_ids
  from public.paper_questions
  where paper_id=paper_question_record.paper_id;
  excluded_ids := excluded_ids || coalesce(rule_record.excluded_question_ids,array[]::uuid[]);

  select eligible.question_id,question.marks,question.negative_marks
  into candidate_record
  from public.paper_eligible_questions_v8(
    paper_question_record.paper_id,rule_record.subject_id,rule_record.chapter_id,
    rule_record.topic_id,rule_record.difficulty,rule_record.question_type,
    rule_record.language,rule_record.required_tags,rule_record.previous_usage_rule,
    excluded_ids
  ) eligible
  join public.questions question on question.id=eligible.question_id
  order by md5(eligible.question_id::text||seed_value||rule_record.id::text)
  limit 1;

  if candidate_record.question_id is null then
    raise exception 'No alternative approved question is available for this blueprint row.' using errcode='23514';
  end if;

  old_question_id := paper_question_record.question_id;
  update public.paper_questions
  set
    question_id=candidate_record.question_id,
    marks=coalesce(rule_record.positive_marks,candidate_record.marks),
    negative_marks=coalesce(rule_record.negative_marks,candidate_record.negative_marks),
    original_marks=candidate_record.marks,
    original_negative_marks=candidate_record.negative_marks,
    generation_source='replacement',
    metadata=coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
      'replacement_seed',seed_value,
      'replaced_question_id',old_question_id,
      'replaced_at',now()
    ),
    question_snapshot=public.paper_question_snapshot_v8(candidate_record.question_id)
  where id=p_paper_question_id;

  insert into public.paper_generation_runs(
    paper_id,paper_version,generated_by,random_seed,generation_mode,
    blueprint_snapshot,selected_question_ids,excluded_question_ids,
    shortages,regenerated_sections,replaced_questions
  ) values (
    paper_record.id,paper_record.version_number,auth.uid(),seed_value,'replacement',
    jsonb_build_array(to_jsonb(rule_record)),array[candidate_record.question_id],
    excluded_ids,'[]'::jsonb,array[paper_question_record.section_id],
    jsonb_build_array(jsonb_build_object(
      'paper_question_id',p_paper_question_id,
      'old_question_id',old_question_id,
      'new_question_id',candidate_record.question_id
    ))
  );

  insert into public.paper_audit_history(paper_id,actor_id,actor_role,action,previous_value,new_value)
  values(
    paper_record.id,auth.uid(),public.current_evidara_role(),'paper.question_replaced',
    jsonb_build_object('paper_question_id',p_paper_question_id,'question_id',old_question_id),
    jsonb_build_object('paper_question_id',p_paper_question_id,'question_id',candidate_record.question_id,'seed',seed_value)
  );

  perform public.refresh_paper_blueprint_availability_v8(paper_record.id);

  return jsonb_build_object(
    'paper_id',paper_record.id,
    'paper_question_id',p_paper_question_id,
    'old_question_id',old_question_id,
    'new_question_id',candidate_record.question_id,
    'seed',seed_value
  );
end
$$;

grant execute on function public.replace_paper_question_v8(uuid,text)
to authenticated,service_role;

commit;
