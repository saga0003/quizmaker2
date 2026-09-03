-- Phase 1 R13: restore the internal result-release state contract consumed by
-- get_student_analytics_v12(). The authoritative policy remains
-- student_result_release_level(); this helper only converts that level into the
-- JSON state expected by the analytics compatibility RPC.

create or replace function public.student_result_release_state_v20(
  p_paper_id uuid,
  p_student_id uuid default auth.uid()
)
returns jsonb
language sql
stable
security invoker
set search_path = public, auth
as $$
  with release as (
    select public.student_result_release_level(p_paper_id, p_student_id) as level
  )
  select jsonb_build_object(
    'level', release.level,
    'result_released', release.level in ('score', 'answers', 'analytics'),
    'answers_released', release.level in ('answers', 'analytics'),
    'analytics_released', release.level = 'analytics',
    'message', case release.level
      when 'none' then 'Results have not been released for this assessment yet.'
      when 'score' then 'Detailed analytics has not been released yet.'
      when 'answers' then 'Detailed analytics has not been released yet.'
      else null
    end
  )
  from release;
$$;

-- Internal compatibility helper only. Browser roles continue to use the
-- explicitly allowed result/analytics RPCs; they cannot call this helper.
revoke all on function public.student_result_release_state_v20(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.student_result_release_state_v20(uuid, uuid)
  to service_role;

comment on function public.student_result_release_state_v20(uuid, uuid)
is 'Internal Phase 1 result-release JSON adapter for get_student_analytics_v12; authoritative policy remains student_result_release_level().';
