-- Evidara V10 — Demo Cohort Studio schema hardening
-- Run after 40_v10_demo_cohort_studio.sql.
-- Derives subject question totals from correct + incorrect + unanswered counts.

begin;

create or replace function public.get_analytics_demo_student_drilldown_v14(
  p_demo_student_id uuid,
  p_product_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_student public.analytics_demo_students;
  v_batch public.analytics_demo_batches;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can inspect generated cohort students.' using errcode='42501';
  end if;

  select * into v_student
  from public.analytics_demo_students
  where id=p_demo_student_id;

  if v_student.id is null then raise exception 'Generated student not found.'; end if;

  select * into v_batch
  from public.analytics_demo_batches
  where id=v_student.batch_id and status='ready';

  if v_batch.id is null then raise exception 'The generated cohort is not ready.'; end if;

  return (
    with selected_results as (
      select result.*
      from public.analytics_demo_test_results result
      where result.demo_student_id=v_student.id
        and (p_product_id is null or result.product_id=p_product_id)
    ), subject_rows as (
      select
        subject.subject_name,
        sum(subject.correct_count+subject.incorrect_count+subject.unanswered_count)::integer questions,
        sum(subject.correct_count)::integer correct,
        sum(subject.incorrect_count)::integer incorrect,
        sum(subject.unanswered_count)::integer unanswered,
        round(sum(subject.marks)::numeric,2) marks,
        round(sum(subject.maximum_marks)::numeric,2) maximum_marks,
        round(100*sum(subject.marks)::numeric/greatest(sum(subject.maximum_marks),1),1) percentage,
        round(
          100*sum(subject.correct_count)::numeric
          /greatest(sum(subject.correct_count+subject.incorrect_count+subject.unanswered_count),1),
          1
        ) accuracy
      from public.analytics_demo_subject_results subject
      where subject.demo_student_id=v_student.id
        and (p_product_id is null or subject.product_id=p_product_id)
      group by subject.subject_name
    ), chapter_rows as (
      select
        topic.subject_name,
        chapter.id chapter_id,
        chapter.name chapter_name,
        sum(topic.total_questions)::integer questions,
        sum(topic.correct_count)::integer correct,
        sum(topic.incorrect_count)::integer incorrect,
        sum(topic.unanswered_count)::integer unanswered,
        round(sum(topic.marks)::numeric,2) marks,
        round(sum(topic.maximum_marks)::numeric,2) maximum_marks,
        round(100*sum(topic.marks)::numeric/greatest(sum(topic.maximum_marks),1),1) percentage,
        round(100*sum(topic.correct_count)::numeric/greatest(sum(topic.total_questions),1),1) accuracy
      from public.analytics_demo_topic_results_v12 topic
      join public.analytics_demo_chapters_v12 chapter on chapter.id=topic.chapter_id
      where topic.demo_student_id=v_student.id
        and (p_product_id is null or topic.product_id=p_product_id)
      group by topic.subject_name,chapter.id,chapter.name
    ), topic_rows as (
      select
        result.subject_name,
        chapter.id chapter_id,
        chapter.name chapter_name,
        topic.id topic_id,
        topic.name topic_name,
        sum(result.total_questions)::integer questions,
        sum(result.correct_count)::integer correct,
        sum(result.incorrect_count)::integer incorrect,
        sum(result.unanswered_count)::integer unanswered,
        round(sum(result.marks)::numeric,2) marks,
        round(sum(result.maximum_marks)::numeric,2) maximum_marks,
        round(100*sum(result.marks)::numeric/greatest(sum(result.maximum_marks),1),1) percentage,
        round(100*sum(result.correct_count)::numeric/greatest(sum(result.total_questions),1),1) accuracy
      from public.analytics_demo_topic_results_v12 result
      join public.analytics_demo_topics_v12 topic on topic.id=result.topic_id
      join public.analytics_demo_chapters_v12 chapter on chapter.id=result.chapter_id
      where result.demo_student_id=v_student.id
        and (p_product_id is null or result.product_id=p_product_id)
      group by result.subject_name,chapter.id,chapter.name,topic.id,topic.name
    ), test_rows as (
      select
        result.paper_id,
        paper.title paper_title,
        result.product_id,
        product.name product_name,
        result.submitted_at,
        round(result.percentage::numeric,1) percentage,
        round(result.accuracy_overall::numeric,1) accuracy,
        round(result.time_score::numeric,1) time_score,
        result.correct_count::integer correct,
        result.incorrect_count::integer incorrect,
        result.unanswered_count::integer unanswered
      from selected_results result
      join public.question_papers paper on paper.id=result.paper_id
      join public.products product on product.id=result.product_id
    )
    select jsonb_build_object(
      'student',jsonb_build_object(
        'id',v_student.id,
        'auth_user_id',v_student.auth_user_id,
        'full_name',v_student.full_name,
        'roll_number',v_student.roll_number,
        'track',v_student.track,
        'section_label',v_student.section_label
      ),
      'summary',jsonb_build_object(
        'completed_tests',(select count(*) from selected_results),
        'average_percentage',(select round(avg(percentage)::numeric,1) from selected_results),
        'average_accuracy',(select round(avg(accuracy_overall)::numeric,1) from selected_results),
        'average_time_score',(select round(avg(time_score)::numeric,1) from selected_results),
        'correct',(select coalesce(sum(correct_count),0) from selected_results),
        'incorrect',(select coalesce(sum(incorrect_count),0) from selected_results),
        'unanswered',(select coalesce(sum(unanswered_count),0) from selected_results)
      ),
      'subjects',coalesce((select jsonb_agg(to_jsonb(row) order by row.subject_name) from subject_rows row),'[]'::jsonb),
      'chapters',coalesce((select jsonb_agg(to_jsonb(row) order by row.percentage,row.chapter_name) from chapter_rows row),'[]'::jsonb),
      'topics',coalesce((select jsonb_agg(to_jsonb(row) order by row.percentage,row.topic_name) from topic_rows row),'[]'::jsonb),
      'tests',coalesce((select jsonb_agg(to_jsonb(row) order by row.submitted_at) from test_rows row),'[]'::jsonb),
      'generated_at',now()
    )
  );
end;
$$;

grant execute on function public.get_analytics_demo_student_drilldown_v14(uuid,uuid) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(
  null,
  'analytics.demo_cohort_studio_hardened',
  'system',
  '40a_v10_demo_cohort_studio_hardening',
  jsonb_build_object('subject_question_total_derived_from_answer_counts',true)
);

commit;
