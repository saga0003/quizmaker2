-- Evidara V8 — grade-aware paper builder, section selection modes and approvals
-- Run after migration 31.

alter type public.paper_status add value if not exists 'under_review';
alter type public.paper_status add value if not exists 'approved';
alter type public.paper_status add value if not exists 'paused';
alter type public.paper_status add value if not exists 'closed';
alter type public.paper_status add value if not exists 'rejected';
alter type public.paper_result_mode add value if not exists 'in_depth_analytics';
commit;

begin;

alter table public.question_papers
  add column if not exists grade_level text,
  add column if not exists test_type text not null default 'full_length_mock',
  add column if not exists custom_test_type text,
  add column if not exists open_forever boolean not null default false,
  add column if not exists review_requested_at timestamptz,
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists rejected_by uuid references public.profiles(id) on delete set null,
  add column if not exists rejected_at timestamptz,
  add column if not exists rejection_reason text;

alter table public.paper_sections
  add column if not exists subject_key text,
  add column if not exists biology_division text not null default 'combined',
  add column if not exists selection_mode text not null default 'manual',
  add column if not exists question_target integer not null default 0,
  add column if not exists difficulty_distribution jsonb not null default '{"very_easy":0,"easy":0,"moderate":0,"difficult":0,"very_difficult":0}'::jsonb,
  add column if not exists chapter_ids uuid[] not null default '{}',
  add column if not exists topic_ids uuid[] not null default '{}';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'question_papers_v8_test_type_allowed'
      and conrelid = 'public.question_papers'::regclass
  ) then
    alter table public.question_papers
      add constraint question_papers_v8_test_type_allowed
      check (test_type in (
        'full_length_mock','subject_test','chapter_test','topic_test','unit_test',
        'diagnostic_test','scholarship_test','previous_year_paper','practice_test',
        'foundation_test','school_test','custom_test'
      ));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'question_papers_v8_custom_test_name'
      and conrelid = 'public.question_papers'::regclass
  ) then
    alter table public.question_papers
      add constraint question_papers_v8_custom_test_name
      check (status = 'draft' or test_type <> 'custom_test' or length(btrim(coalesce(custom_test_type,''))) >= 2);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'paper_sections_v8_selection_mode_allowed'
      and conrelid = 'public.paper_sections'::regclass
  ) then
    alter table public.paper_sections
      add constraint paper_sections_v8_selection_mode_allowed
      check (selection_mode in ('manual','automatic','hybrid'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'paper_sections_v8_biology_division_allowed'
      and conrelid = 'public.paper_sections'::regclass
  ) then
    alter table public.paper_sections
      add constraint paper_sections_v8_biology_division_allowed
      check (biology_division in ('combined','botany','zoology'));
  end if;
end
$$;

create index if not exists question_papers_grade_exam_idx
  on public.question_papers(exam_type, grade_level, test_type, status);

create or replace function public.can_manage_v8_papers(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when p_organization_id is null then public.is_evidara_platform_admin()
    else public.is_evidara_school_staff(p_organization_id)
  end
$$;

grant execute on function public.can_manage_v8_papers(uuid) to authenticated, service_role;

create or replace function public.can_approve_v8_paper(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when p_organization_id is null then public.is_evidara_super_admin()
    else public.is_evidara_school_manager(p_organization_id)
  end
$$;

grant execute on function public.can_approve_v8_paper(uuid) to authenticated, service_role;

create or replace function public.save_question_paper(
  p_paper_id uuid,
  p_organization_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions, auth
as $$
declare
  v_user uuid := auth.uid();
  v_role text := coalesce(public.current_evidara_role(), 'student');
  v_paper uuid;
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
begin
  if v_user is null then raise exception 'Login required.'; end if;
  if not public.can_manage_v8_papers(p_organization_id) then
    raise exception 'Paper-builder permission required.' using errcode = '42501';
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
  if coalesce((p_payload->>'duration_minutes')::integer,0) < 1 then raise exception 'Duration must be at least one minute.'; end if;

  if v_status in ('approved','published','rejected') and not public.can_approve_v8_paper(p_organization_id) then
    if p_organization_id is null then
      raise exception 'Evidara papers must be approved by Super Admin.' using errcode = '42501';
    else
      raise exception 'School papers created by teachers must be approved by School Admin.' using errcode = '42501';
    end if;
  end if;

  if p_paper_id is null then
    insert into public.question_papers(
      organization_id,created_by,updated_by,title,code,description,exam_type,grade_level,
      test_type,custom_test_type,status,duration_minutes,instructions,access_mode,access_code,
      available_from,available_until,open_forever,attempt_limit,shuffle_questions,shuffle_options,
      result_mode,settings,review_requested_at,approved_by,approved_at,published_at
    ) values (
      p_organization_id,v_user,v_user,btrim(p_payload->>'title'),v_code,nullif(p_payload->>'description',''),
      coalesce(nullif(p_payload->>'exam_type',''),'Custom'),btrim(p_payload->>'grade_level'),
      v_test_type,nullif(btrim(p_payload->>'custom_test_type'),''),v_status,
      coalesce((p_payload->>'duration_minutes')::integer,60),nullif(p_payload->>'instructions',''),
      case when p_organization_id is null then 'public'::public.paper_access_mode else 'organization'::public.paper_access_mode end,
      null,nullif(p_payload->>'available_from','')::timestamptz,nullif(p_payload->>'available_until','')::timestamptz,
      coalesce((p_payload->>'open_forever')::boolean,false),coalesce((p_payload->>'attempt_limit')::integer,1),
      coalesce((p_payload->>'shuffle_questions')::boolean,false),coalesce((p_payload->>'shuffle_options')::boolean,false),
      coalesce((p_payload->>'result_mode')::public.paper_result_mode,'score_only'),coalesce(p_payload->'settings','{}'::jsonb),
      case when v_status='under_review' then now() else null end,
      case when v_status in ('approved','published') then v_user else null end,
      case when v_status in ('approved','published') then now() else null end,
      case when v_status='published' then now() else null end
    ) returning id into v_paper;
  else
    select id into v_paper
    from public.question_papers
    where id=p_paper_id and public.can_manage_v8_papers(organization_id)
    for update;

    if v_paper is null then raise exception 'Paper not found or permission denied.'; end if;
    if exists(select 1 from public.exam_attempts where paper_id=v_paper) then
      raise exception 'This paper already has student attempts. Create a new paper instead of changing its questions.';
    end if;

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
      settings=coalesce(p_payload->'settings','{}'::jsonb),
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

    delete from public.paper_sections where paper_id=v_paper;
  end if;

  for v_section in select * from jsonb_array_elements(p_payload->'sections')
  loop
    if coalesce(v_section->>'selection_mode','manual') not in ('manual','automatic','hybrid') then
      raise exception 'Invalid question-selection mode.';
    end if;

    if v_status <> 'draft' and
       coalesce(v_section->>'selection_mode','manual') in ('automatic','hybrid') and
       coalesce((v_section->>'question_target')::integer,0) < 1 then
      raise exception '% requires a positive automatic question target.', coalesce(v_section->>'title','Section');
    end if;

    insert into public.paper_sections(
      paper_id,title,subject_id,subject_key,biology_division,instructions,questions_to_attempt,
      selection_mode,question_target,difficulty_distribution,chapter_ids,topic_ids,display_order
    ) values(
      v_paper,btrim(v_section->>'title'),nullif(v_section->>'subject_id','')::uuid,
      nullif(btrim(v_section->>'subject_key'),''),coalesce(nullif(v_section->>'biology_division',''),'combined'),
      nullif(v_section->>'instructions',''),nullif(v_section->>'questions_to_attempt','')::integer,
      coalesce(nullif(v_section->>'selection_mode',''),'manual'),coalesce((v_section->>'question_target')::integer,0),
      coalesce(v_section->'difficulty_distribution','{"very_easy":0,"easy":0,"moderate":0,"difficult":0,"very_difficult":0}'::jsonb),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_section->'chapter_ids','[]'::jsonb))::uuid),'{}'::uuid[]),
      coalesce(array(select jsonb_array_elements_text(coalesce(v_section->'topic_ids','[]'::jsonb))::uuid),'{}'::uuid[]),
      coalesce((v_section->>'display_order')::integer,0)
    ) returning id into v_section_id;
    v_section_map := v_section_map || jsonb_build_object(v_section->>'client_id',v_section_id::text);
  end loop;

  for v_item in select * from jsonb_array_elements(p_payload->'questions')
  loop
    select * into v_question from public.questions where id=(v_item->>'question_id')::uuid;
    if not found then raise exception 'A selected question no longer exists.'; end if;
    if v_question.status <> 'approved' then raise exception 'Only approved questions can be added to a paper.'; end if;
    if not (
      public.is_evidara_platform_admin()
      or (v_question.organization_id is null and public.is_evidara_school_staff(p_organization_id))
      or (v_question.organization_id is not null and public.is_evidara_school_staff(v_question.organization_id))
    ) then
      raise exception 'You do not have access to one of the selected questions.' using errcode = '42501';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'option_key',o.option_key,'content_text',o.content_text,'content_latex',o.content_latex,
      'image_url',o.image_url,'is_correct',o.is_correct,'display_order',o.display_order
    ) order by o.display_order),'[]'::jsonb)
    into v_options from public.question_options o where o.question_id=v_question.id;

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

    insert into public.paper_questions(paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot)
    values(
      v_paper,v_section_id,v_question.id,coalesce((v_item->>'display_order')::integer,0),
      coalesce((v_item->>'marks')::numeric,v_question.marks),coalesce((v_item->>'negative_marks')::numeric,v_question.negative_marks),
      coalesce((v_item->>'is_mandatory')::boolean,true),v_snapshot
    );
    v_total := v_total + coalesce((v_item->>'marks')::numeric,v_question.marks);
    v_count := v_count + 1;
  end loop;

  update public.question_papers
  set total_marks=v_total,total_questions=v_count,updated_at=now(),updated_by=v_user
  where id=v_paper;

  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(
    v_user,p_organization_id,
    case when p_paper_id is null then 'paper.v8.created' else 'paper.v8.updated' end,
    'question_paper',v_paper::text,
    jsonb_build_object('status',v_status,'questions',v_count,'marks',v_total,'grade',p_payload->>'grade_level','test_type',v_test_type,'actor_role',v_role)
  );

  return v_paper;
