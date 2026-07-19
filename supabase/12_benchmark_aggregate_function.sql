-- Evidara V6.5/V6.6: server-only aggregate function.
-- The comparison pool excludes the requesting school and remains hidden until
-- both the minimum external-attempt and external-school thresholds are met.

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
  v_external_attempts integer := 0;
  v_external_school_count integer := 0;
  v_network_average numeric;
  v_network_median numeric;
  v_school_attempts integer := 0;
  v_school_average numeric;
  v_school_median numeric;
  v_school_percentile numeric;
  v_distribution jsonb := '[]'::jsonb;
  v_ready boolean := false;
  v_invalid_attempts integer := 0;
begin
  select * into v_publication
  from public.benchmark_publications
  where id = p_publication_id;

  if not found then
    raise exception 'Benchmark publication not found.';
  end if;

  select count(*), count(distinct organization_id), avg(percentage),
         percentile_cont(0.5) within group (order by percentage)
  into v_external_attempts, v_external_school_count, v_network_average, v_network_median
  from public.benchmark_contributions
  where publication_id = p_publication_id
    and organization_id <> p_requesting_organization_id
    and is_valid = true;

  v_ready := v_external_attempts >= v_publication.privacy_minimum
    and v_external_school_count >= v_publication.privacy_minimum_schools;

  select count(*), avg(percentage), percentile_cont(0.5) within group (order by percentage)
  into v_school_attempts, v_school_average, v_school_median
  from public.benchmark_contributions
  where publication_id = p_publication_id
    and organization_id = p_requesting_organization_id
    and is_valid = true;

  select count(*) into v_invalid_attempts
  from public.benchmark_contributions
  where publication_id = p_publication_id
    and organization_id = p_requesting_organization_id
    and is_valid = false;

  if v_ready and v_school_average is not null then
    select round(
      (100.0 * count(*) filter (where percentage <= v_school_average)) / nullif(count(*), 0),
      2
    ) into v_school_percentile
    from public.benchmark_contributions
    where publication_id = p_publication_id
      and organization_id <> p_requesting_organization_id
      and is_valid = true;

    with bands(label, minimum_value, maximum_value, display_order) as (
      values
        ('0–39%', 0::numeric, 40::numeric, 1),
        ('40–59%', 40::numeric, 60::numeric, 2),
        ('60–74%', 60::numeric, 75::numeric, 3),
        ('75–89%', 75::numeric, 90::numeric, 4),
        ('90–100%', 90::numeric, 101::numeric, 5)
    ), counts as (
      select
        bands.label,
        bands.display_order,
        count(contribution.id)::integer as contribution_count
      from bands
      left join public.benchmark_contributions contribution
        on contribution.publication_id = p_publication_id
       and contribution.organization_id <> p_requesting_organization_id
       and contribution.is_valid = true
       and contribution.percentage >= bands.minimum_value
       and contribution.percentage < bands.maximum_value
      group by bands.label, bands.display_order
      order by bands.display_order
    )
    select jsonb_agg(
      jsonb_build_object(
        'label', label,
        'count', case
          when contribution_count < v_publication.small_cell_minimum then null
          else contribution_count
        end,
        'suppressed', contribution_count < v_publication.small_cell_minimum
      ) order by display_order
    ) into v_distribution
    from counts;
  end if;

  return jsonb_build_object(
    'publication_id', v_publication.id,
    'paper_id', v_publication.paper_id,
    'title', v_publication.title,
    'paper_version', v_publication.paper_version,
    'version_fingerprint', v_publication.version_fingerprint,
    'status', v_publication.status,
    'privacy_ready', v_ready,
    'privacy_minimum', v_publication.privacy_minimum,
    'privacy_minimum_schools', v_publication.privacy_minimum_schools,
    'external_valid_attempts', v_external_attempts,
    'external_participating_schools', case when v_ready then v_external_school_count else null end,
    'network_average', case when v_ready then round(v_network_average, 2) else null end,
    'network_median', case when v_ready then round(v_network_median, 2) else null end,
    'school_attempts', v_school_attempts,
    'school_invalid_attempts', v_invalid_attempts,
    'school_average', round(v_school_average, 2),
    'school_median', round(v_school_median, 2),
    'school_percentile', case when v_ready then v_school_percentile else null end,
    'distribution', case when v_ready then coalesce(v_distribution, '[]'::jsonb) else '[]'::jsonb end
  );
end;
$$;

revoke all on function public.get_private_benchmark_summary(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_private_benchmark_summary(uuid, uuid) to service_role;

comment on function public.get_private_benchmark_summary(uuid, uuid) is
  'Returns the requesting school summary plus an external, privacy-thresholded anonymous comparison pool.';
