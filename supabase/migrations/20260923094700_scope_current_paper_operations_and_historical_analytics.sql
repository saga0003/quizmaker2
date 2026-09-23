do $patch$
declare
  r record;
  d text;
begin
  for r in
    select p.oid,p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and p.proname in (
        'paper_publish_readiness_internal_v1',
        'benchmark_paper_fingerprint',
        'clone_paper_as_new_version_v1',
        'get_live_student_analytics_v12',
        'get_student_own_question_evidence_v12',
        'get_student_reference_breakdowns_v13',
        'get_student_reference_scoped_breakdowns_v13',
        'get_student_reference_taxonomy_detail_v13',
        'get_student_test_review_v12',
        'guard_and_refresh_paper_before_publish_v18',
        'set_question_paper_pyq_identity_v18',
        'start_benchmark_attempt'
      )
  loop
    d := pg_get_functiondef(r.oid);

    if r.proname='paper_publish_readiness_internal_v1' then
      d := replace(d,'where pq.paper_id=p_paper_id;','where pq.paper_id=p_paper_id and coalesce(pq.is_active,true);');

    elsif r.proname='benchmark_paper_fingerprint' then
      d := replace(d,'where s.paper_id = p.id','where s.paper_id = p.id and coalesce(s.is_active,true)');
      d := replace(d,'where q.paper_id = p.id','where q.paper_id = p.id and coalesce(q.is_active,true)');

    elsif r.proname='clone_paper_as_new_version_v1' then
      d := replace(d,'from public.paper_sections where paper_id=p_source_paper_id order by','from public.paper_sections where paper_id=p_source_paper_id and coalesce(is_active,true) order by');
      d := replace(d,'where pq.paper_id=p_source_paper_id and pq.section_id=v_section.id order by','where pq.paper_id=p_source_paper_id and pq.section_id=v_section.id and coalesce(pq.is_active,true) order by');

    elsif r.proname='get_live_student_analytics_v12' then
      d := replace(d,'join public.paper_questions paper_question on paper_question.paper_id = attempt.paper_id','join public.paper_questions paper_question on paper_question.id = any(coalesce(attempt.question_order,''{}''::uuid[]))');

    elsif r.proname='get_student_own_question_evidence_v12' then
      d := replace(d,'join public.paper_questions pq on pq.paper_id = a.paper_id','join public.paper_questions pq on pq.id = any(coalesce(a.question_order,''{}''::uuid[]))');

    elsif r.proname in ('get_student_reference_breakdowns_v13','get_student_reference_scoped_breakdowns_v13','get_student_reference_taxonomy_detail_v13') then
      d := replace(d,'join public.paper_questions paper_question on paper_question.paper_id=attempt.paper_id','join public.paper_questions paper_question on paper_question.id=any(coalesce(attempt.question_order,''{}''::uuid[]))');

    elsif r.proname='get_student_test_review_v12' then
      d := replace(d,'where paper_question.paper_id = p_paper_id;','where paper_question.id = any((select question_order from public.exam_attempts where id=v_attempt_id));');

    elsif r.proname='guard_and_refresh_paper_before_publish_v18' then
      d := replace(d,'where pq.paper_id=new.id;','where pq.paper_id=new.id and coalesce(pq.is_active,true);');
      d := replace(d,'where pq.paper_id=new.id and q.id=pq.question_id;','where pq.paper_id=new.id and coalesce(pq.is_active,true) and q.id=pq.question_id;');

    elsif r.proname='set_question_paper_pyq_identity_v18' then
      d := replace(d,'from public.paper_questions where paper_id=p_paper_id;','from public.paper_questions where paper_id=p_paper_id and coalesce(is_active,true);');

    elsif r.proname='start_benchmark_attempt' then
      d := replace(d,'from public.paper_questions where paper_id = v_paper.id;','from public.paper_questions where paper_id = v_paper.id and coalesce(is_active,true);');
    end if;

    execute d;
  end loop;
end
$patch$;
