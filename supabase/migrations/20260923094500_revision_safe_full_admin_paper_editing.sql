alter table public.question_papers
  add column if not exists content_revision integer not null default 1;

alter table public.paper_sections
  add column if not exists is_active boolean not null default true,
  add column if not exists revision integer not null default 1;

alter table public.paper_questions
  add column if not exists is_active boolean not null default true,
  add column if not exists revision integer not null default 1;

alter table public.paper_questions drop constraint if exists paper_questions_paper_id_question_id_key;
drop index if exists public.paper_questions_paper_id_question_id_key;
create unique index if not exists paper_questions_active_paper_question_uidx
  on public.paper_questions(paper_id, question_id)
  where is_active;

create index if not exists paper_questions_active_paper_idx
  on public.paper_questions(paper_id, display_order, id)
  where is_active;

create index if not exists paper_sections_active_paper_idx
  on public.paper_sections(paper_id, display_order, id)
  where is_active;

update public.exam_attempts a
set metadata = coalesce(a.metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
  'paper_snapshot_version', 1,
  'paper_content_revision', p.content_revision,
  'paper_title', p.title,
  'paper_description', p.description,
  'paper_exam_type', p.exam_type,
  'duration_minutes', p.duration_minutes,
  'total_marks', a.maximum_marks,
  'total_questions', cardinality(coalesce(a.question_order, '{}'::uuid[])),
  'paper_instructions', p.instructions,
  'shuffle_options', p.shuffle_options,
  'result_mode_at_start', p.result_mode::text
))
from public.question_papers p
where p.id = a.paper_id
  and not coalesce(a.metadata ? 'paper_snapshot_version', false);

