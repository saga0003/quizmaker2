-- Phase 1 D5: immutable-attempt paper clone-as-new-version.

create or replace function public.clone_paper_as_new_version_v1(
  p_source_paper_id uuid,
  p_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_source public.question_papers%rowtype;
  v_new_id uuid := gen_random_uuid();
  v_root_id uuid;
  v_version integer;
  v_new_title text;
  v_section record;
  v_new_section_id uuid;
  v_attempt_count integer;
begin
  select * into v_source from public.question_papers where id=p_source_paper_id for share;
  if not found then
    raise exception 'Paper not found.' using errcode='22023';
  end if;
  if not public.can_manage_v8_papers(v_source.organization_id) then
    raise exception 'Paper-builder permission required.' using errcode='42501';
  end if;

  select count(*)::integer into v_attempt_count
  from public.exam_attempts where paper_id=p_source_paper_id;
  if v_attempt_count < 1 then
    raise exception 'Clone-as-new-version is intended for a paper that already has student attempts.' using errcode='22023';
  end if;

  v_root_id := coalesce(nullif(v_source.settings #>> '{version_lineage,root_paper_id}','')::uuid,p_source_paper_id);
  perform pg_advisory_xact_lock(hashtextextended(v_root_id::text,0));

  select greatest(
    1,
    coalesce(max(case
      when nullif(settings #>> '{version_lineage,root_paper_id}','')=v_root_id::text
      then nullif(settings #>> '{version_lineage,version_number}','')::integer
      else null
    end),1)
  ) + 1
  into v_version
  from public.question_papers
  where id=v_root_id
     or nullif(settings #>> '{version_lineage,root_paper_id}','')=v_root_id::text;

  v_new_title := coalesce(nullif(btrim(p_title),''), format('%s · v%s',v_source.title,v_version));

  insert into public.question_papers(
    id,organization_id,created_by,updated_by,title,code,description,exam_type,status,
    duration_minutes,instructions,access_mode,access_code,available_from,available_until,
    attempt_limit,shuffle_questions,shuffle_options,result_mode,total_marks,total_questions,
    settings,published_at,access_label,subscription_required,board,grade_min,grade_max,
    required_track,source_year,is_previous_year_paper,grade_level,test_type,custom_test_type,
    open_forever,review_requested_at,approved_by,approved_at,rejected_by,rejected_at,
    rejection_reason,analytics_blueprint,percentile_cohort_key,percentile_eligible,
    seo_slug,seo_title,seo_description,paper_origin,pyq_source_paper_id,source_variant,source_paper_code
  ) values (
    v_new_id,v_source.organization_id,auth.uid(),auth.uid(),v_new_title,null,v_source.description,
    v_source.exam_type,'draft',v_source.duration_minutes,v_source.instructions,v_source.access_mode,
    null,null,null,v_source.attempt_limit,v_source.shuffle_questions,v_source.shuffle_options,
    v_source.result_mode,v_source.total_marks,v_source.total_questions,
    (coalesce(v_source.settings,'{}'::jsonb) - 'assignment' - 'assigned_student_count' - 'demo_batch_id') ||
      jsonb_build_object('version_lineage',jsonb_build_object(
        'root_paper_id',v_root_id,'source_paper_id',p_source_paper_id,
        'version_number',v_version,'cloned_at',now(),'cloned_by',auth.uid()
      )),
    null,v_source.access_label,v_source.subscription_required,v_source.board,v_source.grade_min,
    v_source.grade_max,v_source.required_track,v_source.source_year,v_source.is_previous_year_paper,
    v_source.grade_level,v_source.test_type,v_source.custom_test_type,false,null,null,null,null,null,
    null,v_source.analytics_blueprint,null,v_source.percentile_eligible,null,null,null,
    case when v_source.paper_origin='pyq' then 'manual' else v_source.paper_origin end,
    v_source.pyq_source_paper_id,v_source.source_variant,v_source.source_paper_code
  );

  for v_section in
    select * from public.paper_sections where paper_id=p_source_paper_id order by display_order,id
  loop
    v_new_section_id := gen_random_uuid();
    insert into public.paper_sections(
      id,paper_id,title,subject_id,instructions,questions_to_attempt,display_order,subject_key,
      biology_division,selection_mode,question_target,difficulty_distribution,chapter_ids,topic_ids
    ) values (
      v_new_section_id,v_new_id,v_section.title,v_section.subject_id,v_section.instructions,
      v_section.questions_to_attempt,v_section.display_order,v_section.subject_key,
      v_section.biology_division,v_section.selection_mode,v_section.question_target,
      v_section.difficulty_distribution,v_section.chapter_ids,v_section.topic_ids
    );

    insert into public.paper_questions(
      paper_id,section_id,question_id,display_order,marks,negative_marks,is_mandatory,question_snapshot
    )
    select v_new_id,v_new_section_id,pq.question_id,pq.display_order,pq.marks,pq.negative_marks,
      pq.is_mandatory,pq.question_snapshot
    from public.paper_questions pq
    where pq.paper_id=p_source_paper_id and pq.section_id=v_section.id
    order by pq.display_order,pq.id;
  end loop;

  insert into public.audit_logs(actor_id,organization_id,action,entity_type,entity_id,metadata)
  values(auth.uid(),v_source.organization_id,'paper.version.cloned','question_paper',v_new_id::text,
    jsonb_build_object('source_paper_id',p_source_paper_id,'root_paper_id',v_root_id,
      'version_number',v_version,'source_attempt_count',v_attempt_count));

  return jsonb_build_object(
    'paper_id',v_new_id,'source_paper_id',p_source_paper_id,'root_paper_id',v_root_id,
    'version_number',v_version,'status','draft','title',v_new_title
  );
end;
$function$;

revoke all on function public.clone_paper_as_new_version_v1(uuid,text) from public, anon;
grant execute on function public.clone_paper_as_new_version_v1(uuid,text) to authenticated, service_role;

comment on function public.clone_paper_as_new_version_v1(uuid,text) is
  'D5 transactional clone for attempt-bearing papers. Creates a fresh draft with copied sections/questions and immutable version lineage; publication and audience state are deliberately not copied.';
