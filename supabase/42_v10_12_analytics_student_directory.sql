-- Evidara v10.12 — role-aware analytics student directory
-- Run after 41_v10_11_analytics_mapping_and_pdf_hotfix.sql.

begin;

create or replace function public.list_analytics_students_v10_12()
returns jsonb
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_scope jsonb;
  v_student jsonb;
  v_overview jsonb;
  v_rows jsonb := '[]'::jsonb;
  v_index integer := 0;
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;
  v_scope := public.list_analytics_scope_v10();

  for v_student in
    select value from jsonb_array_elements(coalesce(v_scope->'students','[]'::jsonb))
  loop
    v_index := v_index + 1;
    begin
      v_overview := public.get_student_analytics_overview_v11(
        (v_student->>'student_id')::uuid,
        null,
        null,
        null
      );
    exception when others then
      v_overview := '{}'::jsonb;
    end;

    v_rows := v_rows || jsonb_build_array(jsonb_build_object(
      'sl', v_index,
      'student_id', v_student->>'student_id',
      'student_name', coalesce(v_student->>'full_name','Student'),
      'school_name', coalesce(v_overview#>>'{student,organization_name}','Unassigned school'),
      'grade', nullif(v_student->>'grade','')::integer,
      'section', coalesce(v_student->>'section_name','Unassigned'),
      'average_percentage', nullif(v_overview#>>'{summary,average_percentage}','')::numeric,
      'average_percentile', case
        when coalesce((v_overview#>>'{summary,percentile_available}')::boolean,false)
          then nullif(v_overview#>>'{summary,average_percentile}','')::numeric
        else null
      end,
      'completed_tests', coalesce(nullif(v_overview#>>'{summary,completed_tests}','')::integer,0),
      'viewer_role', v_scope->>'viewer_role'
    ));
  end loop;

  return jsonb_build_object(
    'viewer_role', v_scope->>'viewer_role',
    'students', v_rows,
    'generated_at', now()
  );
end;
$$;

grant execute on function public.list_analytics_students_v10_12() to authenticated;

insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
values(null,'analytics.v10.12.student_directory_ready','system','42_v10_12_analytics_student_directory',jsonb_build_object('sortable_directory',true,'role_scoped',true));

commit;