end
$$;

grant execute on function public.save_question_paper(uuid,uuid,jsonb) to authenticated, service_role;

create or replace function public.set_question_paper_status_v8(
  p_paper_id uuid,
  p_status public.paper_status,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org uuid;
  v_count integer;
  v_current public.paper_status;
  v_user uuid := auth.uid();
begin
  select organization_id,total_questions,status
  into v_org,v_count,v_current
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.can_manage_v8_papers(v_org) then
    raise exception 'Paper not found or permission denied.' using errcode = '42501';
  end if;

  if p_status in ('approved','published','rejected') and not public.can_approve_v8_paper(v_org) then
    raise exception 'This status requires the designated paper approver.' using errcode = '42501';
  end if;
  if p_status='published' and v_count<1 then raise exception 'Add questions before publishing.'; end if;
  if p_status='rejected' and length(btrim(coalesce(p_reason,'')))<2 then raise exception 'A rejection reason is required.'; end if;

  update public.question_papers set
    status=p_status,
    updated_by=v_user,
    updated_at=now(),
    review_requested_at=case when p_status='under_review' then now() else review_requested_at end,
    approved_by=case when p_status in ('approved','published') then v_user when p_status in ('draft','under_review','rejected') then null else approved_by end,
    approved_at=case when p_status in ('approved','published') then coalesce(approved_at,now()) when p_status in ('draft','under_review','rejected') then null else approved_at end,
    rejected_by=case when p_status='rejected' then v_user when p_status<>'rejected' then null else rejected_by end,
    rejected_at=case when p_status='rejected' then now() when p_status<>'rejected' then null else rejected_at end,
    rejection_reason=case when p_status='rejected' then btrim(p_reason) when p_status<>'rejected' then null else rejection_reason end,
    published_at=case when p_status='published' then coalesce(published_at,now()) else published_at end
  where id=p_paper_id;

  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(v_user,v_org,'paper.v8.status_changed','question_paper',p_paper_id::text,jsonb_build_object('from',v_current,'to',p_status,'reason',p_reason));
end
$$;

grant execute on function public.set_question_paper_status_v8(uuid,public.paper_status,text) to authenticated, service_role;

create or replace function public.delete_question_paper_v8(p_paper_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_org uuid;
  v_title text;
begin
  select organization_id,title into v_org,v_title
  from public.question_papers
  where id=p_paper_id
  for update;

  if not found or not public.can_manage_v8_papers(v_org) then
    raise exception 'Paper not found or permission denied.' using errcode = '42501';
  end if;
  if exists(select 1 from public.exam_attempts where paper_id=p_paper_id) then
    raise exception 'Papers with student attempts cannot be deleted. Archive or close this paper instead.';
  end if;

  delete from public.question_papers where id=p_paper_id;
  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),v_org,'paper.v8.deleted','question_paper',p_paper_id::text,jsonb_build_object('title',v_title));
end
$$;

grant execute on function public.delete_question_paper_v8(uuid) to authenticated, service_role;

create or replace function public.list_available_papers()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'title',p.title,'description',p.description,'exam_type',p.exam_type,
    'grade_level',p.grade_level,'test_type',p.test_type,'custom_test_type',p.custom_test_type,
    'duration_minutes',p.duration_minutes,'total_marks',p.total_marks,'total_questions',p.total_questions,
    'available_from',p.available_from,'available_until',p.available_until,'open_forever',p.open_forever,
    'attempt_limit',p.attempt_limit,
    'attempts_used',(select count(*) from public.exam_attempts a where a.paper_id=p.id and a.student_id=auth.uid()),
    'result_mode',p.result_mode,'access_mode',p.access_mode
  ) order by p.available_from nulls first,p.created_at desc),'[]'::jsonb)
  from public.question_papers p
  where auth.uid() is not null
    and p.status='published'
    and (p.open_forever or p.available_from is null or p.available_from<=now())
    and (p.open_forever or p.available_until is null or p.available_until>=now())
    and (
      p.organization_id is null
      or public.is_org_member(p.organization_id)
    )
$$;

grant execute on function public.list_available_papers() to authenticated;

commit;
