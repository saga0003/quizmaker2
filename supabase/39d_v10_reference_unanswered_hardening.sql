-- Evidara V10 — unanswered-question hardening for the reference analytics workspace
-- Run after 39c_v10_reference_breakdown_scope.sql.

begin;

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
      join public.paper_questions paper_question on paper_question.paper_id=attempt.paper_id
      left join public.exam_responses response
        on response.attempt_id=attempt.id
       and response.paper_question_id=paper_question.id
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
        'question_target_time',false,
        'unanswered_from_all_paper_questions',true
      )
    )
  );
end;
$$;

grant execute on function public.get_student_reference_breakdowns_v13(uuid,uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(
  null,
  'analytics.reference_unanswered_hardening_ready',
  'system',
  '39d_v10_reference_unanswered_hardening',
  jsonb_build_object(
    'all_paper_questions_included',true,
    'missing_response_is_unanswered',true
  )
);

commit;
