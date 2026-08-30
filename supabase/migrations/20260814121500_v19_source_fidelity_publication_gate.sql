-- Evidara V19 source-fidelity publication gate.
create index if not exists questions_source_record_lookup_v19 on public.questions(source_key,source_record_id);

create or replace function public.source_fidelity_ready_v19(p_metadata jsonb)
returns boolean language sql immutable set search_path='public' as $$
  select case
    when coalesce(p_metadata->>'source_fidelity','false') <> 'true' then true
    when jsonb_typeof(p_metadata->'v19_render'->'prompt_segments') <> 'array' then false
    when jsonb_typeof(p_metadata->'v19_render'->'solution_segments') <> 'array' then false
    when jsonb_array_length(p_metadata->'v19_render'->'prompt_segments') < 1 then false
    when jsonb_array_length(p_metadata->'v19_render'->'solution_segments') < 1 then false
    when exists(select 1 from jsonb_array_elements(p_metadata->'v19_render'->'prompt_segments') s where nullif(trim(s->>'url'),'') is null) then false
    when exists(select 1 from jsonb_array_elements(p_metadata->'v19_render'->'solution_segments') s where nullif(trim(s->>'url'),'') is null) then false
    else true
  end
$$;

create or replace function public.sync_question_seo_v15()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_subject text; v_chapter text; v_exam text; v_complete boolean;
begin
  select s.name,c.name into v_subject,v_chapter from public.subjects s left join public.chapters c on c.id=new.chapter_id where s.id=new.subject_id;
  v_exam:=coalesce(new.exam_types[1],'exam');
  v_complete:=new.status='approved'
    and length(trim(coalesce(new.stem_text,new.stem_latex,'')))>8
    and new.correct_answer is not null and new.correct_answer<>'[]'::jsonb and new.correct_answer<>'{}'::jsonb
    and length(trim(coalesce(new.solution_text,new.solution_latex,'')))>8
    and lower(coalesce(new.source_rights_status,'')) not in ('restricted','blocked','copyright_blocked','do_not_publish')
    and public.source_fidelity_ready_v19(new.metadata);
  if new.seo_slug is null or new.seo_slug='' then new.seo_slug:=public.seo_slugify_v15(concat_ws('-',v_exam,v_subject,v_chapter,'question',left(new.id::text,8))); end if;
  new.seo_title:=coalesce(nullif(new.seo_title,''),concat_ws(' ',v_exam,v_subject,coalesce(v_chapter,''),'Solved Question | Evidara'));
  new.seo_description:=coalesce(nullif(new.seo_description,''),left(regexp_replace(coalesce(new.stem_text,''),'\s+',' ','g'),145)||' — answer and detailed solution on Evidara.');
  new.seo_status:=case when v_complete then 'published' else 'draft' end;
  if new.seo_status='published' and (old.seo_status is distinct from 'published' or new.seo_published_at is null) then new.seo_published_at:=now(); end if;
  return new;
end $$;

create or replace function public.get_public_question_v15(p_slug text)
returns jsonb language sql stable security definer set search_path='public' as $$
 select coalesce((select jsonb_build_object(
  'id',q.id,'slug',q.seo_slug,'title',q.seo_title,'description',q.seo_description,'stem_text',q.stem_text,'stem_latex',q.stem_latex,'question_image_url',q.question_image_url,
  'passage_text',q.passage_text,'solution_text',q.solution_text,'solution_latex',q.solution_latex,'correct_answer',q.correct_answer,'difficulty',q.difficulty,'marks',q.marks,'negative_marks',q.negative_marks,
  'exam_types',q.exam_types,'class_level',q.class_level,'source_year',q.source_year,'updated_at',q.updated_at,'metadata',q.metadata,
  'subject',s.name,'chapter',c.name,'topic',t.name,
  'options',coalesce((select jsonb_agg(jsonb_build_object('option_key',o.option_key,'content_text',o.content_text,'content_latex',o.content_latex,'image_url',o.image_url,'display_order',o.display_order) order by o.display_order) from public.question_options o where o.question_id=q.id),'[]'::jsonb)
 ) from public.questions q left join public.subjects s on s.id=q.subject_id left join public.chapters c on c.id=q.chapter_id left join public.topics t on t.id=q.topic_id where q.seo_slug=p_slug and q.seo_status='published' and q.organization_id is null), '{}'::jsonb)
$$;
grant execute on function public.get_public_question_v15(text) to anon,authenticated;
