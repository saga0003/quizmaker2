create or replace function public.list_pyq_source_paper_readiness_service_v18()
returns jsonb
language sql stable security definer
set search_path=public,auth
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'exam_type',s.exam_type,'source_year',s.source_year,'variant',s.variant,'paper_code',s.paper_code,
    'paper_key',s.paper_key,'display_name',s.display_name,'source_key',s.source_key,
    'expected_question_count',s.expected_question_count,'duration_minutes',s.duration_minutes,'maximum_marks',s.maximum_marks,
    'staged_count',(select count(*) from public.question_staging qs where qs.source_key=s.source_key),
    'promoted_count',(select count(*) from public.question_pyq_occurrences o where o.source_paper_id=s.id),
    'approved_count',(select count(*) from public.question_pyq_occurrences o join public.questions q on q.id=o.question_id where o.source_paper_id=s.id and q.status='approved'),
    'review_count',(select count(*) from public.question_pyq_occurrences o join public.questions q on q.id=o.question_id where o.source_paper_id=s.id and q.status='in_review'),
    'taxonomy_review_count',(select count(*) from public.question_pyq_occurrences o join public.questions q on q.id=o.question_id where o.source_paper_id=s.id and q.chapter_id is null),
    'built_paper',(select jsonb_build_object('id',p.id,'title',p.title,'status',p.status,'total_questions',p.total_questions,'updated_at',p.updated_at)
      from public.question_papers p where p.pyq_source_paper_id=s.id and p.organization_id is null order by p.created_at desc limit 1),
    'ready_to_build', s.expected_question_count > 0 and
      (select count(*) from public.question_pyq_occurrences o where o.source_paper_id=s.id) >= s.expected_question_count and
      (select count(*) from public.question_pyq_occurrences o join public.questions q on q.id=o.question_id where o.source_paper_id=s.id and q.status='approved') >= s.expected_question_count
  ) order by s.source_year desc,s.variant,s.paper_code),'[]'::jsonb)
  from public.pyq_source_papers s where s.status='active';
$$;
revoke all on function public.list_pyq_source_paper_readiness_service_v18() from public,anon,authenticated;
grant execute on function public.list_pyq_source_paper_readiness_service_v18() to service_role;

