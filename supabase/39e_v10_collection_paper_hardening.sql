-- Evidara V10 — collection-to-paper hardening
-- Run after 39d_v10_reference_unanswered_hardening.sql.

begin;

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
  ), ordered_grouped as (
    select
      grouped.*,
      (row_number() over(order by grouped.first_order)-1)::integer as display_order
    from grouped
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'client_id',ordered_grouped.client_id,
        'title',ordered_grouped.subject_name,
        'subject_id',ordered_grouped.subject_id,
        'subject_key',ordered_grouped.subject_name,
        'biology_division','combined',
        'selection_mode','manual',
        'question_target',ordered_grouped.question_count,
        'difficulty_distribution',jsonb_build_object(
          'very_easy',0,
          'easy',0,
          'moderate',0,
          'difficult',0,
          'very_difficult',0
        ),
        'chapter_ids',to_jsonb(ordered_grouped.chapter_ids),
        'topic_ids',to_jsonb(ordered_grouped.topic_ids),
        'display_order',ordered_grouped.display_order
      )
      order by ordered_grouped.display_order
    ),
    '[]'::jsonb
  ) into v_sections
  from ordered_grouped;

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
    auth.uid(),
    v_collection.organization_id,
    'questions.collection.paper_created',
    'question_paper',
    v_paper::text,
    jsonb_build_object(
      'collection_id',p_collection_id,
      'paper_builder_rpc','save_question_paper'
    )
  );

  return v_paper;
end;
$$;

grant execute on function public.create_paper_from_question_collection_v13(uuid,text,integer) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(
  null,
  'questions.collection.paper_hardening_ready',
  'system',
  '39e_v10_collection_paper_hardening',
  jsonb_build_object(
    'ordered_section_payload',true,
    'existing_paper_builder_rpc',true
  )
);

commit;
