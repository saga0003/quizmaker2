-- Evidara V6.5: server-only aggregate function.
-- Returns no cross-school metrics until the publication's privacy minimum is met.

create or replace function public.get_private_benchmark_summary(
  p_publication_id uuid,
  p_requesting_organization_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publication public.benchmark_publications%rowtype;
  v_valid_attempts integer;
  v_school_count integer;
  v_network_average numeric;
  v_network_median numeric;
  v_school_attempts integer;
  v_school_average numeric;
  v_school_median numeric;
  v_distribution jsonb;
  v_ready boolean;
begin
  select * into v_publication
  from public.benchmark_publications
  where id = p_publication_id;

  if not found then
    raise exception 'Benchmark publication not found.';
  end if;

  select count(*), count(distinct organization_id), avg(percentage), percentile_cont(0.5) within group (order by percentage)
  into v_valid_attempts, v_school_count, v_network_average, v_network_median
  from public.benchmark_contributions
  where publication_id = p_publication_id
    and is_valid = true;

  v_ready := v_valid_attempts >= v_publication.privacy_minimum;

  select count(*), avg(percentage), percentile_cont(0.5) within group (order by percentage)
  into v_school_attempts, v_school_average, v_school_median
  from public.benchmark_contributions
  where publication_id = p_publication_id
    and organization_id = p_requesting_organization_id
    and is_valid = true;

  if v_ready then
    with bands(label, minimum_value, maximum_value) as (
      values
        ('0–39%', 0::numeric, 40::numeric),
        ('40–59%', 40::numeric, 60::numeric),
        ('60–74%', 60::numeric, 75::numeric),
        ('75–89%', 75::numeric, 90::numeric),
        ('90–100%', 90::numeric, 101::numeric)
    ), counts as (
      select
        bands.label,
        count(contribution.id)::integer as contribution_count
      from bands
      left join public.benchmark_contributions contribution
        on contribution.publication_id = p_publication_id
       and contribution.is_valid = true
       and contribution.percentage >= bands.minimum_value
       and contribution.percentage < bands.maximum_value
      group by bands.label, bands.minimum_value
      order by bands.minimum_value
    )
    select jsonb_agg(
      jsonb_build_object(
        'label', label,
        'count', case
          when contribution_count < v_publication.small_cell_minimum then null
          else contribution_count
        end,
        'suppressed', contribution_count < v_publication.small_cell_minimum
      )
    ) into v_distribution
    from counts;
  else
    v_distribution := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'publication_id', v_publication.id,
    'paper_version', v_publication.paper_version,
    'version_fingerprint', v_publication.version_fingerprint,
    'privacy_ready', v_ready,
    'privacy_minimum', v_publication.privacy_minimum,
    'valid_attempts', v_valid_attempts,
    'participating_schools', case when v_ready then v_school_count else null end,
    'network_average', case when v_ready then round(v_network_average, 2) else null end,
    'network_median', case when v_ready then round(v_network_median, 2) else null end,
    'school_attempts', v_school_attempts,
    'school_average', round(v_school_average, 2),
    'school_median', round(v_school_median, 2),
    'distribution', v_distribution
  );
end;
$$;

revoke all on function public.get_private_benchmark_summary(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_private_benchmark_summary(uuid, uuid) to service_role;

comment on function public.get_private_benchmark_summary(uuid, uuid) is
  'Returns the requesting school summary plus privacy-thresholded anonymous network aggregates. Intended for server-side service-role use only.';
