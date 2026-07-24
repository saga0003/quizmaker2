-- Evidara V10 Analytics Phase 2 attempt-limit hotfix
-- Run after 36_v10_analytics_phase_2.sql and 36a_v10_analytics_phase_2_safety.sql.
-- The original demo generator requested 1,000 attempts per generated paper, while
-- question_papers enforces a maximum of 100. This trigger corrects only generated
-- analytics-demo papers and preserves the normal validation boundary for every
-- genuine paper.

begin;

create or replace function public.normalize_analytics_demo_paper_attempt_limit_v10()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if coalesce(new.settings,'{}'::jsonb) ? 'demo_batch_id'
     and coalesce(new.attempt_limit,1) > 100 then
    new.attempt_limit := 100;
  end if;
  return new;
end;
$$;

drop trigger if exists normalize_analytics_demo_paper_attempt_limit_v10
  on public.question_papers;
create trigger normalize_analytics_demo_paper_attempt_limit_v10
before insert or update of attempt_limit, settings
on public.question_papers
for each row
execute function public.normalize_analytics_demo_paper_attempt_limit_v10();

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(
  null,
  'analytics.v10.phase2.attempt_limit_hotfix_ready',
  'system',
  '36b_v10_analytics_phase_2_attempt_limit_hotfix',
  jsonb_build_object(
    'demo_paper_attempt_limit',100,
    'production_paper_constraint_preserved',true
  )
);

commit;
