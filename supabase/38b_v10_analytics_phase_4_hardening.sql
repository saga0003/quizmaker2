-- Evidara V10 Analytics Phase 4 — final payload hardening
-- Run after 38a_v10_analytics_phase_4_engine.sql.

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
  v_time jsonb;
  v_average numeric;
  v_complete boolean;
begin
  v_payload:=public.get_student_analytics_overview_base_v12(v_student,p_product_id,p_from,p_to);
  v_summary:=coalesce(v_payload->'summary','{}'::jsonb);
  v_complete:=p_product_id is null or coalesce((v_summary->>'percentile_available')::boolean,false);

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'trends','[]'::jsonb)) loop
    v_time:=public.analytics_attempt_time_snapshot_v12((v_item->>'paper_id')::uuid,v_student);
    if v_time is not null then
      v_item:=v_item||jsonb_build_object(
        'time_score',(v_time->>'score')::numeric,
        'time_rating',v_time->>'rating',
        'time_duration_minutes',(v_time->>'duration_minutes')::integer,
        'time_used_minutes',(v_time->>'actual_time_minutes')::numeric,
        'ended_automatically',(v_time->>'ended_automatically')::boolean,
        'time_insight',v_time->>'insight'
      );
    end if;
    v_trends:=v_trends||jsonb_build_array(v_item);
  end loop;

  select round(avg((item->>'time_score')::numeric),1) into v_average
  from jsonb_array_elements(v_trends) item
  where nullif(item->>'time_score','') is not null;

  for v_item in select value from jsonb_array_elements(coalesce(v_payload->'subjects','[]'::jsonb)) loop
    if p_product_id is not null and not v_complete then
      v_item:=v_item-array['student_time_score','average_time_score','lowest_time_score','highest_time_score','top10_time_score','top5_time_score']::text[];
      v_item:=v_item||jsonb_build_object(
        'time_score_available',false,
        'time_score_lock_reason','Complete every compulsory test in the selected series.'
      );
    else
      v_item:=v_item||jsonb_build_object('time_score_available',true);
    end if;
    v_subjects:=v_subjects||jsonb_build_array(v_item);
  end loop;

  v_summary:=v_summary||jsonb_build_object(
    'time_score',case when v_complete then v_average else null end,
    'time_score_available',v_complete,
    'time_score_rating',case when v_complete and v_average is not null then public.analytics_time_management_rating_v12(v_average) end,
    'time_score_supporting_indicator',true,
    'time_score_scientific_measurement',false,
    'time_score_formula','50% completion + 30% answered-question accuracy + 20% time control',
    'time_score_lock_reason',case when not v_complete then 'Complete all compulsory tests in the selected series to display the overall score.' end
  );

  return jsonb_set(
    jsonb_set(
      jsonb_set(v_payload,'{summary}',v_summary,true),
      '{trends}',v_trends,true
    ),
    '{subjects}',v_subjects,true
  )||jsonb_build_object('time_management_engine','v12-simple-hardened');
end;
$$;

grant execute on function public.get_student_analytics_overview_v11(uuid,uuid,date,date) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.phase4.hardened','system','38b_v10_analytics_phase_4_hardening',jsonb_build_object('subject_time_lock',true,'idempotent_payload',true));

commit;
