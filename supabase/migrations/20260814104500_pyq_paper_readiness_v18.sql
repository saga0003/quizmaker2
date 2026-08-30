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
    'promoted_count',(select count(*) from public.question_staging qs where qs.source_key=s.source_key and qs.promoted_question_id is not null),
    'approved_count',(select count(*) from public.question_staging qs join public.questions q on q.id=qs.promoted_question_id where qs.source_key=s.source_key and q.status='approved'),
    'review_count',(select count(*) from public.question_staging qs join public.questions q on q.id=qs.promoted_question_id where qs.source_key=s.source_key and q.status='in_review'),
    'taxonomy_review_count',(select count(*) from public.question_staging qs where qs.source_key=s.source_key and qs.chapter_id is null),
    'built_paper',(select jsonb_build_object('id',p.id,'title',p.title,'status',p.status,'total_questions',p.total_questions,'updated_at',p.updated_at)
      from public.question_papers p where p.pyq_source_paper_id=s.id and p.organization_id is null order by p.created_at desc limit 1),
    'ready_to_build', s.expected_question_count > 0 and
      (select count(*) from public.question_staging qs where qs.source_key=s.source_key) >= s.expected_question_count and
      (select count(*) from public.question_staging qs join public.questions q on q.id=qs.promoted_question_id where qs.source_key=s.source_key and q.status='approved') >= s.expected_question_count
  ) order by s.source_year desc,s.variant,s.paper_code),'[]'::jsonb)
  from public.pyq_source_papers s where s.status='active';
$$;
revoke all on function public.list_pyq_source_paper_readiness_service_v18() from public,anon,authenticated;
grant execute on function public.list_pyq_source_paper_readiness_service_v18() to service_role;
