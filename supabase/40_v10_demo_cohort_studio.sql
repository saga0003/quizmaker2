-- Evidara V10 — Demo Cohort Studio
-- Run after 39f_v10_collection_scope_hardening.sql.
-- Exposes the generated 100-student dataset as a drill-down analytics laboratory.

begin;

create or replace function public.get_analytics_demo_cohort_studio_v14(
  p_email text default 'sales.student@demo.evidara.app'
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_batch public.analytics_demo_batches;
  v_question_count integer:=0;
  v_chapter_count integer:=0;
  v_topic_count integer:=0;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  if not public.is_evidara_super_admin() then
    raise exception 'Only Super Admin can open the demo cohort studio.' using errcode='42501';
  end if;

  select * into v_batch
  from public.analytics_demo_batches
  where lower(target_email)=lower(btrim(coalesce(p_email,'')))
    and status='ready'
  order by created_at desc
  limit 1;

  if v_batch.id is null then
    return jsonb_build_object(
      'ready',false,
      'email',lower(btrim(coalesce(p_email,''))),
      'batch',null,
      'students','[]'::jsonb,
      'products','[]'::jsonb,
      'difficulty_blueprint','[]'::jsonb,
      'type_blueprint','[]'::jsonb,
      'generated_at',now()
    );
  end if;

  select count(*) into v_question_count
  from public.questions question
  where question.metadata->>'demo_batch_id'=v_batch.id::text;

  select count(*) into v_chapter_count
  from public.analytics_demo_chapters_v12 chapter
  where chapter.batch_id=v_batch.id;

  select count(*) into v_topic_count
  from public.analytics_demo_topics_v12 topic
  where topic.batch_id=v_batch.id;

  return (
    with student_rows as (
      select
        student.id,
        student.auth_user_id,
        student.full_name,
        student.roll_number,
        student.track,
        student.section_label,
        count(distinct result.paper_id)::integer completed_tests,
        round(avg(result.percentage)::numeric,1) average_percentage,
        round(avg(result.accuracy_overall)::numeric,1) average_accuracy,
        round(avg(result.time_score)::numeric,1) average_time_score,
        (
          select subject.subject_name
          from public.analytics_demo_subject_results subject
          where subject.demo_student_id=student.id
          group by subject.subject_name
          order by avg(subject.percentage) desc nulls last,subject.subject_name
          limit 1
        ) strongest_subject,
        (
          select subject.subject_name
          from public.analytics_demo_subject_results subject
          where subject.demo_student_id=student.id
          group by subject.subject_name
          order by avg(subject.percentage) asc nulls last,subject.subject_name
          limit 1
        ) weakest_subject
      from public.analytics_demo_students student
      left join public.analytics_demo_test_results result
        on result.demo_student_id=student.id
       and result.batch_id=v_batch.id
      where student.batch_id=v_batch.id
      group by student.id,student.auth_user_id,student.full_name,student.roll_number,student.track,student.section_label
    ), product_rows as (
      select
        product.id,
        product.name,
        product.exam_type,
        count(distinct result.paper_id)::integer papers,
        count(distinct result.demo_student_id)::integer students
      from public.analytics_demo_test_results result
      join public.products product on product.id=result.product_id
      where result.batch_id=v_batch.id
      group by product.id,product.name,product.exam_type
    ), difficulty_rows as (
      select question.difficulty::text name,count(*)::integer questions
      from public.questions question
      where question.metadata->>'demo_batch_id'=v_batch.id::text
      group by question.difficulty
    ), type_rows as (
      select question.question_type::text name,count(*)::integer questions
      from public.questions question
      where question.metadata->>'demo_batch_id'=v_batch.id::text
      group by question.question_type
    )
    select jsonb_build_object(
      'ready',true,
      'email',lower(btrim(p_email)),
      'batch',jsonb_build_object(
        'id',v_batch.id,
        'status',v_batch.status,
        'students',(select count(*) from public.analytics_demo_students where batch_id=v_batch.id),
        'products',(select count(*) from product_rows),
        'papers',(select count(distinct paper_id) from public.analytics_demo_test_results where batch_id=v_batch.id),
        'questions',v_question_count,
        'chapters',v_chapter_count,
        'topics',v_topic_count,
        'test_results',(select count(*) from public.analytics_demo_test_results where batch_id=v_batch.id),
        'subject_results',(select count(*) from public.analytics_demo_subject_results where batch_id=v_batch.id),
        'created_at',v_batch.created_at,
        'completed_at',v_batch.completed_at
      ),
      'students',coalesce((select jsonb_agg(to_jsonb(row) order by row.roll_number) from student_rows row),'[]'::jsonb),
      'products',coalesce((select jsonb_agg(to_jsonb(row) order by row.name) from product_rows row),'[]'::jsonb),
      'difficulty_blueprint',coalesce((select jsonb_agg(to_jsonb(row) order by row.name) from difficulty_rows row),'[]'::jsonb),
      'type_blueprint',coalesce((select jsonb_agg(to_jsonb(row) order by row.name) from type_rows row),'[]'::jsonb),
      'generated_at',now()
    )
  );
end;
$$;

grant execute on function public.get_analytics_demo_cohort_studio_v14(text) to authenticated;

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
        sum(subject.total_questions)::integer questions,
        sum(subject.correct_count)::integer correct,
        sum(subject.incorrect_count)::integer incorrect,
        sum(subject.unanswered_count)::integer unanswered,
        round(sum(subject.marks)::numeric,2) marks,
        round(sum(subject.maximum_marks)::numeric,2) maximum_marks,
        round(100*sum(subject.marks)::numeric/greatest(sum(subject.maximum_marks),1),1) percentage,
        round(100*sum(subject.correct_count)::numeric/greatest(sum(subject.total_questions),1),1) accuracy
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
  'analytics.demo_cohort_studio_ready',
  'system',
  '40_v10_demo_cohort_studio',
  jsonb_build_object(
    'one_click_cohort_and_questions',true,
    'all_generated_students_explorable',true,
    'subject_chapter_topic_drilldown',true
  )
);

commit;
