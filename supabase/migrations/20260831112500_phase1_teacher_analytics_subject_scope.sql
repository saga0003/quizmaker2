-- Phase 1 B6 follow-up: keep teacher analytics inside the teacher's assigned subject scope.
-- School/platform administrators retain their existing section-wide analytics view.

begin;

create or replace function public.get_teacher_analytics_overview_v10(
  p_section_id uuid default null::uuid,
  p_from date default null::date,
  p_to date default null::date
)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_role text;
begin
  if v_user is null then raise exception 'Login required.'; end if;
  if p_from is not null and p_to is not null and p_to < p_from then
    raise exception 'The end date must be on or after the start date.';
  end if;
  select role::text into v_role from public.profiles where id=v_user;
  if v_role not in ('teacher','reviewer','invigilator','school_teacher','institute_owner','institute_admin','school_admin','school_owner','evidara_admin','admin','platform_admin','super_admin') then
    raise exception 'Teacher or administrator analytics access required.' using errcode='42501';
  end if;

  return (
    with visible_sections as (
      select distinct section_row.*
      from public.academic_sections section_row
      where section_row.is_active=true
        and (p_section_id is null or section_row.id=p_section_id)
        and (
          public.analytics_is_platform_admin_v10()
          or public.analytics_is_school_admin_v10(section_row.organization_id)
          or public.is_evidara_teacher_for_scope(section_row.organization_id, section_row.id, null)
        )
    ),
    visible_students as (
      select membership.student_id,membership.id as membership_id,membership.section_id,
        membership.organization_id,membership.grade,membership.academic_year,
        coalesce(profile.full_name,'Student') as full_name,
        section_row.name as section_name
      from public.student_school_memberships membership
      join visible_sections section_row on section_row.id=membership.section_id
      join public.profiles profile on profile.id=membership.student_id
      where membership.status='active'
    ),
    attempts as (
      select attempt.*,student.section_id,student.full_name,student.grade,student.section_name,
        paper.title as paper_title
      from public.exam_attempts attempt
      join visible_students student on student.student_id=attempt.student_id
      join public.question_papers paper on paper.id=attempt.paper_id
      where attempt.status='submitted'
        and coalesce((attempt.metadata->>'demo_cohort_only')::boolean,false)=false
        and (p_from is null or attempt.submitted_at::date>=p_from)
        and (p_to is null or attempt.submitted_at::date<=p_to)
        and (
          public.analytics_is_platform_admin_v10()
          or public.analytics_is_school_admin_v10(student.organization_id)
          or (
            paper.subject_id is not null
            and public.is_evidara_teacher_for_scope(student.organization_id, student.section_id, paper.subject_id)
          )
        )
    ),
    student_stats as (
      select student.student_id,student.membership_id,student.section_id,student.full_name,
        student.grade,student.section_name,
        count(attempt.id)::integer as completed_tests,
        round(avg(attempt.percentage),1) as average_percentage,
        round(100*sum(attempt.correct_count)::numeric/greatest(sum(attempt.correct_count+attempt.incorrect_count),1),1) as accuracy,
        min(attempt.submitted_at) as first_test_at,
        max(attempt.submitted_at) as latest_test_at,
        (array_agg(attempt.percentage order by attempt.submitted_at asc) filter(where attempt.id is not null))[1] as first_percentage,
        (array_agg(attempt.percentage order by attempt.submitted_at desc) filter(where attempt.id is not null))[1] as latest_percentage
      from visible_students student
      left join attempts attempt on attempt.student_id=student.student_id
      group by student.student_id,student.membership_id,student.section_id,student.full_name,student.grade,student.section_name
    ),
    student_rows as (
      select stats.*,
        round(coalesce(stats.latest_percentage,0)-coalesce(stats.first_percentage,0),1) as improvement,
        case
          when stats.completed_tests=0 then 'not_started'
          when coalesce(stats.average_percentage,0)<50 or coalesce(stats.accuracy,0)<55 then 'needs_attention'
          when coalesce(stats.latest_percentage,0)-coalesce(stats.first_percentage,0)>=5 then 'improving'
          when coalesce(stats.average_percentage,0)>=80 and coalesce(stats.accuracy,0)>=80 then 'strong'
          else 'steady'
        end as performance_status
      from student_stats stats
    ),
    section_rows as (
      select section_row.id,section_row.organization_id,section_row.academic_year,section_row.grade,
        section_row.name,organization.name as organization_name,
        count(distinct student.student_id)::integer as students,
        count(attempt.id)::integer as completed_tests,
        round(avg(attempt.percentage),1) as average_percentage,
        round(100*sum(attempt.correct_count)::numeric/greatest(sum(attempt.correct_count+attempt.incorrect_count),1),1) as accuracy
      from visible_sections section_row
      join public.organizations organization on organization.id=section_row.organization_id
      left join visible_students student on student.section_id=section_row.id
      left join attempts attempt on attempt.student_id=student.student_id
      group by section_row.id,section_row.organization_id,section_row.academic_year,section_row.grade,section_row.name,organization.name
    ),
    subject_rows as (
      select coalesce(subject.name,paper_section.title,question.question_snapshot->>'subject_name','General') as subject_name,
        count(*)::integer as responses,
        count(*) filter(where response.is_correct=true)::integer as correct,
        count(*) filter(where response.is_correct=false)::integer as incorrect,
        round(100*count(*) filter(where response.is_correct=true)::numeric/
          greatest(count(*) filter(where response.is_correct is not null),1),1) as accuracy,
        round(100*sum(coalesce(response.marks_awarded,0))::numeric/greatest(sum(question.marks),1),1) as average_percentage
      from attempts attempt
      join public.exam_responses response on response.attempt_id=attempt.id
      join public.paper_questions question on question.id=response.paper_question_id
      join public.paper_sections paper_section on paper_section.id=question.section_id
      left join public.subjects subject on subject.id=paper_section.subject_id
      where public.analytics_is_platform_admin_v10()
         or public.analytics_is_school_admin_v10(attempt.organization_id)
         or (
           paper_section.subject_id is not null
           and public.is_evidara_teacher_for_scope(attempt.organization_id, attempt.section_id, paper_section.subject_id)
         )
      group by 1
    ),
    trend_rows as (
      select attempt.submitted_at::date as date,
        count(*)::integer as completed_tests,
        count(distinct attempt.student_id)::integer as active_students,
        round(avg(attempt.percentage),1) as average_percentage,
        round(100*sum(attempt.correct_count)::numeric/greatest(sum(attempt.correct_count+attempt.incorrect_count),1),1) as accuracy
      from attempts attempt
      group by attempt.submitted_at::date
      order by attempt.submitted_at::date
    ),
    summary as (
      select
        (select count(*) from visible_students)::integer as total_students,
        count(distinct attempts.student_id)::integer as active_students,
        count(attempts.id)::integer as completed_tests,
        round(avg(attempts.percentage),1) as average_percentage,
        round(100*sum(attempts.correct_count)::numeric/greatest(sum(attempts.correct_count+attempts.incorrect_count),1),1) as accuracy,
        round(100*count(distinct attempts.student_id)::numeric/greatest((select count(*) from visible_students),1),1) as participation,
        count(*) filter(where student_rows.performance_status='needs_attention')::integer as needs_attention,
        count(*) filter(where student_rows.performance_status='improving')::integer as improving,
        count(*) filter(where student_rows.performance_status='strong')::integer as strong
      from attempts
      right join student_rows on student_rows.student_id=attempts.student_id
    )
    select jsonb_build_object(
      'summary',(select to_jsonb(summary) from summary),
      'sections',coalesce((select jsonb_agg(to_jsonb(section_rows) order by organization_name,grade,name) from section_rows),'[]'::jsonb),
      'students',coalesce((select jsonb_agg(to_jsonb(student_rows) order by performance_status,average_percentage,full_name) from student_rows),'[]'::jsonb),
      'subjects',coalesce((select jsonb_agg(to_jsonb(subject_rows) order by average_percentage) from subject_rows),'[]'::jsonb),
      'trends',coalesce((select jsonb_agg(to_jsonb(trend_rows) order by date) from trend_rows),'[]'::jsonb),
      'generated_at',now()
    )
  );
end;
$function$;

revoke all on function public.get_teacher_analytics_overview_v10(uuid,date,date) from public, anon;
grant execute on function public.get_teacher_analytics_overview_v10(uuid,date,date) to authenticated;

comment on function public.get_teacher_analytics_overview_v10(uuid,date,date) is
  'B6 teacher analytics overview. Teachers see only active assigned sections and assigned-subject paper/response evidence; school/platform admins retain section-wide scope.';

commit;
