-- Evidara V10 — reference analytics UI and reusable Question Collections
-- Run after 38b_v10_analytics_phase_4_hardening.sql.

begin;

create table if not exists public.question_collections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade default auth.uid(),
  name text not null,
  description text,
  exam_types text[] not null default '{}',
  class_levels text[] not null default '{}',
  subject_id uuid references public.subjects(id) on delete set null,
  chapter_ids uuid[] not null default '{}',
  topic_ids uuid[] not null default '{}',
  difficulties text[] not null default '{}',
  question_types text[] not null default '{}',
  visibility text not null default 'private' check (visibility in ('private','school','platform')),
  status text not null default 'draft' check (status in ('draft','active','archived')),
  linked_paper_id uuid references public.question_papers(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(name)) between 3 and 160),
  check (visibility <> 'school' or organization_id is not null),
  check (visibility <> 'platform' or organization_id is null)
);

create table if not exists public.question_collection_items (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.question_collections(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  display_order integer not null default 0 check (display_order >= 0),
  note text,
  added_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique(collection_id,question_id)
);

create table if not exists public.student_analytics_goals (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  subject_name text,
  chapter_id uuid references public.chapters(id) on delete set null,
  topic_id uuid references public.topics(id) on delete set null,
  title text not null,
  metric text not null default 'percentage' check (metric in ('percentage','accuracy','time_score','tests_completed')),
  target_value numeric not null,
  current_value numeric,
  due_date date,
  status text not null default 'active' check (status in ('active','completed','paused','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(title)) between 3 and 180)
);

create index if not exists question_collections_scope_idx
  on public.question_collections(organization_id,status,visibility,updated_at desc);
create index if not exists question_collection_items_order_idx
  on public.question_collection_items(collection_id,display_order);
create index if not exists question_collection_items_question_idx
  on public.question_collection_items(question_id);
create index if not exists student_analytics_goals_student_idx
  on public.student_analytics_goals(student_id,status,due_date);

alter table public.question_collections enable row level security;
alter table public.question_collection_items enable row level security;
alter table public.student_analytics_goals enable row level security;

create or replace function public.question_collection_platform_admin_v13()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_evidara_platform_admin();
$$;

create or replace function public.question_collection_org_member_v13(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select p_organization_id is not null and public.is_org_member(p_organization_id);
$$;

create or replace function public.question_collection_org_manager_v13(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_evidara_platform_admin()
    or (p_organization_id is not null and public.is_evidara_school_staff(p_organization_id));
$$;

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
    or (p_collection.visibility='platform' and p_collection.status='active')
    or (
      p_collection.visibility='school'
      and p_collection.status='active'
      and public.question_collection_org_member_v13(p_collection.organization_id)
    )
  );
$$;

create or replace function public.question_collection_can_manage_v13(p_collection public.question_collections)
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
  );
$$;

revoke all on function public.question_collection_platform_admin_v13() from public;
revoke all on function public.question_collection_org_member_v13(uuid) from public;
revoke all on function public.question_collection_org_manager_v13(uuid) from public;
revoke all on function public.question_collection_can_read_v13(public.question_collections) from public;
revoke all on function public.question_collection_can_manage_v13(public.question_collections) from public;
grant execute on function public.question_collection_platform_admin_v13() to authenticated;
grant execute on function public.question_collection_org_member_v13(uuid) to authenticated;
grant execute on function public.question_collection_org_manager_v13(uuid) to authenticated;
grant execute on function public.question_collection_can_read_v13(public.question_collections) to authenticated;
grant execute on function public.question_collection_can_manage_v13(public.question_collections) to authenticated;

drop policy if exists question_collections_read_v13 on public.question_collections;
create policy question_collections_read_v13
on public.question_collections for select to authenticated
using (public.question_collection_can_read_v13(question_collections));

drop policy if exists question_collection_items_read_v13 on public.question_collection_items;
create policy question_collection_items_read_v13
on public.question_collection_items for select to authenticated
using (
  exists(
    select 1
    from public.question_collections collection
    where collection.id=collection_id
      and public.question_collection_can_read_v13(collection)
  )
);

drop policy if exists student_analytics_goals_read_v13 on public.student_analytics_goals;
create policy student_analytics_goals_read_v13
on public.student_analytics_goals for select to authenticated
using (student_id=auth.uid() or public.analytics_can_view_student_v10(student_id));

revoke insert,update,delete on public.question_collections from authenticated;
revoke insert,update,delete on public.question_collection_items from authenticated;
revoke insert,update,delete on public.student_analytics_goals from authenticated;
grant select on public.question_collections,public.question_collection_items,public.student_analytics_goals to authenticated;

create or replace function public.list_question_collections_v13(p_organization_id uuid default null)
returns jsonb
language sql
stable
security definer
set search_path=public
as $$
  select jsonb_build_object(
    'collections',coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id',collection.id,
          'organization_id',collection.organization_id,
          'owner_id',collection.owner_id,
          'name',collection.name,
          'description',collection.description,
          'exam_types',collection.exam_types,
          'class_levels',collection.class_levels,
          'subject_id',collection.subject_id,
          'chapter_ids',collection.chapter_ids,
          'topic_ids',collection.topic_ids,
          'difficulties',collection.difficulties,
          'question_types',collection.question_types,
          'visibility',collection.visibility,
          'status',collection.status,
          'linked_paper_id',collection.linked_paper_id,
          'metadata',collection.metadata,
          'created_at',collection.created_at,
          'updated_at',collection.updated_at,
          'question_count',(
            select count(*)
            from public.question_collection_items item
            where item.collection_id=collection.id
          ),
          'total_marks',(
            select coalesce(sum(question.marks),0)
            from public.question_collection_items item
            join public.questions question on question.id=item.question_id
            where item.collection_id=collection.id
          ),
          'subjects',(
            select coalesce(
              jsonb_agg(distinct coalesce(subject.name,'Unassigned')),
              '[]'::jsonb
            )
            from public.question_collection_items item
            join public.questions question on question.id=item.question_id
            left join public.subjects subject on subject.id=question.subject_id
            where item.collection_id=collection.id
          ),
          'can_manage',public.question_collection_can_manage_v13(collection)
        )
        order by collection.updated_at desc
      ) filter(where collection.id is not null),
      '[]'::jsonb
    ),
    'generated_at',now()
  )
  from public.question_collections collection
  where public.question_collection_can_read_v13(collection)
    and (
      p_organization_id is null
      or collection.organization_id=p_organization_id
      or collection.organization_id is null
    );
