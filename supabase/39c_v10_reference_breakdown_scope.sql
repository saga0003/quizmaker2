-- Evidara V10 — scoped difficulty and question-format breakdowns
-- Run after 39b_v10_reference_taxonomy_detail.sql.

begin;

create or replace function public.get_student_reference_scoped_breakdowns_v13(
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
    raise exception 'You do not have access to this student evidence.' using errcode='42501';
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
        coalesce(subject.name,paper_section.subject_key,paper_section.title,'General') subject_name,
        question.chapter_id,
        chapter.name chapter_name,
        question.topic_id,
        topic.name topic_name,
        coalesce(question.difficulty::text,paper_question.question_snapshot->>'difficulty','moderate') difficulty,
        coalesce(question.question_type::text,paper_question.question_snapshot->>'question_type','single_correct') question_type,
        case when response.is_correct=true then 1 else 0 end correct,
        case when response.is_correct=false then 1 else 0 end incorrect,
        case when response.is_correct is null then 1 else 0 end unanswered,
        coalesce(response.time_spent_seconds,0)::numeric time_spent_seconds
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
        subject_name,chapter_id,chapter_name,topic_id,topic_name,difficulty,
        count(*)::integer questions,
        sum(correct)::integer correct,
        sum(incorrect)::integer incorrect,
        sum(unanswered)::integer unanswered,
        round(100*sum(correct)::numeric/greatest(count(*),1),1) percentage,
        round(avg(time_spent_seconds),1) average_time_seconds
      from evidence
      group by subject_name,chapter_id,chapter_name,topic_id,topic_name,difficulty
    ), type_rows as (
      select
        subject_name,chapter_id,chapter_name,topic_id,topic_name,question_type,
        count(*)::integer questions,
        sum(correct)::integer correct,
        sum(incorrect)::integer incorrect,
        sum(unanswered)::integer unanswered,
        round(100*sum(correct)::numeric/greatest(count(*),1),1) percentage,
        round(avg(time_spent_seconds),1) average_time_seconds
      from evidence
      group by subject_name,chapter_id,chapter_name,topic_id,topic_name,question_type
    )
    select jsonb_build_object(
      'difficulty',coalesce(
        (select jsonb_agg(to_jsonb(row)) from difficulty_rows row),
        '[]'::jsonb
      ),
      'question_types',coalesce(
        (select jsonb_agg(to_jsonb(row)) from type_rows row),
        '[]'::jsonb
      ),
      'generated_at',now()
    )
  );
end;
$$;

grant execute on function public.get_student_reference_scoped_breakdowns_v13(uuid,uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(
  null,
  'analytics.reference_scoped_breakdowns_ready',
  'system',
  '39c_v10_reference_breakdown_scope',
  jsonb_build_object(
    'subject',true,
    'chapter',true,
    'topic',true,
    'difficulty',true,
    'question_types',true,
    'unanswered_from_all_paper_questions',true
  )
);

commit;
