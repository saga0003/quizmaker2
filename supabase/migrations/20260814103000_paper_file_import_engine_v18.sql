-- Evidara V18: atomic JSON/LaTeX paper file import.
-- Exact/near duplicate decisions are resolved in the UI before this RPC is called.

create or replace function public.paper_file_import_bundle_service_v18(p_bundle jsonb,p_actor uuid)
returns jsonb
language plpgsql security definer
set search_path=public,auth,extensions
as $$
declare
  p jsonb := coalesce(p_bundle->'paper','{}'::jsonb);
  rows jsonb := coalesce(p_bundle->'questions','[]'::jsonb);
  r jsonb;
  payload jsonb;
  opt jsonb;
  v_paper uuid;
  v_qid uuid;
  v_subject uuid;
  v_chapter uuid;
  v_topic uuid;
  v_section uuid;
  v_section_key text;
  v_section_title text;
  v_section_map jsonb := '{}'::jsonb;
  v_options jsonb;
  v_snapshot jsonb;
  v_hash text;
  v_created integer := 0;
  v_reused integer := 0;
  v_order integer := 0;
  v_total_marks numeric := 0;
  v_pyq_source uuid;
  v_pyq jsonb := coalesce(p->'pyq_source','{}'::jsonb);
  v_is_pyq boolean := coalesce((p->>'is_previous_year_paper')::boolean,false) or nullif(v_pyq->>'year','') is not null;
  v_source_year integer := coalesce(nullif(p->>'source_year','')::integer,nullif(v_pyq->>'year','')::integer);
  v_variant text := coalesce(nullif(p->>'source_variant',''),nullif(v_pyq->>'variant',''));
  v_code text := coalesce(nullif(p->>'source_paper_code',''),nullif(v_pyq->>'paper_code',''));
  v_question_number integer;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     and current_user not in ('postgres','service_role') then
    raise exception 'Server authorization is required.' using errcode='42501';
  end if;
  if not exists(select 1 from public.profiles where id=p_actor and role in ('super_admin','evidara_admin')) then
    raise exception 'Evidara Admin or Super Admin access required.' using errcode='42501';
  end if;
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows)=0 then
    raise exception 'The paper import must contain at least one question.' using errcode='22023';
  end if;

  if v_is_pyq and v_source_year is not null then
    v_pyq_source := public.upsert_pyq_source_paper_service_v18(
      jsonb_build_object(
        'exam_type',coalesce(nullif(v_pyq->>'exam_type',''),nullif(p->>'exam_type',''),'NEET'),
        'year',v_source_year,
        'variant',coalesce(v_variant,'Main'),
        'paper_code',v_code,
        'paper_key',v_pyq->>'paper_key',
        'display_name',coalesce(nullif(v_pyq->>'display_name',''),nullif(p->>'title','')),
        'source_key',v_pyq->>'source_key',
        'expected_question_count',jsonb_array_length(rows),
        'duration_minutes',coalesce(nullif(p->>'duration_minutes','')::integer,180),
        'maximum_marks',coalesce(nullif(p->>'total_marks','')::numeric,jsonb_array_length(rows)*4),
        'metadata',jsonb_build_object('created_from','paper_file_import_v18')
      ),p_actor);
  end if;

  insert into public.question_papers(
    organization_id,created_by,updated_by,title,code,description,exam_type,status,duration_minutes,instructions,
    access_mode,attempt_limit,shuffle_questions,shuffle_options,result_mode,total_marks,total_questions,settings,
    source_year,is_previous_year_paper,grade_level,test_type,open_forever,paper_origin,pyq_source_paper_id,
    source_variant,source_paper_code
  ) values(
    null,p_actor,p_actor,
    coalesce(nullif(btrim(p->>'title'),''),'Imported Question Paper'),
    nullif(btrim(p->>'code'),''),
    nullif(btrim(p->>'description'),''),
    coalesce(nullif(btrim(p->>'exam_type'),''),'Custom'),
    'draft',
    coalesce(nullif(p->>'duration_minutes','')::integer,60),
    nullif(p->>'instructions',''),
    'public',1,
    coalesce((p->>'shuffle_questions')::boolean,false),
    coalesce((p->>'shuffle_options')::boolean,false),
    'in_depth_analytics',0,jsonb_array_length(rows),
    coalesce(p->'settings','{}'::jsonb)||jsonb_build_object('file_import','v18','new_questions_require_review',true),
    v_source_year,v_is_pyq,
    nullif(p->>'grade_level',''),
    case when v_is_pyq then 'previous_year_paper' else coalesce(nullif(p->>'test_type',''),'custom') end,
    true,'file_import',v_pyq_source,v_variant,v_code
  ) returning id into v_paper;

  for r in select value from jsonb_array_elements(rows) loop
    v_order := v_order + 1;
    payload := coalesce(r->'payload',r);
    v_qid := null;
    v_subject := null;
    v_chapter := null;
    v_topic := null;
    if coalesce(r->>'decision','new')='reuse' then
      v_qid := nullif(r->>'existing_question_id','')::uuid;
      if v_qid is null or not exists(select 1 from public.questions where id=v_qid) then
        raise exception 'Question % is marked for reuse but the existing question cannot be found.',v_order;
      end if;
      select q.subject_id,q.chapter_id,q.topic_id into v_subject,v_chapter,v_topic
      from public.questions q where q.id=v_qid;
      v_reused:=v_reused+1;
    else
      v_subject := nullif(payload->>'subject_id','')::uuid;
      if v_subject is null and nullif(payload->>'subject_name','') is not null then
        select id into v_subject from public.subjects
        where organization_id is null and lower(name)=lower(btrim(payload->>'subject_name')) and coalesce(is_active,true)=true
        order by created_at desc limit 1;
      end if;
      v_chapter := nullif(payload->>'chapter_id','')::uuid;
      if v_chapter is null and v_subject is not null and nullif(payload->>'chapter_name','') is not null then
        select id into v_chapter from public.chapters
        where organization_id is null and subject_id=v_subject and lower(name)=lower(btrim(payload->>'chapter_name')) and coalesce(is_active,true)=true
        order by created_at desc limit 1;
      end if;
      v_topic := nullif(payload->>'topic_id','')::uuid;
      if v_topic is null and v_chapter is not null and nullif(payload->>'topic_name','') is not null then
        select id into v_topic from public.topics
        where organization_id is null and chapter_id=v_chapter and lower(name)=lower(btrim(payload->>'topic_name')) and coalesce(is_active,true)=true
        order by created_at desc limit 1;
      end if;

      v_options := coalesce(payload->'options','[]'::jsonb);
      v_hash := public.question_duplicate_hash(coalesce(payload->>'stem_text',payload->>'question',''),v_options);
      -- Fail closed if an exact duplicate appeared after preview.
      select id into v_qid from public.questions where duplicate_hash=v_hash order by updated_at desc limit 1;
      if v_qid is not null then
        v_reused:=v_reused+1;
      else
        insert into public.questions(
          organization_id,created_by,updated_by,subject_id,chapter_id,topic_id,question_type,status,difficulty,
          stem_text,stem_latex,question_image_url,passage_text,solution_text,solution_latex,marks,negative_marks,
          estimated_seconds,correct_answer,exam_types,class_level,source,source_year,language,tags,metadata,
          duplicate_hash,source_key,source_record_id,source_attribution,source_rights_status,review_requested_at
        ) values(
          null,p_actor,p_actor,v_subject,v_chapter,v_topic,
          coalesce(nullif(payload->>'question_type',''),'single_correct')::public.question_type,
          'in_review',
          coalesce(nullif(payload->>'difficulty',''),'moderate')::public.question_difficulty,
          coalesce(nullif(payload->>'stem_text',''),nullif(payload->>'question',''),''),
          nullif(payload->>'stem_latex',''),
          nullif(payload->>'question_image_url',''),
          nullif(payload->>'passage_text',''),
          nullif(payload->>'solution_text',''),
          nullif(payload->>'solution_latex',''),
          coalesce(nullif(payload->>'marks','')::numeric,4),
          coalesce(nullif(payload->>'negative_marks','')::numeric,1),
          nullif(payload->>'estimated_seconds','')::integer,
          coalesce(payload->'correct_answer','[]'::jsonb),
          case when jsonb_typeof(payload->'exam_types')='array'
            then array(select jsonb_array_elements_text(payload->'exam_types'))
            else array[coalesce(nullif(p->>'exam_type',''),'Custom')] end,
          nullif(payload->>'class_level',''),
          coalesce(nullif(payload->>'source',''),case when v_is_pyq then 'Previous Year Question' else 'Paper File Import' end),
          coalesce(nullif(payload->>'source_year','')::integer,v_source_year),
          coalesce(nullif(payload->>'language',''),'English'),
          case when jsonb_typeof(payload->'tags')='array'
            then array(select jsonb_array_elements_text(payload->'tags'))
            else case when v_is_pyq then array['PYQ',coalesce(v_source_year::text,'')] else array['Paper Import'] end end,
          coalesce(payload->'metadata','{}'::jsonb)||jsonb_build_object(
            'paper_file_import_v18',true,'paper_id',v_paper,'taxonomy_review_required',v_subject is null or v_chapter is null
          ),
          v_hash,nullif(payload->>'source_key',''),nullif(payload->>'source_record_id',''),
          coalesce(nullif(payload->>'source_attribution',''),nullif(p->>'title','')),
          coalesce(nullif(payload->>'source_rights_status',''),'restricted_review_only'),
          now()
        ) returning id into v_qid;
        v_created:=v_created+1;

        for opt in select value from jsonb_array_elements(v_options) loop
          insert into public.question_options(question_id,option_key,content_text,content_latex,image_url,is_correct,display_order)
          values(
            v_qid,
            coalesce(nullif(opt->>'option_key',''),chr(64+coalesce(nullif(opt->>'display_order','')::integer,0)+1)),
            coalesce(nullif(opt->>'content_text',''),nullif(opt->>'source_content_latex',''),nullif(opt->>'content_latex',''),''),
            coalesce(nullif(opt->>'content_latex',''),nullif(opt->>'source_content_latex','')),
            nullif(opt->>'image_url',''),
            coalesce((opt->>'is_correct')::boolean,(opt->>'source_is_correct')::boolean,false),
            coalesce(nullif(opt->>'display_order','')::integer,0)
          );
        end loop;
      end if;
    end if;

    v_question_number := coalesce(nullif(r->>'question_number','')::integer,v_order);
    if v_pyq_source is not null then
      insert into public.question_pyq_occurrences(question_id,source_paper_id,source_question_number,subject_label,metadata,created_by)
      values(v_qid,v_pyq_source,v_question_number,
        coalesce(nullif(payload->>'subject_name',''),nullif(r->>'subject_label','')),
        jsonb_build_object('paper_file_import_v18',true),p_actor)
      on conflict(source_paper_id,source_question_number) do update set
        question_id=excluded.question_id,subject_label=excluded.subject_label,
        metadata=public.question_pyq_occurrences.metadata||excluded.metadata,updated_at=now();
    end if;

    v_section_key := coalesce(nullif(r->>'section_key',''),nullif(r->>'section_title',''),
      nullif(payload->>'subject_name',''),'General');
    v_section_title := coalesce(nullif(r->>'section_title',''),v_section_key);
    if not (v_section_map ? v_section_key) then
      insert into public.paper_sections(
        paper_id,title,subject_id,questions_to_attempt,display_order,subject_key,biology_division,
        selection_mode,question_target,difficulty_distribution,chapter_ids,topic_ids
      ) values(
        v_paper,v_section_title,v_subject,null,v_order,v_section_key,
        case when lower(v_section_key)='botany' then 'botany' when lower(v_section_key)='zoology' then 'zoology' else 'combined' end,
        'manual',0,'{"very_easy":0,"easy":0,"moderate":0,"difficult":0,"very_difficult":0}'::jsonb,'{}'::uuid[],'{}'::uuid[]
      ) returning id into v_section;
      v_section_map := v_section_map || jsonb_build_object(v_section_key,v_section::text);
    else
      v_section := (v_section_map->>v_section_key)::uuid;
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
      'option_key',o.option_key,'content_text',o.content_text,'content_latex',o.content_latex,
      'image_url',o.image_url,'is_correct',o.is_correct,'display_order',o.display_order
    ) order by o.display_order),'[]'::jsonb) into v_options
    from public.question_options o where o.question_id=v_qid;

    select jsonb_build_object(
      'id',q.id,'stem_text',q.stem_text,'stem_latex',q.stem_latex,'question_image_url',q.question_image_url,
      'passage_text',q.passage_text,'question_type',q.question_type,'difficulty',q.difficulty,
      'correct_answer',q.correct_answer,'solution_text',q.solution_text,'solution_latex',q.solution_latex,
      'subject_id',q.subject_id,'chapter_id',q.chapter_id,'topic_id',q.topic_id,'exam_types',q.exam_types,
      'class_level',q.class_level,'metadata',q.metadata,'version_number',q.version_number,'options',v_options
    ) into v_snapshot from public.questions q where q.id=v_qid;

    insert into public.paper_questions(paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot)
    select v_paper,v_section,q.id,v_order,q.marks,q.negative_marks,true,v_snapshot
    from public.questions q where q.id=v_qid;

    update public.paper_sections set
      question_target=question_target+1,
      questions_to_attempt=coalesce(questions_to_attempt,0)+1
    where id=v_section;
    select v_total_marks+q.marks into v_total_marks from public.questions q where q.id=v_qid;
  end loop;

  update public.question_papers
  set total_questions=v_order,total_marks=v_total_marks,
      settings=settings||jsonb_build_object('created_questions',v_created,'reused_questions',v_reused)
  where id=v_paper;

  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(p_actor,'paper.file_imported','question_paper',v_paper::text,
    jsonb_build_object('created_questions',v_created,'reused_questions',v_reused,'is_pyq',v_is_pyq,'source_year',v_source_year,'variant',v_variant));

  return jsonb_build_object('paper_id',v_paper,'created_questions',v_created,'reused_questions',v_reused,'total_questions',v_order);
end $$;

revoke all on function public.paper_file_import_bundle_service_v18(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.paper_file_import_bundle_service_v18(jsonb,uuid) to service_role;
