-- Evidara V10 — Demo Cohort statement-timeout hotfix
-- Run after 40a_v10_demo_cohort_studio_hardening.sql.
--
-- Supabase REST calls made by the authenticated role normally have a short
-- statement timeout. Cohort generation is an intentionally heavy Super Admin
-- operation, so only the cohort generator receives a function-level allowance.

begin;

-- Speed up the metadata lookups repeatedly used while building and resetting
-- the isolated generated batch.
create index if not exists analytics_demo_batches_target_status_created_idx
  on public.analytics_demo_batches(lower(target_email),status,created_at desc);

create index if not exists questions_demo_batch_subject_idx
  on public.questions((metadata->>'demo_batch_id'),subject_id)
  where metadata ? 'demo_batch_id';

create index if not exists products_demo_batch_track_idx
  on public.products((commerce_settings->>'demo_batch_id'),(commerce_settings->>'demo_track'))
  where commerce_settings ? 'demo_batch_id';

create index if not exists exam_attempts_demo_batch_paper_idx
  on public.exam_attempts((metadata->>'demo_batch_id'),paper_id)
  where metadata ? 'demo_batch_id';

create index if not exists question_papers_demo_batch_idx
  on public.question_papers((settings->>'demo_batch_id'))
  where settings ? 'demo_batch_id';

-- Function-level settings work through the Supabase REST API and avoid changing
-- the timeout for normal authenticated requests. Sixty seconds is the maximum
-- configurable client-query timeout documented by Supabase.
do $$
begin
  if to_regprocedure('public.generate_analytics_demo_data_v10(text,integer)') is not null then
    execute 'alter function public.generate_analytics_demo_data_v10(text,integer) set statement_timeout = ''60s''';
    execute 'alter function public.generate_analytics_demo_data_v10(text,integer) set lock_timeout = ''5s''';
  end if;

  if to_regprocedure('public.generate_analytics_demo_data_base_v12(text,integer)') is not null then
    execute 'alter function public.generate_analytics_demo_data_base_v12(text,integer) set statement_timeout = ''60s''';
    execute 'alter function public.generate_analytics_demo_data_base_v12(text,integer) set lock_timeout = ''5s''';
  end if;

  if to_regprocedure('public.generate_analytics_demo_data_base_v11(text,integer)') is not null then
    execute 'alter function public.generate_analytics_demo_data_base_v11(text,integer) set statement_timeout = ''60s''';
    execute 'alter function public.generate_analytics_demo_data_base_v11(text,integer) set lock_timeout = ''5s''';
  end if;
end
$$;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(
  null,
  'analytics.demo.cohort_timeout_hotfix_ready',
  'system',
  '40b_v10_demo_cohort_statement_timeout_hotfix',
  jsonb_build_object(
    'function_timeout_seconds',60,
    'normal_application_timeout_unchanged',true,
    'metadata_indexes_added',true
  )
);

commit;
