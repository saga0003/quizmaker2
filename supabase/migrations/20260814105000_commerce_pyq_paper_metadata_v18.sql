create or replace function public.admin_list_products_v9()
returns jsonb
language sql stable security definer
set search_path=public,auth
as $$
 select case when public.is_evidara_platform_admin() then coalesce(jsonb_agg(product_row order by product_row->>'created_at' desc),'[]'::jsonb) else '[]'::jsonb end
 from (select jsonb_build_object(
  'id',p.id,'name',p.name,'slug',p.slug,'short_description',p.short_description,'description',p.description,'product_type',p.product_type,'audience',p.audience,'exam_type',p.exam_type,'grade_levels',p.grade_levels,
  'cover_image_url',p.cover_image_url,'gallery_image_urls',p.gallery_image_urls,'image_alt_text',p.image_alt_text,'status',p.status,'is_featured',p.is_featured,'created_at',p.created_at,'updated_at',p.updated_at,
  'seo_title',p.seo_title,'seo_description',p.seo_description,'seo_keywords',p.seo_keywords,'public_content',p.public_content,
  'current_version',(select jsonb_build_object('id',pv.id,'version_number',pv.version_number,'mrp_paise',pv.mrp_paise,'selling_price_paise',pv.selling_price_paise,'access_days',pv.access_days,'max_attempts',pv.max_attempts,'student_limit',pv.student_limit,'features',pv.features,'starts_at',pv.starts_at,'ends_at',pv.ends_at) from public.product_versions pv where pv.product_id=p.id and pv.is_current=true limit 1),
  'papers',coalesce((select jsonb_agg(jsonb_build_object(
    'id',pp.id,'paper_id',pp.paper_id,'display_name',pp.display_name,'display_order',pp.display_order,
    'title',qp.title,'code',qp.code,'exam_type',qp.exam_type,'grade_level',qp.grade_level,'test_type',qp.test_type,
    'duration_minutes',qp.duration_minutes,'total_questions',qp.total_questions,'total_marks',qp.total_marks,'status',qp.status,
    'is_previous_year_paper',qp.is_previous_year_paper,'source_year',qp.source_year,'source_variant',qp.source_variant,
    'source_paper_code',qp.source_paper_code,'paper_origin',qp.paper_origin,'pyq_source_paper_id',qp.pyq_source_paper_id
  ) order by pp.display_order,pp.created_at) from public.product_papers pp join public.question_papers qp on qp.id=pp.paper_id where pp.product_id=p.id),'[]'::jsonb),
  'paper_count',(select count(*) from public.product_papers pp where pp.product_id=p.id)
 ) product_row from public.products p) product_rows
$$;
grant execute on function public.admin_list_products_v9() to authenticated,service_role;
