-- Evidara V10 — Question Collection scope hardening
-- Run after 39e_v10_collection_paper_hardening.sql.

begin;

create or replace function public.question_collection_can_read_v13(p_collection public.question_collections)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select auth.uid() is not null and (
    public.question_collection_platform_admin_v13()
    or p_collection.owner_id=auth.uid()
    or (
      p_collection.organization_id is not null
      and public.question_collection_org_manager_v13(p_collection.organization_id)
    )
    or (p_collection.visibility='platform' and p_collection.status='active')
    or (
      p_collection.visibility='school'
      and p_collection.status='active'
      and public.question_collection_org_member_v13(p_collection.organization_id)
    )
  );
$$;

grant execute on function public.question_collection_can_read_v13(public.question_collections) to authenticated;

create or replace function public.clone_question_collection_v13(
  p_collection_id uuid,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_source public.question_collections;
  v_target_organization uuid;
  v_id uuid;
begin
  select * into v_source
  from public.question_collections
  where id=p_collection_id;

  if v_source.id is null
     or not public.question_collection_can_read_v13(v_source) then
    raise exception 'Collection not found or access denied.' using errcode='42501';
  end if;

  if v_source.organization_id is not null then
    if not public.question_collection_org_manager_v13(v_source.organization_id) then
      raise exception 'You cannot clone into this school.' using errcode='42501';
    end if;
    v_target_organization:=v_source.organization_id;
  elsif public.question_collection_platform_admin_v13() then
    v_target_organization:=null;
  else
    select member.organization_id
    into v_target_organization
    from public.organization_members member
    where member.user_id=auth.uid()
      and member.is_active=true
      and public.is_evidara_school_staff(member.organization_id)
    order by member.organization_id
    limit 1;

    if v_target_organization is null then
      raise exception 'Join a school staff workspace before cloning this platform collection.' using errcode='42501';
    end if;
  end if;

  insert into public.question_collections(
    organization_id,owner_id,name,description,exam_types,class_levels,
    subject_id,chapter_ids,topic_ids,difficulties,question_types,
    visibility,status,metadata
  ) values(
    v_target_organization,
    auth.uid(),
    coalesce(nullif(btrim(p_name),''),v_source.name||' Copy'),
    v_source.description,
    v_source.exam_types,
    v_source.class_levels,
    v_source.subject_id,
    v_source.chapter_ids,
    v_source.topic_ids,
    v_source.difficulties,
    v_source.question_types,
    'private',
    'draft',
    coalesce(v_source.metadata,'{}'::jsonb)
      || jsonb_build_object('cloned_from_collection_id',v_source.id)
  ) returning id into v_id;

  insert into public.question_collection_items(
    collection_id,question_id,display_order,note,added_by
  )
  select v_id,question_id,display_order,note,auth.uid()
  from public.question_collection_items
  where collection_id=p_collection_id;

  insert into public.audit_logs(
    actor_id,organization_id,action,entity_type,entity_id,metadata
  ) values(
    auth.uid(),
    v_target_organization,
    'questions.collection.cloned',
    'question_collection',
    v_id::text,
    jsonb_build_object(
      'source_collection_id',p_collection_id,
      'target_organization_id',v_target_organization
    )
  );

  return v_id;
end;
$$;

grant execute on function public.clone_question_collection_v13(uuid,text) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(
  null,
  'questions.collection.scope_hardening_ready',
  'system',
  '39f_v10_collection_scope_hardening',
  jsonb_build_object(
    'school_managers_read_drafts',true,
    'platform_clone_to_school_scope',true
  )
);

commit;
