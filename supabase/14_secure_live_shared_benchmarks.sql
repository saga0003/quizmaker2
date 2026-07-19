-- Evidara V6: secure live shared-benchmark workflows.
-- Apply after 11_shared_benchmarks.sql, 12_benchmark_aggregate_function.sql and 13_metrics_segments_achievements.sql.

-- Ordinary clients must never write benchmark facts directly. Facts are derived from a completed,
-- authenticated exam attempt by record_my_shared_benchmark_attempt().
drop policy if exists "students may insert own benchmark facts" on public.benchmark_attempt_facts;
revoke insert, update, delete, truncate, references, trigger on public.benchmark_attempt_facts from anon, authenticated;

create or replace function public.list_shareable_school_papers(p_organization_id uuid)
returns table(
  id uuid,
  title text,
  exam_type text,
  duration_minutes integer,
  total_marks numeric,
  total_questions integer,
  status public.paper_status,
  access_mode public.paper_access_mode
)
language sql
stable
security definer
set search_path=public
as $$
  select p.id,p.title,p.exam_type,p.duration_minutes,p.total_marks,p.total_questions,p.status,p.access_mode
  from public.question_papers p
  where p.organization_id=p_organization_id
    and p.status='published'
    and public.is_school_manager(p_organization_id)
  order by p.updated_at desc,p.title;
$$;
grant execute on function public.list_shareable_school_papers(uuid) to authenticated;

create or replace function public.ensure_school_shared_benchmark(p_paper_id uuid)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_paper public.question_papers%rowtype;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  select * into v_paper from public.question_papers where id=p_paper_id;
  if v_paper.id is null then raise exception 'Question paper not found.'; end if;
  if v_paper.organization_id is null then raise exception 'A school-owned paper is required.'; end if;
  if not public.is_school_manager(v_paper.organization_id) then raise exception 'School manager permission required.'; end if;
  if v_paper.status<>'published' then raise exception 'Publish the paper before sharing it.'; end if;

  insert into public.shared_paper_benchmarks(
    paper_id,owner_organization_id,paper_version,title,is_active,minimum_sample_size,opens_at,closes_at,created_by,updated_at
  ) values(
    v_paper.id,v_paper.organization_id,1,v_paper.title,true,20,v_paper.available_from,v_paper.available_until,auth.uid(),now()
  )
  on conflict(paper_id,paper_version) do update set
    title=excluded.title,
    opens_at=excluded.opens_at,
    closes_at=excluded.closes_at,
    updated_at=now()
  returning id into v_id;

  return v_id;
end;
$$;
grant execute on function public.ensure_school_shared_benchmark(uuid) to authenticated;

create or replace function public.set_shared_benchmark_active(p_benchmark_id uuid,p_is_active boolean)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare v_org uuid;
begin
  select owner_organization_id into v_org from public.shared_paper_benchmarks where id=p_benchmark_id for update;
  if v_org is null then raise exception 'Shared benchmark not found.'; end if;
  if not public.is_school_manager(v_org) then raise exception 'School manager permission required.'; end if;
  update public.shared_paper_benchmarks set is_active=p_is_active,updated_at=now() where id=p_benchmark_id;
  return p_is_active;
end;
$$;
grant execute on function public.set_shared_benchmark_active(uuid,boolean) to authenticated;