$$;

grant execute on function public.list_question_collections_v13(uuid) to authenticated;

create or replace function public.get_question_collection_v13(p_collection_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_collection public.question_collections;
  v_items jsonb;
begin
  select * into v_collection
  from public.question_collections
  where id=p_collection_id;

  if v_collection.id is null then
    raise exception 'Question collection not found.';
  end if;
  if not public.question_collection_can_read_v13(v_collection) then
    raise exception 'You do not have access to this question collection.' using errcode='42501';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',item.id,
        'question_id',item.question_id,
        'display_order',item.display_order,
        'note',item.note,
        'stem_text',question.stem_text,
        'question_type',question.question_type,
        'difficulty',question.difficulty,
        'marks',question.marks,
        'negative_marks',question.negative_marks,
        'class_level',question.class_level,
        'exam_types',question.exam_types,
        'status',question.status,
        'subject_id',question.subject_id,
        'subject_name',subject.name,
        'chapter_id',question.chapter_id,
        'chapter_name',chapter.name,
        'topic_id',question.topic_id,
        'topic_name',topic.name,
        'tags',question.tags
      )
      order by item.display_order
    ),
    '[]'::jsonb
  ) into v_items
  from public.question_collection_items item
  join public.questions question on question.id=item.question_id
  left join public.subjects subject on subject.id=question.subject_id
  left join public.chapters chapter on chapter.id=question.chapter_id
  left join public.topics topic on topic.id=question.topic_id
  where item.collection_id=p_collection_id;

  return to_jsonb(v_collection)
    || jsonb_build_object(
      'items',v_items,
      'can_manage',public.question_collection_can_manage_v13(v_collection)
    );
end;
$$;

grant execute on function public.get_question_collection_v13(uuid) to authenticated;

