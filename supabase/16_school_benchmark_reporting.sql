-- Evidara V6: private school view and privacy-thresholded wider aggregate.

create or replace function public.get_school_shared_benchmark_snapshot(p_benchmark_id uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare b public.shared_paper_benchmarks%rowtype;v_total integer;v_school_count integer;v_avg numeric;v_median numeric;v_school_avg numeric;v_percentile numeric;v_distribution jsonb;
begin
 select * into b from public.shared_paper_benchmarks where id=p_benchmark_id;
 if b.id is null then raise exception 'Shared benchmark not found.';end if;
 if not public.is_school_manager(b.owner_organization_id) then raise exception 'School manager permission required.';end if;
 select count(*),avg(score/max_marks*100),percentile_cont(.5) within group(order by score/max_marks*100) into v_total,v_avg,v_median from public.benchmark_attempt_facts where benchmark_id=b.id and is_valid;
 select count(*),avg(score/max_marks*100) into v_school_count,v_school_avg from public.benchmark_attempt_facts where benchmark_id=b.id and is_valid and organization_id=b.owner_organization_id;
 if v_total>0 and v_school_avg is not null then select round(100.0*count(*)/v_total,1) into v_percentile from public.benchmark_attempt_facts where benchmark_id=b.id and is_valid and score/max_marks*100<=v_school_avg;end if;
 select jsonb_agg(jsonb_build_object('band',band,'attempts',attempts) order by n) into v_distribution from(
  select 1 n,'80–100%' band,count(*) attempts from public.benchmark_attempt_facts where benchmark_id=b.id and is_valid and score/max_marks>=.8
  union all select 2,'60–79%',count(*) from public.benchmark_attempt_facts where benchmark_id=b.id and is_valid and score/max_marks>=.6 and score/max_marks<.8
  union all select 3,'40–59%',count(*) from public.benchmark_attempt_facts where benchmark_id=b.id and is_valid and score/max_marks>=.4 and score/max_marks<.6
  union all select 4,'Below 40%',count(*) from public.benchmark_attempt_facts where benchmark_id=b.id and is_valid and score/max_marks<.4
 ) bands;
 return jsonb_build_object('available',v_total>=b.minimum_sample_size,'reason',case when v_total<b.minimum_sample_size then 'privacy_minimum_not_reached' else null end,'paper_title',b.title,'paper_version',b.paper_version,'valid_attempts',v_total,'minimum_sample_size',b.minimum_sample_size,'average_percentage',case when v_total>=b.minimum_sample_size then round(v_avg,2) else null end,'median_percentage',case when v_total>=b.minimum_sample_size then round(v_median,2) else null end,'distribution',case when v_total>=b.minimum_sample_size then coalesce(v_distribution,'[]'::jsonb) else '[]'::jsonb end,'school_attempts',v_school_count,'school_average_percentage',case when v_school_count>0 then round(v_school_avg,2) else null end,'school_cohort_percentile',case when v_total>=b.minimum_sample_size then v_percentile else null end,'privacy',jsonb_build_object('school_identities_disclosed',false,'student_identities_disclosed',false,'row_level_responses_disclosed',false));
end;
$$;
grant execute on function public.get_school_shared_benchmark_snapshot(uuid) to authenticated;

create or replace function public.list_school_benchmark_students(p_benchmark_id uuid)
returns table(student_id uuid,student_name text,grade text,score numeric,maximum_marks numeric,percentage numeric,percentile numeric,submitted_at timestamptz,segment_label text)
language sql stable security definer set search_path=public as $$
 with benchmark as(select * from public.shared_paper_benchmarks where id=p_benchmark_id),valid as(select f.*,round(f.score/f.max_marks*100,2) percentage from public.benchmark_attempt_facts f join benchmark b on b.id=f.benchmark_id where f.is_valid)
 select own.student_id,coalesce(p.full_name,p.username,'Student'),trim(concat(m.grade,case when nullif(m.section,'') is null then '' else '-'||m.section end)),own.score,own.max_marks,own.percentage,round(100.0*(select count(*) from valid x where x.percentage<=own.percentage)/nullif((select count(*) from valid),0),1),own.submitted_at,coalesce(seg.segment_label,'Not enough evidence')
 from valid own join benchmark b on b.id=own.benchmark_id left join public.profiles p on p.id=own.student_id
 left join lateral(select sm.grade,sm.section from public.student_school_memberships sm where sm.organization_id=b.owner_organization_id and sm.student_id=own.student_id order by sm.updated_at desc limit 1)m on true
 left join lateral(select s.segment_label from public.student_segment_snapshots s where s.student_id=own.student_id and s.organization_id=b.owner_organization_id and s.superseded_at is null order by s.calculated_at desc limit 1)seg on true
 where own.organization_id=b.owner_organization_id and public.is_school_manager(b.owner_organization_id)
 order by own.score desc,own.submitted_at desc
$$;
grant execute on function public.list_school_benchmark_students(uuid) to authenticated;
