-- Evidara V18: first-class PYQ paper identity, question occurrences,
-- exact-paper builder and file-import duplicate review support.

create extension if not exists pg_trgm with schema extensions;

create table if not exists public.pyq_source_papers (
  id uuid primary key default gen_random_uuid(),
  exam_type text not null default 'NEET',
  source_year integer not null check (source_year between 1990 and 2100),
  variant text not null default 'Main',
  paper_code text,
  paper_key text not null unique,
  display_name text not null,
  source_key text unique,
  expected_question_count integer not null default 0 check (expected_question_count >= 0),
  duration_minutes integer not null default 180 check (duration_minutes > 0),
  maximum_marks numeric(10,2) not null default 720 check (maximum_marks >= 0),
  is_official_pyq boolean not null default true,
  status text not null default 'active' check (status in ('active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pyq_source_papers_exam_year_idx on public.pyq_source_papers(exam_type, source_year desc, variant);
create index if not exists pyq_source_papers_source_key_idx on public.pyq_source_papers(source_key);

create table if not exists public.question_pyq_occurrences (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  source_paper_id uuid not null references public.pyq_source_papers(id) on delete cascade,
  source_question_number integer check (source_question_number is null or source_question_number > 0),
  subject_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_paper_id, source_question_number)
);

create index if not exists question_pyq_occurrences_question_idx on public.question_pyq_occurrences(question_id);
create index if not exists question_pyq_occurrences_source_idx on public.question_pyq_occurrences(source_paper_id, source_question_number);

alter table public.question_papers add column if not exists paper_origin text not null default 'manual';
alter table public.question_papers add column if not exists pyq_source_paper_id uuid references public.pyq_source_papers(id) on delete set null;
alter table public.question_papers add column if not exists source_variant text;
alter table public.question_papers add column if not exists source_paper_code text;

DO $$ begin
  alter table public.question_papers add constraint question_papers_paper_origin_check
    check (paper_origin in ('manual','pyq_generated','file_import'));
exception when duplicate_object then null; end $$;

create index if not exists question_papers_pyq_source_idx on public.question_papers(pyq_source_paper_id);
create index if not exists question_papers_pyq_year_idx on public.question_papers(is_previous_year_paper, source_year desc, source_variant);

alter table public.pyq_source_papers enable row level security;
alter table public.question_pyq_occurrences enable row level security;

revoke all on table public.pyq_source_papers from anon, authenticated;
revoke all on table public.question_pyq_occurrences from anon, authenticated;
grant select on table public.pyq_source_papers to authenticated;
grant select on table public.question_pyq_occurrences to authenticated;

DROP POLICY IF EXISTS pyq_sources_authenticated_read_v18 on public.pyq_source_papers;
create policy pyq_sources_authenticated_read_v18 on public.pyq_source_papers
for select to authenticated using (true);

DROP POLICY IF EXISTS pyq_occurrences_scoped_read_v18 on public.question_pyq_occurrences;
create policy pyq_occurrences_scoped_read_v18 on public.question_pyq_occurrences
for select to authenticated using (
  public.is_evidara_platform_admin()
  or exists (
    select 1 from public.questions q
    where q.id=question_id
      and (
        q.status='approved'
        or (q.organization_id is not null and public.is_evidara_school_staff(q.organization_id))
      )
  )
);

create or replace function public.v18_slugify(p_value text)
returns text language sql immutable set search_path=public as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_value,'')), '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.upsert_pyq_source_paper_service_v18(p_source jsonb, p_actor uuid)
returns uuid
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v_id uuid;
  v_year integer := nullif(p_source->>'year','')::integer;
  v_exam text := coalesce(nullif(btrim(p_source->>'exam_type'),''), nullif(btrim(p_source->>'exam'),''), 'NEET');
  v_variant text := coalesce(nullif(btrim(p_source->>'variant'),''),'Main');
  v_code text := nullif(btrim(p_source->>'paper_code'),'');
  v_key text := nullif(btrim(p_source->>'paper_key'),'');
  v_label text := nullif(btrim(p_source->>'display_name'),'');
  v_source_key text := nullif(btrim(p_source->>'source_key'),'');
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' and current_user not in ('postgres','service_role') then
    raise exception 'Server authorization is required.' using errcode='42501';
  end if;
  if v_year is null then raise exception 'PYQ source year is required.'; end if;
  if v_key is null then v_key := public.v18_slugify(concat_ws('-',v_exam,v_year,v_variant,v_code)); end if;
  if v_label is null then v_label := concat_ws(' ',case when lower(v_variant) like '%re%neet%' then 'Re-NEET' else v_exam end,v_year,case when lower(v_variant) in ('main','re-neet','reneet') then null else v_variant end); end if;

  insert into public.pyq_source_papers(exam_type,source_year,variant,paper_code,paper_key,display_name,source_key,
    expected_question_count,duration_minutes,maximum_marks,is_official_pyq,status,metadata,created_by,updated_by)
  values(v_exam,v_year,v_variant,v_code,v_key,v_label,v_source_key,
    coalesce(nullif(p_source->>'expected_question_count','')::integer,0),
    coalesce(nullif(p_source->>'duration_minutes','')::integer,180),
    coalesce(nullif(p_source->>'maximum_marks','')::numeric,720),true,'active',coalesce(p_source->'metadata','{}'::jsonb),p_actor,p_actor)
  on conflict(paper_key) do update set
    exam_type=excluded.exam_type,source_year=excluded.source_year,variant=excluded.variant,paper_code=excluded.paper_code,
    display_name=excluded.display_name,source_key=coalesce(excluded.source_key,public.pyq_source_papers.source_key),
    expected_question_count=greatest(excluded.expected_question_count,public.pyq_source_papers.expected_question_count),
    duration_minutes=excluded.duration_minutes,maximum_marks=excluded.maximum_marks,
    metadata=public.pyq_source_papers.metadata||excluded.metadata,updated_by=p_actor,updated_at=now()
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.upsert_pyq_source_paper_service_v18(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.upsert_pyq_source_paper_service_v18(jsonb,uuid) to service_role;

create or replace function public.sync_question_pyq_occurrences_service_v18(p_question_id uuid,p_occurrences jsonb,p_actor uuid)
returns jsonb
language plpgsql security definer set search_path=public,auth as $$
declare
  r jsonb;
  v_source uuid;
  v_kept uuid[] := '{}'::uuid[];
  v_count integer := 0;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' and current_user not in ('postgres','service_role') then
    raise exception 'Server authorization is required.' using errcode='42501';
  end if;
  if not exists(select 1 from public.questions where id=p_question_id) then raise exception 'Question not found.'; end if;
  if jsonb_typeof(coalesce(p_occurrences,'[]'::jsonb)) <> 'array' then raise exception 'Occurrences must be an array.'; end if;

  for r in select value from jsonb_array_elements(coalesce(p_occurrences,'[]'::jsonb)) loop
    if nullif(r->>'year','') is null then continue; end if;
    v_source := public.upsert_pyq_source_paper_service_v18(
      jsonb_build_object(
        'exam_type',coalesce(r->>'exam_type','NEET'),'year',(r->>'year')::integer,'variant',coalesce(r->>'variant','Main'),
        'paper_code',r->>'paper_code','paper_key',r->>'paper_key','display_name',r->>'display_name','source_key',r->>'source_key',
        'expected_question_count',coalesce(nullif(r->>'expected_question_count','')::integer,0),'duration_minutes',180,'maximum_marks',720,
        'metadata',coalesce(r->'metadata','{}'::jsonb)
      ),p_actor);
    insert into public.question_pyq_occurrences(question_id,source_paper_id,source_question_number,subject_label,metadata,created_by)
    values(p_question_id,v_source,nullif(r->>'question_number','')::integer,nullif(r->>'subject_label',''),coalesce(r->'metadata','{}'::jsonb),p_actor)
    on conflict(source_paper_id,source_question_number) do update set
      question_id=excluded.question_id,subject_label=excluded.subject_label,metadata=public.question_pyq_occurrences.metadata||excluded.metadata,updated_at=now()
    returning id into v_source;
    v_kept := array_append(v_kept,v_source);
    v_count := v_count+1;
  end loop;

  delete from public.question_pyq_occurrences o
  where o.question_id=p_question_id and not (o.id=any(v_kept));

  return jsonb_build_object('question_id',p_question_id,'occurrences',v_count);
end $$;

revoke all on function public.sync_question_pyq_occurrences_service_v18(uuid,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.sync_question_pyq_occurrences_service_v18(uuid,jsonb,uuid) to service_role;

create or replace function public.preview_paper_import_duplicates_service_v18(p_rows jsonb)
returns jsonb
language plpgsql security definer set search_path=public,extensions as $$
declare
  r jsonb;
  v_hash text;
  v_stem text;
  v_options jsonb;
  v_out jsonb := '[]'::jsonb;
  v_exact jsonb;
  v_near jsonb;
begin
  if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' and current_user not in ('postgres','service_role') then
    raise exception 'Server authorization is required.' using errcode='42501';
  end if;
  for r in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
    v_stem := coalesce(r->>'stem_text',r->>'question','');
    v_options := coalesce(r->'options','[]'::jsonb);
    v_hash := public.question_duplicate_hash(v_stem,v_options);
    select jsonb_build_object('id',q.id,'stem_text',q.stem_text,'status',q.status,'source',q.source,'source_year',q.source_year,
      'subject',s.name,'chapter',c.name,'topic',t.name,'similarity',1.0) into v_exact
    from public.questions q left join public.subjects s on s.id=q.subject_id left join public.chapters c on c.id=q.chapter_id left join public.topics t on t.id=q.topic_id
    where q.duplicate_hash=v_hash order by q.updated_at desc limit 1;

    select coalesce(jsonb_agg(x),'[]'::jsonb) into v_near from (
      select jsonb_build_object('id',q.id,'stem_text',q.stem_text,'status',q.status,'source',q.source,'source_year',q.source_year,
        'subject',s.name,'chapter',c.name,'topic',t.name,
        'similarity',round(extensions.similarity(lower(q.stem_text),lower(v_stem))::numeric,3)) x
      from public.questions q left join public.subjects s on s.id=q.subject_id left join public.chapters c on c.id=q.chapter_id left join public.topics t on t.id=q.topic_id
      where q.duplicate_hash is distinct from v_hash and extensions.similarity(lower(q.stem_text),lower(v_stem)) >= 0.82
      order by extensions.similarity(lower(q.stem_text),lower(v_stem)) desc, q.updated_at desc limit 3
    ) z;
    v_out := v_out || jsonb_build_array(jsonb_build_object('client_id',r->>'client_id','exact',v_exact,'near',v_near));
  end loop;
  return v_out;
end $$;

revoke all on function public.preview_paper_import_duplicates_service_v18(jsonb) from public,anon,authenticated;
grant execute on function public.preview_paper_import_duplicates_service_v18(jsonb) to service_role;

create or replace function public.build_pyq_paper_service_v18(p_source_paper_id uuid,p_actor uuid)
returns uuid
language plpgsql security definer set search_path=public,auth as $$
declare
  src public.pyq_source_papers%rowtype;
  v_paper uuid;
  v_staged integer;
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

  select count(*) into v_staged from public.question_staging where source_key=src.source_key;
  select count(*) into v_ready from public.question_staging qs join public.questions q on q.id=qs.promoted_question_id
    where qs.source_key=src.source_key and q.status='approved';
  if v_staged < src.expected_question_count or v_ready < src.expected_question_count then
    raise exception 'This PYQ paper is not ready. % of % source rows are staged and % are approved in the Question Bank.',v_staged,src.expected_question_count,v_ready;
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
      for rec in select qs.source_question_number,qs.promoted_question_id qid from public.question_staging qs where qs.source_key=src.source_key and qs.source_question_number between v_start and v_end order by qs.source_question_number loop
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
      for rec in select qs.source_question_number,qs.promoted_question_id qid from public.question_staging qs where qs.source_key=src.source_key and qs.source_question_number between v_start and v_end order by qs.source_question_number loop
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

-- Product paper picker receives first-class PYQ metadata.
create or replace function public.list_product_builder_papers_v9()
returns jsonb
language sql stable security definer set search_path=public,auth as $$
  select case when public.is_evidara_platform_admin() then coalesce(jsonb_agg(jsonb_build_object(
    'id',p.id,'title',p.title,'code',p.code,'description',p.description,'exam_type',p.exam_type,'grade_level',p.grade_level,
    'test_type',p.test_type,'custom_test_type',p.custom_test_type,'status',p.status,'duration_minutes',p.duration_minutes,
    'total_questions',p.total_questions,'total_marks',p.total_marks,'published_at',p.published_at,
    'is_previous_year_paper',p.is_previous_year_paper,'source_year',p.source_year,'source_variant',p.source_variant,
    'source_paper_code',p.source_paper_code,'paper_origin',p.paper_origin,'pyq_source_paper_id',p.pyq_source_paper_id
  ) order by p.source_year desc nulls last,p.published_at desc nulls last,p.created_at desc),'[]'::jsonb) else '[]'::jsonb end
  from public.question_papers p where p.organization_id is null and p.status in ('approved','published');
$$;

grant execute on function public.list_product_builder_papers_v9() to authenticated,service_role;
