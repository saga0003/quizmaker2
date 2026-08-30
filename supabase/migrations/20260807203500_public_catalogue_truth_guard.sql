update public.products set status='draft',updated_at=now() where slug='hema-demo' and name='Demo Test Paper Series' and status='published';

create or replace function public.get_store_products()
returns table (
  id uuid,name text,slug text,short_description text,description text,product_type public.product_type,audience public.product_audience,exam_type text,grade_levels text[],cover_image_url text,gallery_image_urls text[],image_alt_text text,is_featured boolean,version_id uuid,mrp_paise integer,selling_price_paise integer,access_days integer,max_attempts integer,student_limit integer,features jsonb,starts_at timestamptz,ends_at timestamptz,paper_count integer,papers jsonb
)
language sql stable security definer set search_path=public as $$
  select p.id,p.name,p.slug,p.short_description,p.description,p.product_type,p.audience,p.exam_type,p.grade_levels,
         p.cover_image_url,p.gallery_image_urls,p.image_alt_text,p.is_featured,
         pv.id,pv.mrp_paise,pv.selling_price_paise,pv.access_days,pv.max_attempts,pv.student_limit,pv.features,pv.starts_at,pv.ends_at,
         (select count(*)::integer from public.product_papers pp where pp.product_id=p.id),
         coalesce((select jsonb_agg(jsonb_build_object('paper_id',pp.paper_id,'name',pp.display_name,'display_order',pp.display_order,'exam_type',qp.exam_type,'grade_level',qp.grade_level,'test_type',qp.test_type,'duration_minutes',qp.duration_minutes,'total_questions',qp.total_questions,'total_marks',qp.total_marks) order by pp.display_order,pp.created_at) from public.product_papers pp join public.question_papers qp on qp.id=pp.paper_id where pp.product_id=p.id),'[]'::jsonb)
  from public.products p join public.product_versions pv on pv.product_id=p.id and pv.is_current=true
  where p.status='published'
    and (pv.starts_at is null or pv.starts_at<=now())
    and (pv.ends_at is null or pv.ends_at>=now())
    and (p.product_type<>'test_series' or exists(select 1 from public.product_papers pp where pp.product_id=p.id))
  order by p.is_featured desc,p.created_at desc;
$$;
revoke all on function public.get_store_products() from public;
grant execute on function public.get_store_products() to anon,authenticated;