create or replace function public.save_question_collection_v13(
  p_collection_id uuid,
  p_organization_id uuid,
  p_payload jsonb,
  p_question_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_id uuid;
  v_existing public.question_collections;
  v_visibility text;
  v_status text;
  v_question uuid;
  v_order integer:=0;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;

  v_visibility:=coalesce(
    p_payload->>'visibility',
    case when p_organization_id is null then 'private' else 'school' end
  );
  v_status:=coalesce(p_payload->>'status','draft');

  if v_visibility not in ('private','school','platform') then
    raise exception 'Invalid collection visibility.';
  end if;
  if v_status not in ('draft','active','archived') then
    raise exception 'Invalid collection status.';
  end if;
  if v_visibility='school' and p_organization_id is null then
    raise exception 'Choose a school for school visibility.';
  end if;
  if v_visibility='platform' and not public.question_collection_platform_admin_v13() then
    raise exception 'Only Evidara Admin or Super Admin can publish platform collections.' using errcode='42501';
  end if;
  if p_organization_id is not null and not public.question_collection_org_manager_v13(p_organization_id) then
    raise exception 'You cannot manage collections for this school.' using errcode='42501';
  end if;
  if p_organization_id is null
     and not public.question_collection_platform_admin_v13()
     and v_visibility<>'private' then
    raise exception 'Platform collection access required.' using errcode='42501';
  end if;
  if length(btrim(coalesce(p_payload->>'name','')))<3 then
    raise exception 'Collection name is required.';
  end if;

  if p_collection_id is null then
    insert into public.question_collections(
      organization_id,owner_id,name,description,exam_types,class_levels,
      subject_id,chapter_ids,topic_ids,difficulties,question_types,
      visibility,status,metadata
    ) values(
      case when v_visibility='platform' then null else p_organization_id end,
      auth.uid(),
      btrim(p_payload->>'name'),
      nullif(btrim(coalesce(p_payload->>'description','')),''),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'exam_types','[]'::jsonb))),'{}'::text[]),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'class_levels','[]'::jsonb))),'{}'::text[]),
      nullif(p_payload->>'subject_id','')::uuid,
      coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'chapter_ids','[]'::jsonb)) value),'{}'::uuid[]),
      coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'topic_ids','[]'::jsonb)) value),'{}'::uuid[]),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'difficulties','[]'::jsonb))),'{}'::text[]),
      coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'question_types','[]'::jsonb))),'{}'::text[]),
      v_visibility,
      v_status,
      coalesce(p_payload->'metadata','{}'::jsonb)
    ) returning id into v_id;
  else
    select * into v_existing
    from public.question_collections
    where id=p_collection_id;

    if v_existing.id is null then raise exception 'Collection not found.'; end if;
    if not public.question_collection_can_manage_v13(v_existing) then
      raise exception 'You cannot edit this collection.' using errcode='42501';
    end if;

    update public.question_collections set
      organization_id=case when v_visibility='platform' then null else p_organization_id end,
      name=btrim(p_payload->>'name'),
      description=nullif(btrim(coalesce(p_payload->>'description','')),''),
      exam_types=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'exam_types','[]'::jsonb))),'{}'::text[]),
      class_levels=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'class_levels','[]'::jsonb))),'{}'::text[]),
      subject_id=nullif(p_payload->>'subject_id','')::uuid,
      chapter_ids=coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'chapter_ids','[]'::jsonb)) value),'{}'::uuid[]),
      topic_ids=coalesce(array(select value::uuid from jsonb_array_elements_text(coalesce(p_payload->'topic_ids','[]'::jsonb)) value),'{}'::uuid[]),
      difficulties=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'difficulties','[]'::jsonb))),'{}'::text[]),
      question_types=coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'question_types','[]'::jsonb))),'{}'::text[]),
      visibility=v_visibility,
      status=v_status,
      metadata=coalesce(p_payload->'metadata','{}'::jsonb),
      updated_at=now()
    where id=p_collection_id
    returning id into v_id;

    delete from public.question_collection_items where collection_id=v_id;
  end if;

  foreach v_question in array coalesce(p_question_ids,'{}'::uuid[]) loop
    if exists(
      select 1
      from public.questions question
      where question.id=v_question and question.status='approved'
    ) then
      insert into public.question_collection_items(
        collection_id,question_id,display_order,added_by
      ) values(
        v_id,v_question,v_order,auth.uid()
      )
      on conflict(collection_id,question_id)
      do update set display_order=excluded.display_order;
      v_order:=v_order+1;
    end if;
  end loop;

  insert into public.audit_logs(
    actor_id,organization_id,action,entity_type,entity_id,metadata
  ) values(
    auth.uid(),p_organization_id,'questions.collection.saved',
    'question_collection',v_id::text,
    jsonb_build_object(
      'questions',v_order,
      'visibility',v_visibility,
      'status',v_status
    )
  );

  return v_id;
