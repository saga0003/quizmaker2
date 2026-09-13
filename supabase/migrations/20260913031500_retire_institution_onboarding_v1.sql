-- Retire the obsolete v1 bootstrap path after onboarding v2 is live.
-- Keeping the function definition preserves migration history, but application
-- code can no longer execute it through the service role.
revoke execute on function public.onboard_institution_v1(uuid,uuid,text,text,text,text,text,text,text,text,integer,date,date) from service_role;