create or replace function public.list_school_shared_benchmarks(p_organization_id uuid)
returns table(
  id uuid,
  paper_id uuid,
  title text,
  share_token uuid,
  paper_version integer,
  is_active boolean,
  minimum_sample_size integer,
  opens_at timestamptz,
  closes_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path=public
as $$
  select b.id,b.paper_id,b.title,b.share_token,b.paper_version,b.is_active,b.minimum_sample_size,b.opens_at,b.closes_at,b.created_at
  from public.shared_paper_benchmarks b
  where b.owner_organization_id=p_organization_id
    and public.is_school_manager(p_organization_id)
  order by b.updated_at desc,b.created_at desc;
$$;
grant execute on function public.list_school_shared_benchmarks(uuid) to authenticated;

create or replace function public.get_shared_benchmark_landing(p_share_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_benchmark public.shared_paper_benchmarks%rowtype;
  v_paper public.question_papers%rowtype;
  v_snapshot jsonb;
begin
  select * into v_benchmark
  from public.shared_paper_benchmarks
  where share_token=p_share_token
    and is_active=true
    and (opens_at is null or opens_at<=now())
    and (closes_at is null or closes_at>=now());

  if v_benchmark.id is null then
    return jsonb_build_object('available',false,'reason','benchmark_not_available');
  end if;

  select * into v_paper from public.question_papers where id=v_benchmark.paper_id and status='published';
  if v_paper.id is null then
    return jsonb_build_object('available',false,'reason','paper_not_available');
  end if;

  v_snapshot:=public.get_shared_benchmark_snapshot(p_share_token);
  return jsonb_build_object(
    'available',true,
    'benchmark_id',v_benchmark.id,
    'share_token',v_benchmark.share_token,
    'paper_id',v_paper.id,
    'paper_title',v_benchmark.title,
    'paper_version',v_benchmark.paper_version,
    'exam_type',v_paper.exam_type,
    'duration_minutes',v_paper.duration_minutes,
    'total_marks',v_paper.total_marks,
    'total_questions',v_paper.total_questions,
    'opens_at',v_benchmark.opens_at,
    'closes_at',v_benchmark.closes_at,
    'minimum_sample_size',v_benchmark.minimum_sample_size,
    'snapshot',v_snapshot,
    'privacy',jsonb_build_object(
      'school_identity_disclosed',false,
      'student_identity_disclosed',false,
      'individual_response_disclosed',false
    )
  );
end;
$$;
revoke all on function public.get_shared_benchmark_landing(uuid) from public;
grant execute on function public.get_shared_benchmark_landing(uuid) to anon,authenticated;

create or replace function public.start_shared_benchmark_attempt(p_share_token uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_benchmark public.shared_paper_benchmarks%rowtype;
  v_attempt uuid;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  select * into v_benchmark
  from public.shared_paper_benchmarks
  where share_token=p_share_token
    and is_active=true
    and (opens_at is null or opens_at<=now())
    and (closes_at is null or closes_at>=now());
  if v_benchmark.id is null then raise exception 'This shared assessment is not currently available.'; end if;

  select public.start_exam_attempt(v_benchmark.paper_id,null) into v_attempt;
  return jsonb_build_object('attempt_id',v_attempt,'benchmark_id',v_benchmark.id,'paper_id',v_benchmark.paper_id);
end;
$$;
grant execute on function public.start_shared_benchmark_attempt(uuid) to authenticated;

create or replace function public.record_my_shared_benchmark_attempt(p_benchmark_id uuid,p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare
  v_benchmark public.shared_paper_benchmarks%rowtype;
  v_result record;
  v_org uuid;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  select * into v_benchmark from public.shared_paper_benchmarks where id=p_benchmark_id;
  if v_benchmark.id is null then raise exception 'Shared benchmark not found.'; end if;

  select r.* into v_result
  from public.list_my_attempt_results() r
  where r.attempt_id=p_attempt_id
    and r.paper_id=v_benchmark.paper_id
    and r.submitted_at is not null
  limit 1;

  if v_result.attempt_id is null then
    raise exception 'A completed attempt on this exact paper version is required.';
  end if;

  select m.organization_id into v_org
  from public.student_school_memberships m
  where m.student_id=auth.uid() and m.status='active'
  order by m.updated_at desc limit 1;

  insert into public.benchmark_attempt_facts(
    benchmark_id,attempt_key,student_id,organization_id,score,max_marks,accuracy,duration_seconds,is_valid,invalid_reason,submitted_at
  ) values(
    v_benchmark.id,p_attempt_id::text,auth.uid(),v_org,v_result.score,v_result.maximum_marks,v_result.percentage,null,true,null,v_result.submitted_at
  )
  on conflict(benchmark_id,attempt_key) do update set
    score=excluded.score,
    max_marks=excluded.max_marks,
    accuracy=excluded.accuracy,
    organization_id=excluded.organization_id,
    is_valid=true,
    invalid_reason=null,
    submitted_at=excluded.submitted_at;

  return true;
end;
$$;
revoke all on function public.record_my_shared_benchmark_attempt(uuid,uuid) from public;
grant execute on function public.record_my_shared_benchmark_attempt(uuid,uuid) to authenticated;

create or replace function public.get_school_shared_benchmark_snapshot(p_benchmark_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_benchmark public.shared_paper_benchmarks%rowtype;
  v_total integer;
  v_school_count integer;
  v_avg numeric;
  v_median numeric;
  v_school_avg numeric;
  v_percentile numeric;
  v_distribution jsonb;
begin
  select * into v_benchmark from public.shared_paper_benchmarks where id=p_benchmark_id;
  if v_benchmark.id is null then raise exception 'Shared benchmark not found.'; end if;
  if not public.is_school_manager(v_benchmark.owner_organization_id) then raise exception 'School manager permission required.'; end if;

  select count(*),avg(score/max_marks*100),percentile_cont(.5) within group(order by score/max_marks*100)
  into v_total,v_avg,v_median
  from public.benchmark_attempt_facts where benchmark_id=v_benchmark.id and is_valid;

  select count(*),avg(score/max_marks*100)
  into v_school_count,v_school_avg
  from public.benchmark_attempt_facts
  where benchmark_id=v_benchmark.id and is_valid and organization_id=v_benchmark.owner_organization_id;

  if v_total>0 and v_school_avg is not null then
    select round(100.0*count(*)/v_total,1) into v_percentile
    from public.benchmark_attempt_facts
    where benchmark_id=v_benchmark.id and is_valid and score/max_marks*100<=v_school_avg;
  end if;

  select jsonb_agg(jsonb_build_object('band',band,'attempts',attempts) order by sort_order)
  into v_distribution from(
    select 1 sort_order,'80–100%' band,count(*) attempts from public.benchmark_attempt_facts where benchmark_id=v_benchmark.id and is_valid and score/max_marks>=.8
    union all select 2,'60–79%',count(*) from public.benchmark_attempt_facts where benchmark_id=v_benchmark.id and is_valid and score/max_marks>=.6 and score/max_marks<.8
    union all select 3,'40–59%',count(*) from public.benchmark_attempt_facts where benchmark_id=v_benchmark.id and is_valid and score/max_marks>=.4 and score/max_marks<.6
    union all select 4,'Below 40%',count(*) from public.benchmark_attempt_facts where benchmark_id=v_benchmark.id and is_valid and score/max_marks<.4
  ) bands;

  return jsonb_build_object(
    'available',v_total>=v_benchmark.minimum_sample_size,
    'reason',case when v_total<v_benchmark.minimum_sample_size then 'privacy_minimum_not_reached' else null end,
    'paper_title',v_benchmark.title,
    'paper_version',v_benchmark.paper_version,
    'valid_attempts',v_total,
    'minimum_sample_size',v_benchmark.minimum_sample_size,
    'average_percentage',case when v_total>=v_benchmark.minimum_sample_size then round(v_avg,2) else null end,
    'median_percentage',case when v_total>=v_benchmark.minimum_sample_size then round(v_median,2) else null end,
    'distribution',case when v_total>=v_benchmark.minimum_sample_size then coalesce(v_distribution,'[]'::jsonb) else '[]'::jsonb end,
    'school_attempts',v_school_count,
    'school_average_percentage',case when v_school_count>0 then round(v_school_avg,2) else null end,
    'school_cohort_percentile',case when v_total>=v_benchmark.minimum_sample_size then v_percentile else null end,
    'privacy',jsonb_build_object('school_identities_disclosed',false,'student_identities_disclosed',false,'row_level_responses_disclosed',false)
  );
end;
$$;
grant execute on function public.get_school_shared_benchmark_snapshot(uuid) to authenticated;

create or replace function public.list_school_benchmark_students(p_benchmark_id uuid)
returns table(
  student_id uuid,
  student_name text,
  grade text,
  score numeric,
  maximum_marks numeric,
  percentage numeric,
  percentile numeric,
  submitted_at timestamptz,
  segment_label text
)
language sql
stable
security definer
set search_path=public
as $$
  with benchmark as(
    select * from public.shared_paper_benchmarks where id=p_benchmark_id
  ), valid as(
    select f.*,round(f.score/f.max_marks*100,2) percentage
    from public.benchmark_attempt_facts f join benchmark b on b.id=f.benchmark_id
    where f.is_valid
  )
  select
    own.student_id,
    coalesce(p.full_name,p.username,'Student') student_name,
    trim(concat(m.grade,case when nullif(m.section,'') is null then '' else '-'||m.section end)) grade,
    own.score,
    own.max_marks maximum_marks,
    own.percentage,
    round(100.0*(select count(*) from valid all_rows where all_rows.percentage<=own.percentage)/nullif((select count(*) from valid),0),1) percentile,
    own.submitted_at,
    coalesce(seg.segment_label,'Not enough evidence') segment_label
  from valid own
  join benchmark b on b.id=own.benchmark_id
  left join public.profiles p on p.id=own.student_id
  left join lateral(
    select sm.grade,sm.section from public.student_school_memberships sm
    where sm.organization_id=b.owner_organization_id and sm.student_id=own.student_id
    order by sm.updated_at desc limit 1
  ) m on true
  left join lateral(
    select s.segment_label from public.student_segment_snapshots s
    where s.student_id=own.student_id and s.organization_id=b.owner_organization_id and s.superseded_at is null
    order by s.calculated_at desc limit 1
  ) seg on true
  where own.organization_id=b.owner_organization_id
    and public.is_school_manager(b.owner_organization_id)
  order by own.score desc,own.submitted_at desc;
$$;
grant execute on function public.list_school_benchmark_students(uuid) to authenticated;

comment on function public.record_my_shared_benchmark_attempt(uuid,uuid) is
  'Trusted benchmark fact recorder. Derives marks and validity from the authenticated student completed attempt; never accepts client-provided scores.';
