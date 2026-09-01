create index if not exists exam_attempts_org_student_submitted_idx
  on public.exam_attempts (organization_id, student_id, submitted_at desc)
  where status = 'submitted';

create or replace function public.get_institution_student_attempt_metrics_v1(
  p_organization_id uuid,
  p_student_ids uuid[] default null
)
returns table (
  student_id uuid,
  completed_tests bigint,
  percentage_sum numeric,
  average_percentage numeric,
  correct_count bigint,
  incorrect_count bigint,
  unanswered_count bigint,
  highest_percentage numeric,
  lowest_percentage numeric,
  last_test_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.student_id,
    count(*)::bigint as completed_tests,
    coalesce(sum(a.percentage), 0)::numeric as percentage_sum,
    avg(a.percentage)::numeric as average_percentage,
    coalesce(sum(a.correct_count), 0)::bigint as correct_count,
    coalesce(sum(a.incorrect_count), 0)::bigint as incorrect_count,
    coalesce(sum(a.unanswered_count), 0)::bigint as unanswered_count,
    max(a.percentage)::numeric as highest_percentage,
    min(a.percentage)::numeric as lowest_percentage,
    max(a.submitted_at) as last_test_at
  from public.exam_attempts a
  where a.status = 'submitted'
    and (
      a.organization_id = p_organization_id
      or (
        a.organization_id is null
        and exists (
          select 1 from public.student_school_memberships ssm
          where ssm.organization_id = p_organization_id
            and ssm.student_id = a.student_id
            and ssm.status = 'active'
        )
      )
    )
    and (p_student_ids is null or a.student_id = any(p_student_ids))
  group by a.student_id;
$$;

revoke all on function public.get_institution_student_attempt_metrics_v1(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.get_institution_student_attempt_metrics_v1(uuid, uuid[]) to service_role;
comment on function public.get_institution_student_attempt_metrics_v1(uuid, uuid[]) is
  'Phase 1 F13 server-only aggregate: collapses submitted attempt rows to one row per student before institution analytics leaves PostgreSQL.';