create or replace function public.build_pyq_paper_service_v18(p_source_paper_id uuid,p_actor uuid)
returns uuid
language plpgsql security definer set search_path=public,auth as $$
declare
  src public.pyq_source_papers%rowtype;
  v_paper uuid;
  v_linked integer;
  v_ready integer;
  v_existing uuid;
  v_sec uuid;
  rec record;
  v_subject text;
  v_section text;
  v_start integer;
  v_end integer;
  v_attempt integer;
  v_optional boolean;
  v_total numeric := 720;
  v_snapshot jsonb;
  v_options jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' and current_user not in ('postgres','service_role') then
    raise exception 'Server authorization is required.' using errcode='42501';
  end if;
  select * into src from public.pyq_source_papers where id=p_source_paper_id and status='active';
  if not found then raise exception 'PYQ source paper not found.'; end if;

  select count(*) into v_linked from public.question_pyq_occurrences where source_paper_id=src.id;
  select count(*) into v_ready from public.question_pyq_occurrences o join public.questions q on q.id=o.question_id
    where o.source_paper_id=src.id and q.status='approved';
  if v_linked < src.expected_question_count or v_ready < src.expected_question_count then
    raise exception 'This PYQ paper is not ready. % of % source question positions are linked and % are approved in the Question Bank.',v_linked,src.expected_question_count,v_ready;
  end if;

  select id into v_existing from public.question_papers where pyq_source_paper_id=src.id and organization_id is null order by created_at desc limit 1;
  if v_existing is not null and exists(select 1 from public.exam_attempts where paper_id=v_existing) then v_existing:=null; end if;

  if v_existing is null then
    insert into public.question_papers(organization_id,created_by,updated_by,title,code,description,exam_type,status,duration_minutes,instructions,
      access_mode,attempt_limit,shuffle_questions,shuffle_options,result_mode,total_marks,total_questions,settings,source_year,is_previous_year_paper,
      grade_level,test_type,open_forever,paper_origin,pyq_source_paper_id,source_variant,source_paper_code,seo_slug,seo_title,seo_description)
    values(null,p_actor,p_actor,src.display_name,upper(public.v18_slugify(concat_ws('-',src.exam_type,src.source_year,src.variant,src.paper_code))),
      concat(src.display_name,' previous-year question paper recreated from the Evidara verified PYQ question bank.'),src.exam_type,'draft',src.duration_minutes,
      'Attempt the paper according to the original examination pattern.', 'public',1,false,false,'in_depth_analytics',src.maximum_marks,src.expected_question_count,
      jsonb_build_object('pyq_source_paper_id',src.id,'paper_key',src.paper_key,'variant',src.variant,'source_code',src.paper_code,'attemptable_questions',180,'builder','v18_pyq_exact'),
      src.source_year,true,'Grade 11-12','previous_year_paper',true,'pyq_generated',src.id,src.variant,src.paper_code,
      public.v18_slugify(concat(src.display_name,' ',coalesce(src.paper_code,''),' question paper')),
      concat(src.display_name,' Question Paper with Answers and Solutions | Evidara'),
      concat('Practice the complete ',src.display_name,' question paper in the original order with Evidara analytics.')) returning id into v_paper;
  else
    v_paper:=v_existing;
    delete from public.paper_sections where paper_id=v_paper;
    update public.question_papers set title=src.display_name,code=upper(public.v18_slugify(concat_ws('-',src.exam_type,src.source_year,src.variant,src.paper_code))),
      source_year=src.source_year,is_previous_year_paper=true,paper_origin='pyq_generated',source_variant=src.variant,source_paper_code=src.paper_code,
      total_marks=src.maximum_marks,total_questions=src.expected_question_count,updated_by=p_actor,updated_at=now(),
      settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object('pyq_source_paper_id',src.id,'paper_key',src.paper_key,'variant',src.variant,'source_code',src.paper_code,'attemptable_questions',180,'builder','v18_pyq_exact')
      where id=v_paper;
  end if;

  if src.expected_question_count=200 then
    for v_start,v_end,v_subject,v_section,v_attempt,v_optional in
      values (1,35,'Physics','Physics · Section A',35,false),(36,50,'Physics','Physics · Section B',10,true),
             (51,85,'Chemistry','Chemistry · Section A',35,false),(86,100,'Chemistry','Chemistry · Section B',10,true),
             (101,135,'Botany','Botany · Section A',35,false),(136,150,'Botany','Botany · Section B',10,true),
             (151,185,'Zoology','Zoology · Section A',35,false),(186,200,'Zoology','Zoology · Section B',10,true)
    loop
      insert into public.paper_sections(paper_id,title,subject_key,biology_division,questions_to_attempt,selection_mode,question_target,difficulty_distribution,chapter_ids,topic_ids,display_order)
      values(v_paper,v_section,v_subject,case when v_subject='Botany' then 'botany' when v_subject='Zoology' then 'zoology' else 'combined' end,
        v_attempt,'manual',v_end-v_start+1,'{"very_easy":0,"easy":0,"moderate":0,"difficult":0,"very_difficult":0}'::jsonb,'{}'::uuid[],'{}'::uuid[],v_start) returning id into v_sec;
      for rec in select o.source_question_number,q.id qid from public.question_pyq_occurrences o join public.questions q on q.id=o.question_id where o.source_paper_id=src.id and q.status='approved' and o.source_question_number between v_start and v_end order by o.source_question_number loop
        select coalesce(jsonb_agg(jsonb_build_object('option_key',o.option_key,'content_text',o.content_text,'content_latex',o.content_latex,'image_url',o.image_url,'is_correct',o.is_correct,'display_order',o.display_order) order by o.display_order),'[]'::jsonb) into v_options from public.question_options o where o.question_id=rec.qid;
        select jsonb_build_object('id',q.id,'stem_text',q.stem_text,'stem_latex',q.stem_latex,'question_image_url',q.question_image_url,'passage_text',q.passage_text,'question_type',q.question_type,'difficulty',q.difficulty,'correct_answer',q.correct_answer,'solution_text',q.solution_text,'solution_latex',q.solution_latex,'subject_id',q.subject_id,'chapter_id',q.chapter_id,'topic_id',q.topic_id,'exam_types',q.exam_types,'class_level',q.class_level,'metadata',q.metadata,'version_number',q.version_number,'options',v_options) into v_snapshot from public.questions q where q.id=rec.qid;
        insert into public.paper_questions(paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot)
        values(v_paper,v_sec,rec.qid,rec.source_question_number,4,1,not v_optional,v_snapshot);
      end loop;
    end loop;
  else
    for v_start,v_end,v_subject,v_section,v_attempt in values
      (1,45,'Physics','Physics',45),(46,90,'Chemistry','Chemistry',45),(91,src.expected_question_count,'Biology','Biology',src.expected_question_count-90)
    loop
      insert into public.paper_sections(paper_id,title,subject_key,biology_division,questions_to_attempt,selection_mode,question_target,difficulty_distribution,chapter_ids,topic_ids,display_order)
      values(v_paper,v_section,v_subject,'combined',v_attempt,'manual',v_end-v_start+1,'{"very_easy":0,"easy":0,"moderate":0,"difficult":0,"very_difficult":0}'::jsonb,'{}'::uuid[],'{}'::uuid[],v_start) returning id into v_sec;
      for rec in select o.source_question_number,q.id qid from public.question_pyq_occurrences o join public.questions q on q.id=o.question_id where o.source_paper_id=src.id and q.status='approved' and o.source_question_number between v_start and v_end order by o.source_question_number loop
        select coalesce(jsonb_agg(jsonb_build_object('option_key',o.option_key,'content_text',o.content_text,'content_latex',o.content_latex,'image_url',o.image_url,'is_correct',o.is_correct,'display_order',o.display_order) order by o.display_order),'[]'::jsonb) into v_options from public.question_options o where o.question_id=rec.qid;
        select jsonb_build_object('id',q.id,'stem_text',q.stem_text,'stem_latex',q.stem_latex,'question_image_url',q.question_image_url,'passage_text',q.passage_text,'question_type',q.question_type,'difficulty',q.difficulty,'correct_answer',q.correct_answer,'solution_text',q.solution_text,'solution_latex',q.solution_latex,'subject_id',q.subject_id,'chapter_id',q.chapter_id,'topic_id',q.topic_id,'exam_types',q.exam_types,'class_level',q.class_level,'metadata',q.metadata,'version_number',q.version_number,'options',v_options) into v_snapshot from public.questions q where q.id=rec.qid;
        insert into public.paper_questions(paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot)
        values(v_paper,v_sec,rec.qid,rec.source_question_number,4,1,true,v_snapshot);
      end loop;
    end loop;
  end if;
  update public.question_papers set total_questions=src.expected_question_count,total_marks=src.maximum_marks where id=v_paper;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(p_actor,'pyq.paper.generated','question_paper',v_paper::text,jsonb_build_object('source_paper_id',src.id,'paper_key',src.paper_key));
  return v_paper;
end $$;


revoke all on function public.build_pyq_paper_service_v18(uuid,uuid) from public,anon,authenticated;
grant execute on function public.build_pyq_paper_service_v18(uuid,uuid) to service_role;
