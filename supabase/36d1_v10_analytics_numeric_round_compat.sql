-- Evidara V10 Analytics Phase 2 — PostgreSQL percentile rounding compatibility
-- Run after 36d_v10_analytics_100_student_demo_cohort.sql and before 36e.
-- Ordered-set percentile aggregates return double precision on PostgreSQL.
-- This exact-signature helper safely supports round(value, decimal_places).

begin;

create or replace function public.round(
  p_value double precision,
  p_scale integer
)
returns numeric
language sql
immutable
strict
parallel safe
set search_path=pg_catalog
as $$
  select pg_catalog.round(p_value::numeric,p_scale);
$$;

grant execute on function public.round(double precision,integer) to authenticated,service_role;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.percentile_round_compat_ready','system','36d1_v10_analytics_numeric_round_compat',
  jsonb_build_object('double_precision_round_scale',true,'percentile_cont_compatible',true));

commit;
