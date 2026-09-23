revoke execute on function public.save_question_paper_revisioned_v1(uuid,uuid,jsonb) from public, anon;
grant execute on function public.save_question_paper_revisioned_v1(uuid,uuid,jsonb) to authenticated, service_role;

revoke execute on function public.update_question_paper_attempt_limit_v1(uuid,integer) from public, anon;
grant execute on function public.update_question_paper_attempt_limit_v1(uuid,integer) to authenticated, service_role;

revoke execute on function public.snapshot_exam_attempt_paper_v1() from public, anon, authenticated;
grant execute on function public.snapshot_exam_attempt_paper_v1() to service_role;

revoke execute on function public.guard_attempt_limit_not_below_used_v1() from public, anon, authenticated;
grant execute on function public.guard_attempt_limit_not_below_used_v1() to service_role;
