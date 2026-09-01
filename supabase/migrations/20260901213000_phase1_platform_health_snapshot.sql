create or replace function public.phase1_platform_health_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'generatedAt', now(),
    'usage', jsonb_build_object(
      'users', (select count(*) from public.profiles),
      'schools', (select count(*) from public.organizations),
      'activeStudents', (select count(*) from public.student_school_memberships where status::text = 'active'),
      'questions', (select count(*) from public.questions),
      'papers', (select count(*) from public.question_papers),
      'attempts', (select count(*) from public.exam_attempts),
      'responses', (select count(*) from public.exam_responses),
      'resources', (select count(*) from public.academic_resources where is_active is true)
    ),
    'failures24h', jsonb_build_object(
      'imports',
        (select coalesce(sum(failed_rows), 0) from public.question_import_batches where created_at >= now() - interval '24 hours')
        + (select coalesce(sum(failed_rows), 0) from public.account_import_batches where created_at >= now() - interval '24 hours'),
      'testStarts', (select count(*) from public.exam_attempt_events where created_at >= now() - interval '24 hours' and lower(event_type) in ('start_failed','start_error','attempt_start_failed','attempt_start_error')),
      'answerSaves', (select count(*) from public.exam_attempt_events where created_at >= now() - interval '24 hours' and lower(event_type) in ('save_failed','save_error','answer_save_failed','answer_save_error')),
      'submissions', (select count(*) from public.exam_attempt_events where created_at >= now() - interval '24 hours' and lower(event_type) in ('submit_failed','submit_error','submission_failed','submission_error'))
    )
  );
$$;

revoke all on function public.phase1_platform_health_snapshot() from public, anon, authenticated;
grant execute on function public.phase1_platform_health_snapshot() to service_role;
