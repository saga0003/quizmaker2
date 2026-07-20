-- Evidara V6.7: portable UUID aggregate used by the achievement evaluator.
-- Apply after 18_achievement_certificate_operations.sql.
-- PostgreSQL versions do not all expose a built-in max(uuid) aggregate even
-- though UUID values have deterministic ordering. This public-schema overload
-- is used only to retain one representative source attempt from a recent window.

create or replace function public.uuid_max_transition(p_state uuid, p_candidate uuid)
returns uuid
language sql
immutable
parallel safe
as $$
  select case
    when p_state is null then p_candidate
    when p_candidate is null then p_state
    when p_candidate > p_state then p_candidate
    else p_state
  end
$$;

drop aggregate if exists public.max(uuid);
create aggregate public.max(uuid) (
  sfunc = public.uuid_max_transition,
  stype = uuid,
  combinefunc = public.uuid_max_transition,
  parallel = safe
);

revoke all on function public.uuid_max_transition(uuid,uuid) from public, anon, authenticated;
grant execute on function public.uuid_max_transition(uuid,uuid) to service_role;

comment on aggregate public.max(uuid) is
  'Evidara compatibility aggregate for selecting a representative UUID source in achievement evidence windows.';
