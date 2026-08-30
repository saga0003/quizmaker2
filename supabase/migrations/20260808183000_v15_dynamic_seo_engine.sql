-- Evidara V15 dynamic public SEO engine.

alter table public.products
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_keywords text[] not null default '{}',
  add column if not exists public_content jsonb not null default '{}'::jsonb;

alter table public.questions
  add column if not exists seo_slug text,
  add column if not exists seo_status text not null default 'draft',
  add column if not exists seo_title text,
  add column if not exists seo_description text,
  add column if not exists seo_published_at timestamptz;

alter table public.question_papers
  add column if not exists seo_slug text,
  add column if not exists seo_title text,
  add column if not exists seo_description text;

create unique index if not exists questions_seo_slug_unique on public.questions(seo_slug) where seo_slug is not null;
create unique index if not exists papers_seo_slug_unique on public.question_papers(seo_slug) where seo_slug is not null;

create or replace function public.seo_slugify_v15(p_value text)
returns text language sql immutable set search_path='' as $$
  select trim(both '-' from regexp_replace(lower(coalesce(p_value,'')), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.sync_question_seo_v15()
returns trigger language plpgsql security definer set search_path='public' as $$
declare v_subject text; v_chapter text; v_exam text; v_complete boolean;
begin
  select s.name, c.name into v_subject, v_chapter
  from public.subjects s left join public.chapters c on c.id=new.chapter_id
  where s.id=new.subject_id;
  v_exam := coalesce(new.exam_types[1], 'exam');
  v_complete := new.status='approved'
    and length(trim(coalesce(new.stem_text,new.stem_latex,''))) > 8
    and new.correct_answer is not null and new.correct_answer <> '[]'::jsonb and new.correct_answer <> '{}'::jsonb
    and length(trim(coalesce(new.solution_text,new.solution_latex,''))) > 8
    and lower(coalesce(new.source_rights_status,'')) not in ('restricted','blocked','copyright_blocked','do_not_publish');
  if new.seo_slug is null or new.seo_slug='' then
    new.seo_slug := public.seo_slugify_v15(concat_ws('-',v_exam,v_subject,v_chapter,'question',left(new.id::text,8)));
  end if;
  new.seo_title := coalesce(nullif(new.seo_title,''), concat_ws(' ',v_exam,v_subject,coalesce(v_chapter,''),'Solved Question | Evidara'));
  new.seo_description := coalesce(nullif(new.seo_description,''), left(regexp_replace(coalesce(new.stem_text,''),'\s+',' ','g'),145) || ' — answer and detailed solution on Evidara.');
  new.seo_status := case when v_complete then 'published' else 'draft' end;
  if new.seo_status='published' and (old.seo_status is distinct from 'published' or new.seo_published_at is null) then new.seo_published_at:=now(); end if;
  return new;
end $$;

drop trigger if exists sync_question_seo_v15 on public.questions;
create trigger sync_question_seo_v15 before insert or update on public.questions for each row execute function public.sync_question_seo_v15();

create or replace function public.sync_paper_seo_v15()
returns trigger language plpgsql security definer set search_path='public' as $$
begin
  if new.seo_slug is null or new.seo_slug='' then
    new.seo_slug:=public.seo_slugify_v15(concat_ws('-',new.exam_type,new.source_year,new.title,left(new.id::text,8)));
  end if;
  new.seo_title:=coalesce(nullif(new.seo_title,''), concat_ws(' ',new.exam_type,case when new.source_year is not null then new.source_year::text end,'Question Paper','| Evidara'));
  new.seo_description:=coalesce(nullif(new.seo_description,''), concat_ws(' ', 'View and practise',new.exam_type,case when new.source_year is not null then new.source_year::text end,'question paper with Evidara.'));
  return new;
end $$;
drop trigger if exists sync_paper_seo_v15 on public.question_papers;
create trigger sync_paper_seo_v15 before insert or update on public.question_papers for each row execute function public.sync_paper_seo_v15();

-- Backfill derived SEO fields without changing review/approval status.
update public.questions set updated_at=updated_at;
update public.question_papers set updated_at=updated_at;

create or replace function public.admin_update_product_seo_v15(p_product_id uuid,p_seo_title text,p_seo_description text,p_seo_keywords text[],p_public_content jsonb)
returns void language plpgsql security definer set search_path='public','auth' as $$
begin
  if not public.is_evidara_platform_admin() then raise exception 'Platform Admin access required.' using errcode='42501'; end if;
  update public.products set
    seo_title=nullif(trim(p_seo_title),''),
    seo_description=nullif(trim(p_seo_description),''),
    seo_keywords=coalesce(p_seo_keywords,'{}'),
    public_content=coalesce(p_public_content,'{}'::jsonb), updated_at=now()
  where id=p_product_id;
  if not found then raise exception 'Product not found.' using errcode='P0002'; end if;
end $$;
revoke all on function public.admin_update_product_seo_v15(uuid,text,text,text[],jsonb) from public,anon;
grant execute on function public.admin_update_product_seo_v15(uuid,text,text,text[],jsonb) to authenticated;

create or replace function public.get_public_product_v15(p_slug text)
returns jsonb language sql stable security definer set search_path='public' as $$
 select coalesce((select jsonb_build_object(
  'id',p.id,'name',p.name,'slug',p.slug,'short_description',p.short_description,'description',p.description,'product_type',p.product_type,'audience',p.audience,
  'exam_type',p.exam_type,'grade_levels',p.grade_levels,'cover_image_url',p.cover_image_url,'gallery_image_urls',p.gallery_image_urls,'image_alt_text',p.image_alt_text,
  'seo_title',coalesce(p.seo_title,p.name||' | Evidara'),'seo_description',coalesce(p.seo_description,p.short_description,p.description),'seo_keywords',p.seo_keywords,'public_content',p.public_content,
  'is_featured',p.is_featured,'updated_at',p.updated_at,
  'version',(select jsonb_build_object('mrp_paise',pv.mrp_paise,'selling_price_paise',pv.selling_price_paise,'access_days',pv.access_days,'max_attempts',pv.max_attempts,'features',pv.features) from public.product_versions pv where pv.product_id=p.id and pv.is_current=true limit 1),
  'papers',coalesce((select jsonb_agg(jsonb_build_object('paper_id',pp.paper_id,'display_name',pp.display_name,'display_order',pp.display_order,'exam_type',qp.exam_type,'test_type',qp.test_type,'duration_minutes',qp.duration_minutes,'total_questions',qp.total_questions,'total_marks',qp.total_marks) order by pp.display_order) from public.product_papers pp join public.question_papers qp on qp.id=pp.paper_id where pp.product_id=p.id),'[]'::jsonb)
 ) from public.products p where p.slug=p_slug and p.status='published'), '{}'::jsonb)
$$;
grant execute on function public.get_public_product_v15(text) to anon,authenticated;

create or replace function public.get_public_question_v15(p_slug text)
returns jsonb language sql stable security definer set search_path='public' as $$
 select coalesce((select jsonb_build_object(
  'id',q.id,'slug',q.seo_slug,'title',q.seo_title,'description',q.seo_description,'stem_text',q.stem_text,'stem_latex',q.stem_latex,'question_image_url',q.question_image_url,
  'passage_text',q.passage_text,'solution_text',q.solution_text,'solution_latex',q.solution_latex,'correct_answer',q.correct_answer,'difficulty',q.difficulty,'marks',q.marks,'negative_marks',q.negative_marks,
  'exam_types',q.exam_types,'class_level',q.class_level,'source_year',q.source_year,'updated_at',q.updated_at,
  'subject',s.name,'chapter',c.name,'topic',t.name,
  'options',coalesce((select jsonb_agg(jsonb_build_object('option_key',o.option_key,'content_text',o.content_text,'content_latex',o.content_latex,'image_url',o.image_url,'display_order',o.display_order) order by o.display_order) from public.question_options o where o.question_id=q.id),'[]'::jsonb)
 ) from public.questions q left join public.subjects s on s.id=q.subject_id left join public.chapters c on c.id=q.chapter_id left join public.topics t on t.id=q.topic_id where q.seo_slug=p_slug and q.seo_status='published' and q.organization_id is null), '{}'::jsonb)
$$;
grant execute on function public.get_public_question_v15(text) to anon,authenticated;

create or replace function public.list_public_seo_questions_v15(p_limit integer default 1000,p_offset integer default 0)
returns jsonb language sql stable security definer set search_path='public' as $$
 select coalesce(jsonb_agg(jsonb_build_object('slug',q.seo_slug,'updated_at',q.updated_at,'exam_type',q.exam_types[1],'subject',s.name,'chapter',c.name,'topic',t.name,'source_year',q.source_year) order by q.updated_at desc),'[]'::jsonb)
 from (select * from public.questions where seo_status='published' and organization_id is null order by updated_at desc limit least(greatest(p_limit,1),5000) offset greatest(p_offset,0)) q
 left join public.subjects s on s.id=q.subject_id left join public.chapters c on c.id=q.chapter_id left join public.topics t on t.id=q.topic_id
$$;
grant execute on function public.list_public_seo_questions_v15(integer,integer) to anon,authenticated;

create or replace function public.list_public_products_v15()
returns jsonb language sql stable security definer set search_path='public' as $$
 select coalesce(jsonb_agg(jsonb_build_object('slug',p.slug,'name',p.name,'exam_type',p.exam_type,'updated_at',p.updated_at,'seo_title',coalesce(p.seo_title,p.name),'seo_description',coalesce(p.seo_description,p.short_description)) order by p.updated_at desc),'[]'::jsonb) from public.products p where p.status='published'
$$;
grant execute on function public.list_public_products_v15() to anon,authenticated;

create or replace function public.list_public_papers_v15()
returns jsonb language sql stable security definer set search_path='public' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',qp.id,'slug',qp.seo_slug,'title',qp.title,'exam_type',qp.exam_type,'source_year',qp.source_year,'test_type',qp.test_type,'duration_minutes',qp.duration_minutes,'total_questions',qp.total_questions,'total_marks',qp.total_marks,'seo_title',qp.seo_title,'seo_description',qp.seo_description,'updated_at',qp.updated_at) order by qp.source_year desc nulls last,qp.updated_at desc),'[]'::jsonb)
 from public.question_papers qp where qp.status='published' and qp.access_mode='public' and (qp.is_previous_year_paper=true or qp.source_year is not null or lower(qp.test_type) like '%model%' or lower(qp.test_type) like '%mock%')
$$;
grant execute on function public.list_public_papers_v15() to anon,authenticated;

create or replace function public.get_public_paper_v15(p_slug text)
returns jsonb language sql stable security definer set search_path='public' as $$
 select coalesce((select jsonb_build_object('id',qp.id,'slug',qp.seo_slug,'title',qp.title,'description',qp.description,'exam_type',qp.exam_type,'source_year',qp.source_year,'test_type',qp.test_type,'duration_minutes',qp.duration_minutes,'total_questions',qp.total_questions,'total_marks',qp.total_marks,'seo_title',qp.seo_title,'seo_description',qp.seo_description,'updated_at',qp.updated_at) from public.question_papers qp where qp.seo_slug=p_slug and qp.status='published' and qp.access_mode='public'), '{}'::jsonb)
$$;
grant execute on function public.get_public_paper_v15(text) to anon,authenticated;

-- Keep admin product listing in sync with new SEO editor fields.
create or replace function public.admin_list_products_v9()
returns jsonb language sql stable security definer set search_path='public','auth' as $$
 select case when public.is_evidara_platform_admin() then coalesce(jsonb_agg(product_row order by product_row->>'created_at' desc),'[]'::jsonb) else '[]'::jsonb end
 from (select jsonb_build_object(
  'id',p.id,'name',p.name,'slug',p.slug,'short_description',p.short_description,'description',p.description,'product_type',p.product_type,'audience',p.audience,'exam_type',p.exam_type,'grade_levels',p.grade_levels,
  'cover_image_url',p.cover_image_url,'gallery_image_urls',p.gallery_image_urls,'image_alt_text',p.image_alt_text,'status',p.status,'is_featured',p.is_featured,'created_at',p.created_at,'updated_at',p.updated_at,
  'seo_title',p.seo_title,'seo_description',p.seo_description,'seo_keywords',p.seo_keywords,'public_content',p.public_content,
  'current_version',(select jsonb_build_object('id',pv.id,'version_number',pv.version_number,'mrp_paise',pv.mrp_paise,'selling_price_paise',pv.selling_price_paise,'access_days',pv.access_days,'max_attempts',pv.max_attempts,'student_limit',pv.student_limit,'features',pv.features,'starts_at',pv.starts_at,'ends_at',pv.ends_at) from public.product_versions pv where pv.product_id=p.id and pv.is_current=true limit 1),
  'papers',coalesce((select jsonb_agg(jsonb_build_object('id',pp.id,'paper_id',pp.paper_id,'display_name',pp.display_name,'display_order',pp.display_order,'title',qp.title,'code',qp.code,'exam_type',qp.exam_type,'grade_level',qp.grade_level,'test_type',qp.test_type,'duration_minutes',qp.duration_minutes,'total_questions',qp.total_questions,'total_marks',qp.total_marks,'status',qp.status) order by pp.display_order,pp.created_at) from public.product_papers pp join public.question_papers qp on qp.id=pp.paper_id where pp.product_id=p.id),'[]'::jsonb),
  'paper_count',(select count(*) from public.product_papers pp where pp.product_id=p.id)
 ) product_row from public.products p) product_rows
$$;