end;
$$;

grant execute on function public.save_question_collection_v13(uuid,uuid,jsonb,uuid[]) to authenticated;

create or replace function public.archive_question_collection_v13(p_collection_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_collection public.question_collections;
begin
  select * into v_collection
  from public.question_collections
  where id=p_collection_id;

  if v_collection.id is null
     or not public.question_collection_can_manage_v13(v_collection) then
    raise exception 'Collection not found or access denied.' using errcode='42501';
  end if;

  update public.question_collections
  set status='archived',updated_at=now()
  where id=p_collection_id;
end;
$$;

grant execute on function public.archive_question_collection_v13(uuid) to authenticated;

create or replace function public.delete_question_collection_v13(p_collection_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_collection public.question_collections;
begin
  select * into v_collection
  from public.question_collections
  where id=p_collection_id;

  if v_collection.id is null
     or not public.question_collection_can_manage_v13(v_collection) then
    raise exception 'Collection not found or access denied.' using errcode='42501';
  end if;

  delete from public.question_collections where id=p_collection_id;
end;
$$;

grant execute on function public.delete_question_collection_v13(uuid) to authenticated;

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
  v_id uuid;
begin
  select * into v_source
  from public.question_collections
  where id=p_collection_id;

  if v_source.id is null
     or not public.question_collection_can_read_v13(v_source) then
    raise exception 'Collection not found or access denied.' using errcode='42501';
  end if;
  if v_source.organization_id is not null
     and not public.question_collection_org_manager_v13(v_source.organization_id) then
    raise exception 'You cannot clone into this school.' using errcode='42501';
  end if;

  insert into public.question_collections(
    organization_id,owner_id,name,description,exam_types,class_levels,
    subject_id,chapter_ids,topic_ids,difficulties,question_types,
    visibility,status,metadata
  ) values(
    v_source.organization_id,
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
    v_source.metadata
  ) returning id into v_id;

  insert into public.question_collection_items(
    collection_id,question_id,display_order,note,added_by
  )
  select v_id,question_id,display_order,note,auth.uid()
  from public.question_collection_items
  where collection_id=p_collection_id;

  return v_id;
end;
$$;

grant execute on function public.clone_question_collection_v13(uuid,text) to authenticated;

create or replace function public.create_paper_from_question_collection_v13(
  p_collection_id uuid,
  p_title text default null,
  p_duration_minutes integer default 60
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_collection public.question_collections;
  v_sections jsonb;
  v_questions jsonb;
  v_payload jsonb;
  v_paper uuid;
begin
  select * into v_collection
  from public.question_collections
  where id=p_collection_id;

  if v_collection.id is null
     or not public.question_collection_can_manage_v13(v_collection) then
    raise exception 'You cannot create a paper from this collection.' using errcode='42501';
  end if;
  if not exists(
    select 1
    from public.question_collection_items
    where collection_id=p_collection_id
  ) then
    raise exception 'Add at least one question before creating a paper.';
  end if;

  with grouped as (
    select
      coalesce(question.subject_id::text,'general') as client_id,
      question.subject_id,
      coalesce(subject.name,'General') as subject_name,
      count(*)::integer as question_count,
      coalesce(
        array_agg(distinct question.chapter_id) filter(where question.chapter_id is not null),
        '{}'::uuid[]
      ) as chapter_ids,
      coalesce(
        array_agg(distinct question.topic_id) filter(where question.topic_id is not null),
        '{}'::uuid[]
      ) as topic_ids,
      min(item.display_order) as first_order
    from public.question_collection_items item
    join public.questions question on question.id=item.question_id
    left join public.subjects subject on subject.id=question.subject_id
    where item.collection_id=p_collection_id
    group by question.subject_id,subject.name
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'client_id',grouped.client_id,
        'title',grouped.subject_name,
        'subject_id',grouped.subject_id,
        'subject_key',grouped.subject_name,
        'biology_division','combined',
        'selection_mode','manual',
        'question_target',grouped.question_count,
        'difficulty_distribution',jsonb_build_object(
          'very_easy',0,'easy',0,'moderate',0,'difficult',0,'very_difficult',0
        ),
        'chapter_ids',to_jsonb(grouped.chapter_ids),
        'topic_ids',to_jsonb(grouped.topic_ids),
        'display_order',row_number() over(order by grouped.first_order)-1
      )
      order by grouped.first_order
    ),
    '[]'::jsonb
  ) into v_sections
  from grouped;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'question_id',question.id,
        'section_client_id',coalesce(question.subject_id::text,'general'),
        'display_order',item.display_order,
        'marks',question.marks,
        'negative_marks',question.negative_marks,
        'is_mandatory',true
      )
      order by item.display_order
    ),
    '[]'::jsonb
  ) into v_questions
  from public.question_collection_items item
  join public.questions question on question.id=item.question_id
  where item.collection_id=p_collection_id;

  v_payload:=jsonb_build_object(
    'title',coalesce(nullif(btrim(p_title),''),v_collection.name||' Paper'),
    'code','COL-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
    'description',v_collection.description,
    'exam_type',coalesce(v_collection.exam_types[1],'Custom'),
    'grade_level',coalesce(v_collection.class_levels[1],'Grade 11'),
    'test_type','custom_test',
    'custom_test_type','Question collection',
    'status','draft',
    'duration_minutes',greatest(1,least(coalesce(p_duration_minutes,60),600)),
    'instructions','Created from reusable Question Collection: '||v_collection.name,
    'open_forever',true,
    'attempt_limit',1,
    'shuffle_questions',false,
    'shuffle_options',false,
    'result_mode','score_only',
    'settings',jsonb_build_object(
      'builder_version','v8',
      'source_collection_id',v_collection.id,
      'default_selection_mode','manual'
    ),
    'sections',v_sections,
    'questions',v_questions
  );

  v_paper:=public.save_question_paper(
    null,
    v_collection.organization_id,
    v_payload
  );

  update public.question_collections
  set linked_paper_id=v_paper,updated_at=now()
  where id=p_collection_id;

  insert into public.audit_logs(
    actor_id,organization_id,action,entity_type,entity_id,metadata
  ) values(
    auth.uid(),v_collection.organization_id,
    'questions.collection.paper_created','question_paper',v_paper::text,
    jsonb_build_object('collection_id',p_collection_id)
  );

  return v_paper;
