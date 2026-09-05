-- P0.4 follow-up: legacy SECURITY DEFINER analytics helpers expose result facts
-- without the Phase-1 release policy. They remain callable by trusted wrappers
-- (function owners bypass EXECUTE grants) but are no longer public RPC endpoints.

revoke all on function public.get_student_test_comparison_base_v12(uuid, uuid) from public, anon, authenticated;
revoke all on function public.get_student_test_comparison_v11(uuid, uuid) from public, anon, authenticated;
revoke all on function public.analytics_test_snapshot_base_v12(uuid, uuid) from public, anon, authenticated;
revoke all on function public.analytics_test_snapshot_v11(uuid, uuid) from public, anon, authenticated;
revoke all on function public.analytics_subject_snapshot_base_v12(uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.analytics_subject_snapshot_v11(uuid, text, uuid[]) from public, anon, authenticated;
revoke all on function public.analytics_attempt_time_snapshot_v12(uuid, uuid) from public, anon, authenticated;

grant execute on function public.get_student_test_comparison_base_v12(uuid, uuid) to service_role;
grant execute on function public.get_student_test_comparison_v11(uuid, uuid) to service_role;
grant execute on function public.analytics_test_snapshot_base_v12(uuid, uuid) to service_role;
grant execute on function public.analytics_test_snapshot_v11(uuid, uuid) to service_role;
grant execute on function public.analytics_subject_snapshot_base_v12(uuid, text, uuid[]) to service_role;
grant execute on function public.analytics_subject_snapshot_v11(uuid, text, uuid[]) to service_role;
grant execute on function public.analytics_attempt_time_snapshot_v12(uuid, uuid) to service_role;
