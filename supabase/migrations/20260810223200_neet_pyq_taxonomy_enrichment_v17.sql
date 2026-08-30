create or replace function public.enrich_neet_pyq_taxonomy_v17(p_rows jsonb, p_actor uuid)
returns jsonb language plpgsql security definer set search_path to 'public','auth' as $$
declare r jsonb; qid uuid; sid uuid; cid uuid; tid uuid; ch text; tp text; st text; cf numeric; legacy boolean; updated_n int:=0; review_n int:=0;
begin
 if coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role' and current_user not in ('postgres','service_role') then raise exception 'Server authorization is required.' using errcode='42501'; end if;
 if p_actor is null then raise exception 'Actor is required.' using errcode='22023'; end if;
 for r in select value from jsonb_array_elements(coalesce(p_rows,'[]'::jsonb)) loop
  select q.id,q.subject_id into qid,sid from public.question_staging q where q.source_key=r->>'source_key' and q.source_record_id=r->>'source_record_id';
  if qid is null then continue; end if;
  sid:=coalesce(nullif(r->>'subject_id','')::uuid,sid);
  ch:=nullif(r->>'source_chapter',''); tp:=nullif(r->>'source_topic',''); st:=coalesce(nullif(r->>'mapping_status',''),'taxonomy_review_required'); cf:=greatest(0,least(1,coalesce(nullif(r->>'mapping_confidence','')::numeric,0))); cid:=null; tid:=null;
  if sid is not null and ch is not null and ch<>'Unmapped' and st<>'taxonomy_review_required' then
   select c.id into cid from public.chapters c where c.organization_id is null and c.subject_id=sid and c.is_active and lower(c.name)=lower(ch) order by c.created_at limit 1;
   if cid is null then st:='taxonomy_review_required'; cf:=least(cf,.49); else
    if tp is not null then select t.id into tid from public.topics t where t.organization_id is null and t.chapter_id=cid and t.is_active and lower(t.name)=lower(tp) order by t.created_at limit 1; end if;
    if tid is null then select t.id into tid from public.topics t where t.organization_id is null and t.chapter_id=cid and t.is_active and lower(t.name)=lower('General / Mixed Concepts') order by t.created_at limit 1; if tid is not null then tp:='General / Mixed Concepts'; st:='taxonomy_mapped_general_topic'; end if; end if;
   end if;
  end if;
  legacy:=coalesce((r->>'source_out_of_syllabus_flag')::boolean,false) or coalesce(ch,'') like '%(Legacy PYQ)%';
  update public.question_staging set
   source_subject=coalesce(nullif(r->>'source_subject',''),source_subject), source_subject_slug=coalesce(nullif(r->>'source_subject_slug',''),source_subject_slug),
   source_chapter=coalesce(ch,'Unmapped'), source_chapter_slug=coalesce(nullif(r->>'source_chapter_slug',''),source_chapter_slug), source_topic=tp,
   source_out_of_syllabus_flag=legacy, official_exam='NEET', official_syllabus_code=case when legacy then 'NEET-PYQ-LEGACY' else 'NEET-UG-CURRENT' end, official_unit=case when cid is not null then ch else null end,
   mapping_status=st,mapping_confidence=cf,subject_id=sid,chapter_id=cid,topic_id=tid,
   mapped_question_type=coalesce(nullif(r->>'mapped_question_type',''),mapped_question_type),difficulty_estimate=coalesce(nullif(r->>'difficulty_estimate',''),difficulty_estimate),difficulty_status='auto_estimated',
   review_priority=case when cid is null or source_flag is not null then 90 else 65 end,
   review_note=case when cid is null then 'Taxonomy mapping needs review before promotion. Candidate: '||coalesce(ch,'Unmapped')||case when tp is not null then ' / '||tp else '' end when tp='General / Mixed Concepts' then 'Chapter mapped; broad topic fallback may be refined during review.' else 'Taxonomy mapped automatically from question, options and solution. Verify during normal review.' end,
   answer_evidence=coalesce(answer_evidence,'{}'::jsonb)||jsonb_build_object('taxonomy_candidate_chapter',r->>'taxonomy_candidate_chapter','taxonomy_candidate_topic',r->>'taxonomy_candidate_topic','chapter_confidence',r->>'taxonomy_chapter_confidence','topic_confidence',r->>'taxonomy_topic_confidence','biology_division',r->>'biology_division'),
   updated_by=p_actor,updated_at=now()
  where id=qid;
  updated_n:=updated_n+1; if cid is null then review_n:=review_n+1; end if;
 end loop;
 return jsonb_build_object('updated',updated_n,'taxonomy_review_required',review_n,'taxonomy_mapped',updated_n-review_n);
end $$;
revoke all on function public.enrich_neet_pyq_taxonomy_v17(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.enrich_neet_pyq_taxonomy_v17(jsonb,uuid) to service_role;