end;
$$;

grant execute on function public.create_paper_from_question_collection_v13(uuid,text,integer) to authenticated;

create or replace function public.upsert_student_analytics_goal_v13(
  p_goal_id uuid,
  p_student_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_student uuid:=coalesce(p_student_id,auth.uid());
  v_id uuid;
  v_metric text;
  v_status text;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if v_student<>auth.uid()
     and not public.analytics_can_view_student_v10(v_student) then
    raise exception 'You cannot manage this goal.' using errcode='42501';
  end if;

  v_metric:=coalesce(p_payload->>'metric','percentage');
  v_status:=coalesce(p_payload->>'status','active');

  if v_metric not in ('percentage','accuracy','time_score','tests_completed') then
    raise exception 'Invalid goal metric.';
  end if;
  if v_status not in ('active','completed','paused','cancelled') then
    raise exception 'Invalid goal status.';
  end if;
  if length(btrim(coalesce(p_payload->>'title','')))<3 then
    raise exception 'Goal title is required.';
  end if;
  if nullif(p_payload->>'target_value','')::numeric is null then
    raise exception 'Goal target is required.';
  end if;

  if p_goal_id is null then
    insert into public.student_analytics_goals(
      student_id,product_id,subject_name,chapter_id,topic_id,title,
      metric,target_value,current_value,due_date,status,notes
    ) values(
      v_student,
      nullif(p_payload->>'product_id','')::uuid,
      nullif(btrim(coalesce(p_payload->>'subject_name','')),''),
      nullif(p_payload->>'chapter_id','')::uuid,
      nullif(p_payload->>'topic_id','')::uuid,
      btrim(p_payload->>'title'),
      v_metric,
      (p_payload->>'target_value')::numeric,
      nullif(p_payload->>'current_value','')::numeric,
      nullif(p_payload->>'due_date','')::date,
      v_status,
      nullif(btrim(coalesce(p_payload->>'notes','')),'')
    ) returning id into v_id;
  else
    update public.student_analytics_goals set
      product_id=nullif(p_payload->>'product_id','')::uuid,
      subject_name=nullif(btrim(coalesce(p_payload->>'subject_name','')),''),
      chapter_id=nullif(p_payload->>'chapter_id','')::uuid,
      topic_id=nullif(p_payload->>'topic_id','')::uuid,
      title=btrim(p_payload->>'title'),
      metric=v_metric,
      target_value=(p_payload->>'target_value')::numeric,
      current_value=nullif(p_payload->>'current_value','')::numeric,
      due_date=nullif(p_payload->>'due_date','')::date,
      status=v_status,
      notes=nullif(btrim(coalesce(p_payload->>'notes','')),''),
      updated_at=now()
    where id=p_goal_id and student_id=v_student
    returning id into v_id;

    if v_id is null then raise exception 'Goal not found.'; end if;
  end if;

  return v_id;
end;
$$;

grant execute on function public.upsert_student_analytics_goal_v13(uuid,uuid,jsonb) to authenticated;

create or replace function public.delete_student_analytics_goal_v13(
  p_goal_id uuid,
  p_student_id uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare v_student uuid:=coalesce(p_student_id,auth.uid());
begin
  if v_student<>auth.uid()
     and not public.analytics_can_view_student_v10(v_student) then
    raise exception 'You cannot delete this goal.' using errcode='42501';
  end if;

  delete from public.student_analytics_goals
  where id=p_goal_id and student_id=v_student;
end;
$$;

grant execute on function public.delete_student_analytics_goal_v13(uuid,uuid) to authenticated;

create or replace function public.get_student_reference_breakdowns_v13(
  p_student_id uuid default auth.uid(),
  p_product_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare v_student uuid:=coalesce(p_student_id,auth.uid());
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.analytics_can_view_student_v10(v_student) then
    raise exception 'You do not have access to this student analytics evidence.' using errcode='42501';
  end if;

  return (
    with selected_papers as (
      select distinct paper.id
      from public.question_papers paper
      left join public.product_papers product_paper on product_paper.paper_id=paper.id
      where p_product_id is null or product_paper.product_id=p_product_id
    ), latest_attempts as (
      select
        attempt.*,
        row_number() over(
          partition by attempt.paper_id
          order by attempt.submitted_at desc nulls last,
                   attempt.created_at desc,
                   attempt.id desc
        ) rn
      from public.exam_attempts attempt
      join selected_papers selected on selected.id=attempt.paper_id
      where attempt.student_id=v_student and attempt.status='submitted'
    ), evidence as (
      select
        response.*,
        attempt.paper_id,
        paper_question.question_id,
        paper_question.marks maximum_marks,
        coalesce(question.subject_id,paper_section.subject_id) subject_id,
        coalesce(subject.name,paper_section.subject_key,paper_section.title,'General') subject_name,
        question.chapter_id,
        chapter.name chapter_name,
        question.topic_id,
        topic.name topic_name,
        coalesce(question.difficulty::text,paper_question.question_snapshot->>'difficulty','moderate') difficulty,
        coalesce(question.question_type::text,paper_question.question_snapshot->>'question_type','single_correct') question_type,
        coalesce(question.tags,'{}'::text[]) tags,
        coalesce(response.time_spent_seconds,0) time_spent_seconds,
        case
          when response.is_correct=true then 'correct'
          when response.is_correct=false then 'incorrect'
          else 'unanswered'
        end result_status,
        coalesce(question.stem_text,paper_question.question_snapshot->>'stem_text','Question') question_text
      from latest_attempts attempt
      join public.exam_responses response on response.attempt_id=attempt.id
      join public.paper_questions paper_question on paper_question.id=response.paper_question_id
      left join public.paper_sections paper_section on paper_section.id=paper_question.section_id
      left join public.questions question on question.id=paper_question.question_id
      left join public.subjects subject on subject.id=coalesce(question.subject_id,paper_section.subject_id)
      left join public.chapters chapter on chapter.id=question.chapter_id
      left join public.topics topic on topic.id=question.topic_id
      where attempt.rn=1
    ), difficulty_rows as (
      select
        subject_name,
        difficulty,
        count(*) questions,
        count(*) filter(where result_status='correct') correct,
        count(*) filter(where result_status='incorrect') incorrect,
        count(*) filter(where result_status='unanswered') unanswered,
        round(
          100*count(*) filter(where result_status='correct')::numeric
          /greatest(count(*),1),
          1
        ) percentage,
        round(avg(time_spent_seconds)::numeric,1) average_time_seconds
      from evidence
      group by subject_name,difficulty
    ), type_rows as (
      select
        subject_name,
        question_type,
        count(*) questions,
        count(*) filter(where result_status='correct') correct,
        count(*) filter(where result_status='incorrect') incorrect,
        count(*) filter(where result_status='unanswered') unanswered,
        round(
          100*count(*) filter(where result_status='correct')::numeric
          /greatest(count(*),1),
          1
        ) percentage,
        round(avg(time_spent_seconds)::numeric,1) average_time_seconds
      from evidence
      group by subject_name,question_type
    ), tag_rows as (
      select
        evidence.subject_name,
        evidence.chapter_name,
        evidence.topic_name,
        tag.name,
        count(*) questions,
        count(*) filter(where evidence.result_status='correct') correct,
        count(*) filter(where evidence.result_status='incorrect') incorrect,
        count(*) filter(where evidence.result_status='unanswered') unanswered,
        round(
          100*count(*) filter(where evidence.result_status='correct')::numeric
          /greatest(count(*),1),
          1
        ) percentage
      from evidence
      cross join lateral unnest(
        case
          when cardinality(evidence.tags)>0 then evidence.tags
          else array['General']::text[]
        end
      ) tag(name)
      group by evidence.subject_name,evidence.chapter_name,evidence.topic_name,tag.name
    ), wrong_rows as (
      select
        paper_id,question_id,subject_name,chapter_name,topic_name,
        question_text,difficulty,question_type,time_spent_seconds
      from evidence
      where result_status='incorrect'
      order by time_spent_seconds desc
      limit 60
    ), goals as (
      select *
      from public.student_analytics_goals
      where student_id=v_student
      order by status,coalesce(due_date,'9999-12-31'::date),created_at desc
    ), practice as (
      select
        collection.id,
        collection.name,
        collection.description,
        collection.exam_types,
        collection.class_levels,
        collection.visibility,
        collection.linked_paper_id,
        paper.status paper_status,
        paper.title paper_title,
        count(item.id)::integer question_count,
        coalesce(
          jsonb_agg(distinct subject.name) filter(where subject.name is not null),
          '[]'::jsonb
        ) subjects
      from public.question_collections collection
      left join public.question_collection_items item on item.collection_id=collection.id
      left join public.questions question on question.id=item.question_id
      left join public.subjects subject on subject.id=question.subject_id
      left join public.question_papers paper on paper.id=collection.linked_paper_id
      where collection.status='active'
        and public.question_collection_can_read_v13(collection)
      group by collection.id,paper.status,paper.title
    )
    select jsonb_build_object(
      'difficulty',coalesce((select jsonb_agg(to_jsonb(row)) from difficulty_rows row),'[]'::jsonb),
      'question_types',coalesce((select jsonb_agg(to_jsonb(row)) from type_rows row),'[]'::jsonb),
      'tags',coalesce((select jsonb_agg(to_jsonb(row)) from tag_rows row),'[]'::jsonb),
      'incorrect_questions',coalesce((select jsonb_agg(to_jsonb(row)) from wrong_rows row),'[]'::jsonb),
      'goals',coalesce((select jsonb_agg(to_jsonb(row)) from goals row),'[]'::jsonb),
      'practice_collections',coalesce((select jsonb_agg(to_jsonb(row)) from practice row),'[]'::jsonb),
      'generated_at',now(),
      'supported_evidence',jsonb_build_object(
        'semantic_error_types',false,
        'confidence_score',false,
        'question_target_time',false
      )
    )
  );
end;
$$;

grant execute on function public.get_student_reference_breakdowns_v13(uuid,uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(
  null,
  'analytics.reference_ui_and_question_collections_ready',
  'system',
  '39_v10_question_collections_reference_analytics',
  jsonb_build_object(
    'question_collections',true,
    'paper_draft_creation',true,
    'paper_builder_rpc',true,
    'goals',true,
    'subject_chapter_topic_ui',true,
    'unsupported_metrics_not_fabricated',true
  )
);

commit;
