create or replace function public.set_question_paper_pyq_identity_v18(
  p_paper_id uuid,
  p_is_pyq boolean,
  p_year integer default null,
  p_variant text default null,
  p_paper_code text default null
)
returns jsonb
language plpgsql security definer
set search_path=public,auth
as $$
declare
  v_user uuid := auth.uid();
  v_paper public.question_papers%rowtype;
  v_source uuid;
  v_key text;
  v_label text;
  v_count integer;
  rec record;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  if not public.is_evidara_platform_admin() then raise exception 'Evidara Admin or Super Admin access required.' using errcode='42501'; end if;
  select * into v_paper from public.question_papers where id=p_paper_id and organization_id is null for update;
  if not found then raise exception 'Platform paper not found.'; end if;
  if exists(select 1 from public.exam_attempts where paper_id=p_paper_id) then
    raise exception 'This paper already has attempts. Create a new version before changing PYQ identity.';
  end if;
  if not coalesce(p_is_pyq,false) then
    update public.question_papers set is_previous_year_paper=false,source_year=null,source_variant=null,source_paper_code=null,
      pyq_source_paper_id=null,paper_origin=case when paper_origin='pyq_generated' then 'manual' else paper_origin end,updated_by=v_user,updated_at=now()
    where id=p_paper_id;
    return jsonb_build_object('paper_id',p_paper_id,'is_previous_year_paper',false);
  end if;
  if p_year is null or p_year<1990 or p_year>2100 then raise exception 'Choose a valid PYQ year.'; end if;
  select count(*) into v_count from public.paper_questions where paper_id=p_paper_id;
  v_key:=public.v18_slugify(concat_ws('-',v_paper.exam_type,p_year,coalesce(nullif(btrim(p_variant),''),'Main'),nullif(btrim(p_paper_code),'')));
  v_label:=case when lower(coalesce(p_variant,'')) in ('re-neet','reneet','re neet') then concat('Re-NEET ',p_year) else concat(v_paper.exam_type,' ',p_year,case when coalesce(nullif(btrim(p_variant),''),'Main')='Main' then '' else ' '||btrim(p_variant) end) end;
  v_source:=public.upsert_pyq_source_paper_service_v18(jsonb_build_object(
    'exam_type',v_paper.exam_type,'year',p_year,'variant',coalesce(nullif(btrim(p_variant),''),'Main'),'paper_code',nullif(btrim(p_paper_code),''),
    'paper_key',v_key,'display_name',v_label,'expected_question_count',v_count,'duration_minutes',v_paper.duration_minutes,
    'maximum_marks',v_paper.total_marks,'metadata',jsonb_build_object('manual_paper_id',p_paper_id)
  ),v_user);
  update public.question_papers set is_previous_year_paper=true,source_year=p_year,source_variant=coalesce(nullif(btrim(p_variant),''),'Main'),
    source_paper_code=nullif(btrim(p_paper_code),''),pyq_source_paper_id=v_source,
    settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object('pyq_source_paper_id',v_source,'paper_key',v_key),updated_by=v_user,updated_at=now()
  where id=p_paper_id;
  for rec in select pq.question_id,pq.display_order,q.subject_id from public.paper_questions pq join public.questions q on q.id=pq.question_id where pq.paper_id=p_paper_id order by pq.display_order loop
    insert into public.question_pyq_occurrences(question_id,source_paper_id,source_question_number,subject_label,metadata,created_by)
    values(rec.question_id,v_source,rec.display_order+1,(select name from public.subjects where id=rec.subject_id),jsonb_build_object('linked_from_manual_paper',p_paper_id),v_user)
    on conflict(source_paper_id,source_question_number) do update set question_id=excluded.question_id,subject_label=excluded.subject_label,
      metadata=public.question_pyq_occurrences.metadata||excluded.metadata,updated_at=now();
  end loop;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(v_user,'paper.pyq_identity.updated','question_paper',p_paper_id::text,
    jsonb_build_object('source_paper_id',v_source,'year',p_year,'variant',p_variant,'paper_code',p_paper_code,'question_count',v_count));
  return jsonb_build_object('paper_id',p_paper_id,'is_previous_year_paper',true,'source_paper_id',v_source,'question_count',v_count,'display_name',v_label);
end $$;
revoke all on function public.set_question_paper_pyq_identity_v18(uuid,boolean,integer,text,text) from public,anon;
grant execute on function public.set_question_paper_pyq_identity_v18(uuid,boolean,integer,text,text) to authenticated,service_role;