create or replace function public.save_question_paper_revisioned_v1(
  p_paper_id uuid,
  p_organization_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path to 'public','extensions','auth'
as $function$
declare
  v_user uuid := auth.uid();
  v_paper uuid;
  v_existing public.question_papers%rowtype;
  v_status public.paper_status := coalesce((p_payload->>'status')::public.paper_status, 'draft');
  v_test_type text := coalesce(nullif(p_payload->>'test_type',''), 'full_length_mock');
  v_section jsonb;
  v_item jsonb;
  v_section_id uuid;
  v_section_map jsonb := '{}'::jsonb;
  v_question public.questions%rowtype;
  v_snapshot jsonb;
  v_options jsonb;
  v_total numeric(10,2) := 0;
  v_count integer := 0;
  v_code text := nullif(upper(btrim(p_payload->>'code')), '');
  v_revision integer := 1;
  v_has_attempts boolean := false;
begin
  if v_user is null then raise exception 'Login required.'; end if;

  if p_paper_id is null then
    return public.save_question_paper(null, p_organization_id, p_payload);
  end if;

  select * into v_existing
  from public.question_papers
  where id = p_paper_id
  for update;

  if not found or not public.can_manage_v8_papers(v_existing.organization_id) then
    raise exception 'Paper not found or permission denied.' using errcode='42501';
  end if;

  if v_existing.organization_id is distinct from p_organization_id then
    raise exception 'Paper organization scope cannot be changed.' using errcode='42501';
  end if;

  select exists(select 1 from public.exam_attempts where paper_id=p_paper_id)
  into v_has_attempts;

  if not v_has_attempts then
    return public.save_question_paper(p_paper_id, p_organization_id, p_payload);
  end if;

  if not public.can_approve_v8_paper(v_existing.organization_id) then
    raise exception 'Only an administrator can fully edit a paper after student attempts exist.' using errcode='42501';
  end if;

  if v_status <> 'draft' then
    if length(btrim(coalesce(p_payload->>'title',''))) < 3 then raise exception 'Paper title is required.'; end if;
    if length(btrim(coalesce(p_payload->>'grade_level',''))) < 1 then raise exception 'Paper grade is required.'; end if;
    if v_test_type = 'custom_test' and length(btrim(coalesce(p_payload->>'custom_test_type',''))) < 2 then
      raise exception 'Custom test name is required.';
    end if;
    if jsonb_array_length(coalesce(p_payload->'sections','[]'::jsonb)) < 1 then raise exception 'Create at least one section.'; end if;
    if jsonb_array_length(coalesce(p_payload->'questions','[]'::jsonb)) < 1 then raise exception 'Add at least one question.'; end if;
  end if;

  if coalesce((p_payload->>'duration_minutes')::integer,0) < 1 then
    raise exception 'Duration must be at least one minute.';
  end if;

  if v_status in ('approved','published','rejected') and not public.can_approve_v8_paper(v_existing.organization_id) then
    raise exception 'This status requires the designated paper approver.' using errcode='42501';
  end if;

  v_paper := p_paper_id;
  v_revision := greatest(coalesce(v_existing.content_revision,1),1) + 1;

  update public.question_papers set
    title=btrim(p_payload->>'title'),
    code=v_code,
    description=nullif(p_payload->>'description',''),
    exam_type=coalesce(nullif(p_payload->>'exam_type',''),'Custom'),
    grade_level=btrim(p_payload->>'grade_level'),
    test_type=v_test_type,
    custom_test_type=nullif(btrim(p_payload->>'custom_test_type'),''),
    status=v_status,
    duration_minutes=coalesce((p_payload->>'duration_minutes')::integer,60),
    instructions=nullif(p_payload->>'instructions',''),
    access_mode=case when organization_id is null then 'public'::public.paper_access_mode else 'organization'::public.paper_access_mode end,
    access_code=null,
    available_from=case when coalesce((p_payload->>'open_forever')::boolean,false) then null else nullif(p_payload->>'available_from','')::timestamptz end,
    available_until=case when coalesce((p_payload->>'open_forever')::boolean,false) then null else nullif(p_payload->>'available_until','')::timestamptz end,
    open_forever=coalesce((p_payload->>'open_forever')::boolean,false),
    attempt_limit=coalesce((p_payload->>'attempt_limit')::integer,1),
    shuffle_questions=coalesce((p_payload->>'shuffle_questions')::boolean,false),
    shuffle_options=coalesce((p_payload->>'shuffle_options')::boolean,false),
    result_mode=coalesce((p_payload->>'result_mode')::public.paper_result_mode,'score_only'),
    settings=coalesce(settings,'{}'::jsonb) || coalesce(p_payload->'settings','{}'::jsonb)
      || jsonb_build_object('content_revision',v_revision,'last_revisioned_edit_at',now(),'last_revisioned_edit_by',v_user),
    content_revision=v_revision,
    updated_by=v_user,
    updated_at=now(),
    review_requested_at=case when v_status='under_review' then now() else review_requested_at end,
    approved_by=case when v_status in ('approved','published') then v_user when v_status in ('draft','under_review','rejected') then null else approved_by end,
    approved_at=case when v_status in ('approved','published') then coalesce(approved_at,now()) when v_status in ('draft','under_review','rejected') then null else approved_at end,
    rejected_by=case when v_status <> 'rejected' then null else rejected_by end,
    rejected_at=case when v_status <> 'rejected' then null else rejected_at end,
    rejection_reason=case when v_status <> 'rejected' then null else rejection_reason end,
    published_at=case when v_status='published' then coalesce(published_at,now()) else published_at end
  where id=v_paper;

  update public.paper_questions set is_active=false where paper_id=v_paper and is_active;
  update public.paper_sections set is_active=false where paper_id=v_paper and is_active;

  for v_section in select * from jsonb_array_elements(coalesce(p_payload->'sections','[]'::jsonb))
  loop
    if coalesce(v_section->>'selection_mode','manual') not in ('manual','automatic','hybrid') then
      raise exception 'Invalid question-selection mode.';
    end if;

    if v_status <> 'draft'
       and coalesce(v_section->>'selection_mode','manual') in ('automatic','hybrid')
       and coalesce((v_section->>'question_target')::integer,0) < 1 then
      raise exception '% requires a positive automatic question target.', coalesce(v_section->>'title','Section');
    end if;

    insert into public.paper_sections(
      paper_id,title,subject_id,subject_key,biology_division,instructions,questions_to_attempt,
      selection_mode,question_target,difficulty_distribution,chapter_ids,topic_ids,display_order,
      is_active,revision
    ) values(
      v_paper,btrim(v_section->>'title'),nullif(v_section->>'subject_id','')::uuid,
      nullif(btrim(v_section->>'subject_key'),''),coalesce(nullif(v_section->>'biology_division',''),'combined'),
      nullif(v_section->>'instructions',''),nullif(v_section->>'questions_to_attempt','')::integer,
      coalesce(nullif(v_section->>'selection_mode',''),'manual'),coalesce((v_section->>'question_target')::integer,0),
      coalesce(v_section->'difficulty_distribution','{"very_easy":0,"easy":0,"moderate":0,"difficult":0,"very_difficult":0}'::jsonb),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_section->'chapter_ids','[]'::jsonb))::uuid),'{}'::uuid[]),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_section->'topic_ids','[]'::jsonb))::uuid),'{}'::uuid[]),
      coalesce((v_section->>'display_order')::integer,0),true,v_revision
    ) returning id into v_section_id;

    v_section_map := v_section_map || jsonb_build_object(v_section->>'client_id',v_section_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(coalesce(p_payload->'questions','[]'::jsonb))
  loop
    select * into v_question from public.questions where id=(v_item->>'question_id')::uuid;
    if not found then raise exception 'A selected question no longer exists.'; end if;
    if v_question.status <> 'approved' then raise exception 'Only approved questions can be added to a paper.'; end if;

    if not (
      public.is_evidara_platform_admin()
      or (v_question.organization_id is null and public.is_evidara_school_staff(p_organization_id))
      or (v_question.organization_id is not null and public.is_evidara_school_staff(v_question.organization_id))
    ) then
      raise exception 'You do not have access to one of the selected questions.' using errcode='42501';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'option_key',o.option_key,'content_text',o.content_text,'content_latex',o.content_latex,
      'image_url',o.image_url,'is_correct',o.is_correct,'display_order',o.display_order
    ) order by o.display_order),'[]'::jsonb)
    into v_options
    from public.question_options o
    where o.question_id=v_question.id;

    v_snapshot := jsonb_build_object(
      'id',v_question.id,'stem_text',v_question.stem_text,'stem_latex',v_question.stem_latex,
      'question_image_url',v_question.question_image_url,'passage_text',v_question.passage_text,
      'question_type',v_question.question_type,'difficulty',v_question.difficulty,
      'correct_answer',v_question.correct_answer,'solution_text',v_question.solution_text,
      'solution_latex',v_question.solution_latex,'subject_id',v_question.subject_id,
      'chapter_id',v_question.chapter_id,'topic_id',v_question.topic_id,
      'exam_types',v_question.exam_types,'class_level',v_question.class_level,
      'metadata',v_question.metadata,'version_number',v_question.version_number,'options',v_options
    );

    v_section_id := nullif(v_section_map->>(v_item->>'section_client_id'),'')::uuid;
    if v_section_id is null then raise exception 'A question is assigned to a missing section.'; end if;

    insert into public.paper_questions(
      paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot,
      is_active,revision
    ) values(
      v_paper,v_section_id,v_question.id,coalesce((v_item->>'display_order')::integer,0),
      coalesce((v_item->>'marks')::numeric,v_question.marks),
      coalesce((v_item->>'negative_marks')::numeric,v_question.negative_marks),
      coalesce((v_item->>'is_mandatory')::boolean,true),v_snapshot,true,v_revision
    );

    v_total := v_total + coalesce((v_item->>'marks')::numeric,v_question.marks);
    v_count := v_count + 1;
  end loop;

  update public.question_papers
  set total_marks=v_total,total_questions=v_count,updated_at=now(),updated_by=v_user
  where id=v_paper;

  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(
    v_user,v_existing.organization_id,'paper.revision.updated','question_paper',v_paper::text,
    jsonb_build_object(
      'status',v_status,'questions',v_count,'marks',v_total,'grade',p_payload->>'grade_level',
      'test_type',v_test_type,'content_revision',v_revision,'historical_attempts_preserved',true
    )
  );

  return v_paper;
