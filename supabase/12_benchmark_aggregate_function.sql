-- Evidara V6: privacy-thresholded aggregate benchmark response.
-- This function never returns student IDs, organisation IDs, school names or response rows.

create or replace function public.get_shared_benchmark_snapshot(p_share_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_title text;
  v_version integer;
  v_minimum integer;
  v_count integer;
  v_average numeric;
  v_median numeric;
  v_distribution jsonb;
begin
  select id, title, paper_version, minimum_sample_size
  into v_id, v_title, v_version, v_minimum
  from public.shared_paper_benchmarks
  where share_token = p_share_token
    and is_active = true
    and (opens_at is null or opens_at <= now())
    and (closes_at is null or closes_at >= now());

  if v_id is null then
    return jsonb_build_object('available', false, 'reason', 'benchmark_not_available');
  end if;

  select count(*), avg(score), percentile_cont(0.5) within group (order by score)
  into v_count, v_average, v_median
  from public.benchmark_attempt_facts
  where benchmark_id = v_id and is_valid = true;

  if v_count < v_minimum then
    return jsonb_build_object(
      'available', false,
      'reason', 'privacy_minimum_not_reached',
      'valid_attempts', v_count,
      'minimum_sample_size', v_minimum,
      'paper_version', v_version
    );
  end if;

  select jsonb_agg(jsonb_build_object('band', band, 'attempts', attempts) order by sort_order)
  into v_distribution
  from (
    select 1 sort_order, '80–100%' band, count(*) attempts
      from public.benchmark_attempt_facts where benchmark_id=v_id and is_valid and score/max_marks >= .80
    union all
    select 2, '60–79%', count(*)
      from public.benchmark_attempt_facts where benchmark_id=v_id and is_valid and score/max_marks >= .60 and score/max_marks < .80
    union all
    select 3, '40–59%', count(*)
      from public.benchmark_attempt_facts where benchmark_id=v_id and is_valid and score/max_marks >= .40 and score/max_marks < .60
    union all
    select 4, 'Below 40%', count(*)
      from public.benchmark_attempt_facts where benchmark_id=v_id and is_valid and score/max_marks < .40
  ) bands;

  return jsonb_build_object(
    'available', true,
    'paper_title', v_title,
    'paper_version', v_version,
    'valid_attempts', v_count,
    'minimum_sample_size', v_minimum,
    'average_score', round(v_average, 2),
    'median_score', round(v_median, 2),
    'distribution', coalesce(v_distribution, '[]'::jsonb),
    'privacy', jsonb_build_object(
      'school_identities_disclosed', false,
      'student_identities_disclosed', false,
      'row_level_responses_disclosed', false
    )
  );
end
$$;

revoke all on function public.get_shared_benchmark_snapshot(uuid) from public;
grant execute on function public.get_shared_benchmark_snapshot(uuid) to anon, authenticated;
