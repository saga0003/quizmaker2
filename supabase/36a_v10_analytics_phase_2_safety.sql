-- Evidara V10 Analytics Phase 2 safety hardening
-- Run immediately after 36_v10_analytics_phase_2.sql.

begin;

create or replace function public.analytics_demo_section_identity_v10()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if upper(coalesce(new.code,'')) like 'DEMO-%' then
    new.name := 'Analytics Demo ' || right(upper(new.code),8);
  end if;
  return new;
end;
$$;

drop trigger if exists analytics_demo_section_identity_v10 on public.academic_sections;
create trigger analytics_demo_section_identity_v10
before insert on public.academic_sections
for each row execute function public.analytics_demo_section_identity_v10();

create or replace function public.get_teacher_analytics_dashboard_v10(
  p_section_id uuid default null,
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
  v_payload jsonb;
  v_summary jsonb;
  v_students jsonb;
begin
  v_payload := public.get_teacher_analytics_overview_v10(p_section_id,p_from,p_to);
  v_students := coalesce(v_payload->'students','[]'::jsonb);
  v_summary := coalesce(v_payload->'summary','{}'::jsonb) || jsonb_build_object(
    'needs_attention',(select count(*) from jsonb_array_elements(v_students) row where row->>'performance_status'='needs_attention'),
    'improving',(select count(*) from jsonb_array_elements(v_students) row where row->>'performance_status'='improving'),
    'strong',(select count(*) from jsonb_array_elements(v_students) row where row->>'performance_status'='strong')
  );
  return jsonb_set(v_payload,'{summary}',v_summary,true);
end;
$$;

grant execute on function public.get_teacher_analytics_dashboard_v10(uuid,date,date) to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.phase2.safety_ready','system','36a_v10_analytics_phase_2_safety',
  jsonb_build_object('batch_unique_sections',true,'distinct_student_status_counts',true));

commit;