end
$function$;

revoke all on function public.save_question_paper_revisioned_v1(uuid,uuid,jsonb) from public;
grant execute on function public.save_question_paper_revisioned_v1(uuid,uuid,jsonb) to authenticated;
grant execute on function public.save_question_paper_revisioned_v1(uuid,uuid,jsonb) to service_role;

create or replace function public.snapshot_exam_attempt_paper_v1()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  p public.question_papers%rowtype;
  snapshot jsonb;
begin
  select * into p from public.question_papers where id=new.paper_id;
  if found then
    snapshot := jsonb_strip_nulls(jsonb_build_object(
      'paper_snapshot_version',1,
      'paper_content_revision',p.content_revision,
      'paper_title',p.title,
      'paper_description',p.description,
      'paper_exam_type',p.exam_type,
      'duration_minutes',p.duration_minutes,
      'total_marks',coalesce(new.maximum_marks,p.total_marks),
      'total_questions',coalesce(cardinality(new.question_order),p.total_questions),
      'paper_instructions',p.instructions,
      'shuffle_options',p.shuffle_options,
      'result_mode_at_start',p.result_mode::text
    ));
    new.metadata := snapshot || coalesce(new.metadata,'{}'::jsonb);
  end if;
  return new;
end
$function$;

drop trigger if exists snapshot_exam_attempt_paper_v1 on public.exam_attempts;
create trigger snapshot_exam_attempt_paper_v1
before insert on public.exam_attempts
for each row execute function public.snapshot_exam_attempt_paper_v1();