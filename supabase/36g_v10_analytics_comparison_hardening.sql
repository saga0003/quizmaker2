-- Evidara V10 Analytics Phase 2 — comparison engine hardening
-- Run after 36f_v10_analytics_demo_reset_safety.sql.
-- Preserves the original real-school subject benchmarks when no generated cohort exists.

begin;

create or replace function public.get_student_analytics_overview_v11(
  p_student_id uuid default auth.uid(),
  p_product_id uuid default null,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_student uuid:=coalesce(p_student_id,auth.uid());
  v_payload jsonb;
  v_summary jsonb;
  v_trends jsonb:='[]'::jsonb;
  v_subjects jsonb:='[]'::jsonb;
  v_item jsonb;
  v_snapshot jsonb;
  v_paper_ids uuid[]:='{}'::uuid[];
  v_attempted_accuracy numeric;
  v_total_questions integer;
  v_comparison record;
begin
  v_payload:=public.get_student_analytics_overview_v10(v_student,p_product_id,p_from,p_to);
  v_summary:=coalesce(v_payload->'summary','{}'::jsonb);

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'trends','[]'::jsonb))
  loop
    v_snapshot:=public.analytics_test_snapshot_v11((v_item->>'paper_id')::uuid,v_student);
    v_attempted_accuracy:=nullif(v_item->>'accuracy','')::numeric;
    v_total_questions:=coalesce((v_item->>'correct')::integer,0)
      +coalesce((v_item->>'incorrect')::integer,0)
      +coalesce((v_item->>'unanswered')::integer,0);

    v_item:=v_item||coalesce(v_snapshot,'{}'::jsonb)||jsonb_build_object(
      'attempted_accuracy',v_attempted_accuracy,
      'accuracy',round(
        100*coalesce((v_item->>'correct')::integer,0)::numeric/greatest(v_total_questions,1),
        1
      )
    );
    v_trends:=v_trends||jsonb_build_array(v_item);
    v_paper_ids:=array_append(v_paper_ids,(v_item->>'paper_id')::uuid);
  end loop;

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'subjects','[]'::jsonb))
  loop
    v_snapshot:=public.analytics_subject_snapshot_v11(v_student,v_item->>'subject_name',v_paper_ids);

    if coalesce((v_snapshot->>'cohort_size')::integer,0)>0 then
      v_item:=v_item||v_snapshot;
    end if;

    v_item:=v_item||jsonb_build_object(
      'student_accuracy',coalesce(
        nullif(v_item->>'student_accuracy','')::numeric,
        round(
          100*coalesce((v_item->>'correct')::integer,0)::numeric/
          greatest(coalesce((v_item->>'questions')::integer,0),1),
          1
        )
      ),
      'student_attempted_accuracy',coalesce(
        nullif(v_item->>'student_attempted_accuracy','')::numeric,
        round(
          100*coalesce((v_item->>'correct')::integer,0)::numeric/
          greatest(
            coalesce((v_item->>'correct')::integer,0)+coalesce((v_item->>'incorrect')::integer,0),
            1
          ),
          1
        )
      )
    );
    v_subjects:=v_subjects||jsonb_build_array(v_item);
  end loop;

  select
    max(nullif(trend->>'test_takers','')::integer) as comparison_size,
    round(avg(nullif(trend->>'percentage_average','')::numeric),1) as percentage_average,
    round(avg(nullif(trend->>'percentage_top10','')::numeric),1) as percentage_top10,
    round(avg(nullif(trend->>'percentage_top5','')::numeric),1) as percentage_top5,
    round(max(nullif(trend->>'percentage_highest','')::numeric),1) as percentage_highest,
    round(avg(nullif(trend->>'student_percentile','')::numeric),1) as student_percentile
  into v_comparison
  from jsonb_array_elements(v_trends) trend;

  v_total_questions:=coalesce((v_summary->>'correct')::integer,0)
    +coalesce((v_summary->>'incorrect')::integer,0)
    +coalesce((v_summary->>'unanswered')::integer,0);
  v_attempted_accuracy:=nullif(v_summary->>'accuracy','')::numeric;

  v_summary:=v_summary||jsonb_build_object(
    'total_questions',v_total_questions,
    'attempted_accuracy',v_attempted_accuracy,
    'accuracy',round(
      100*coalesce((v_summary->>'correct')::integer,0)::numeric/greatest(v_total_questions,1),
      1
    ),
    'cohort_size',coalesce(v_comparison.comparison_size,(v_summary->>'cohort_size')::integer),
    'comparison_average_percentage',coalesce(
      v_comparison.percentage_average,
      nullif(v_summary->>'comparison_average_percentage','')::numeric
    ),
    'top10_threshold',coalesce(
      v_comparison.percentage_top10,
      nullif(v_summary->>'top10_threshold','')::numeric
    ),
    'top5_threshold',coalesce(
      v_comparison.percentage_top5,
      nullif(v_summary->>'top5_threshold','')::numeric
    ),
    'highest_percentage',coalesce(
      v_comparison.percentage_highest,
      nullif(v_summary->>'highest_percentage','')::numeric
    ),
    'average_percentile',case
      when coalesce((v_summary->>'percentile_available')::boolean,false)
      then coalesce(v_comparison.student_percentile,nullif(v_summary->>'average_percentile','')::numeric)
      else null
    end
  );

  v_payload:=jsonb_set(v_payload,'{summary}',v_summary,true);
  v_payload:=jsonb_set(v_payload,'{trends}',v_trends,true);
  v_payload:=jsonb_set(v_payload,'{subjects}',v_subjects,true);
  return v_payload||jsonb_build_object('comparison_engine','v11-hardened');
end;
$$;

grant execute on function public.get_student_analytics_overview_v11(uuid,uuid,date,date) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.comparison_engine_hardened','system','36g_v10_analytics_comparison_hardening',
  jsonb_build_object(
    'demo_subject_comparison',true,
    'real_school_subject_fallback',true,
    'overall_accuracy_primary',true,
    'attempted_accuracy_preserved',true
  ));

commit;
