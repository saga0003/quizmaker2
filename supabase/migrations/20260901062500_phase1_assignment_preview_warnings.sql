-- Phase 1 D4: exact assignment preview with server-authoritative eligibility warnings.

create or replace function public.preview_paper_assignment_v19(
  p_paper_id uuid,
  p_audience jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_org uuid := public.paper_assignment_org_v19(p_paper_id);
  v_year text := nullif(btrim(coalesce(p_audience->>'academic_year','')), '');
  v_grades integer[] := '{}';
  v_sections uuid[] := '{}';
  v_tracks text[] := '{}';
  v_students uuid[] := '{}';
  v_count integer := 0;
  v_limit integer := 0;
  v_active_count integer := 0;
  v_sample jsonb := '[]'::jsonb;
  v_suspended integer := 0;
  v_withdrawn integer := 0;
  v_completed integer := 0;
  v_selected_unavailable integer := 0;
  v_license_state text;
  v_warnings jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(coalesce(p_audience->'grades','[]'::jsonb))='array' then
    select coalesce(array_agg(value::integer),'{}'::integer[]) into v_grades
    from jsonb_array_elements_text(coalesce(p_audience->'grades','[]'::jsonb));
  end if;
  if jsonb_typeof(coalesce(p_audience->'section_ids','[]'::jsonb))='array' then
    select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_sections
    from jsonb_array_elements_text(coalesce(p_audience->'section_ids','[]'::jsonb));
  end if;
  if jsonb_typeof(coalesce(p_audience->'tracks','[]'::jsonb))='array' then
    select coalesce(array_agg(btrim(value)) filter(where btrim(value)<>''),'{}'::text[]) into v_tracks
    from jsonb_array_elements_text(coalesce(p_audience->'tracks','[]'::jsonb));
  end if;
  if jsonb_typeof(coalesce(p_audience->'student_ids','[]'::jsonb))='array' then
    select coalesce(array_agg(value::uuid),'{}'::uuid[]) into v_students
    from jsonb_array_elements_text(coalesce(p_audience->'student_ids','[]'::jsonb));
  end if;

  with scoped as (
    select membership.*,
      coalesce(profile.full_name,'Student') as full_name,
      coalesce(section_row.name,membership.section,'Unassigned') as section_name
    from public.student_school_memberships membership
    left join public.profiles profile on profile.id=membership.student_id
    left join public.academic_sections section_row on section_row.id=membership.section_id
    where membership.organization_id=v_org
      and (v_year is null or membership.academic_year=v_year)
      and (cardinality(v_grades)=0 or membership.grade=any(v_grades))
      and (cardinality(v_sections)=0 or membership.section_id=any(v_sections))
      and (cardinality(v_tracks)=0 or membership.tracks && v_tracks)
      and (cardinality(v_students)=0 or membership.student_id=any(v_students))
  ), eligible as (
    select * from scoped where status::text='active'
  ), ranked as (
    select eligible.*, row_number() over(order by full_name,student_id) as sample_rank from eligible
  )
  select
    (select count(*)::integer from eligible),
    coalesce((select jsonb_agg(jsonb_build_object(
      'student_id',student_id,'membership_id',id,'name',full_name,'grade',grade,
      'section',section_name,'academic_year',academic_year,'tracks',tracks
    ) order by full_name) from ranked where sample_rank<=10),'[]'::jsonb),
    (select count(*)::integer from scoped where status::text='suspended'),
    (select count(*)::integer from scoped where status::text='withdrawn'),
    (select count(*)::integer from scoped where status::text='completed')
  into v_count,v_sample,v_suspended,v_withdrawn,v_completed;

  if cardinality(v_students)>0 then
    select greatest(cardinality(v_students)-count(distinct membership.student_id)::integer,0)
    into v_selected_unavailable
    from public.student_school_memberships membership
    where membership.organization_id=v_org
      and membership.status::text='active'
      and membership.student_id=any(v_students)
      and (v_year is null or membership.academic_year=v_year)
      and (cardinality(v_grades)=0 or membership.grade=any(v_grades))
      and (cardinality(v_sections)=0 or membership.section_id=any(v_sections))
      and (cardinality(v_tracks)=0 or membership.tracks && v_tracks);
  end if;

  select coalesce(s.seat_limit,0) into v_limit
  from public.school_subscriptions s
  where s.organization_id=v_org
  order by s.ends_at desc,s.created_at desc
  limit 1;
  select count(*)::integer into v_active_count
  from public.student_school_memberships m
  where m.organization_id=v_org and m.status::text='active';
  v_license_state := public.school_license_state_v19(v_org,current_date);

  if coalesce(v_count,0)=0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','no_eligible_students','severity','blocking','count',0,
      'message','No active students match this audience.'
    ));
  end if;
  if v_license_state not in ('active','grace') then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','licence_unavailable','severity','blocking','count',v_active_count,
      'message','The institution licence is not active for new test assignment.'
    ));
  elsif v_limit>0 and v_active_count>=v_limit then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','licence_at_capacity','severity','warning','count',v_active_count,
      'message','The institution is at its licensed active-student capacity.'
    ));
  end if;
  if v_suspended>0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','suspended_students_excluded','severity','warning','count',v_suspended,
      'message',format('%s suspended student(s) match the filters and are excluded.',v_suspended)
    ));
  end if;
  if v_withdrawn>0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','withdrawn_students_excluded','severity','warning','count',v_withdrawn,
      'message',format('%s withdrawn student(s) match the filters and are excluded.',v_withdrawn)
    ));
  end if;
  if v_completed>0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','completed_students_excluded','severity','warning','count',v_completed,
      'message',format('%s completed student membership(s) match the filters and are excluded.',v_completed)
    ));
  end if;
  if v_selected_unavailable>0 then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','selected_students_unavailable','severity','blocking','count',v_selected_unavailable,
      'message',format('%s specifically selected student(s) do not have active access for these filters.',v_selected_unavailable)
    ));
  end if;
  if exists(select 1 from public.exam_attempts where paper_id=p_paper_id) then
    v_warnings := v_warnings || jsonb_build_array(jsonb_build_object(
      'code','cohort_frozen','severity','blocking','count',1,
      'message','This paper already has attempts. Its assigned cohort is frozen; clone the paper for a different audience.'
    ));
  end if;

  return jsonb_build_object(
    'paper_id',p_paper_id,
    'organization_id',v_org,
    'audience',jsonb_build_object(
      'academic_year',v_year,'grades',to_jsonb(v_grades),'section_ids',to_jsonb(v_sections),
      'tracks',to_jsonb(v_tracks),'student_ids',to_jsonb(v_students)
    ),
    'assigned_count',coalesce(v_count,0),
    'sample',coalesce(v_sample,'[]'::jsonb),
    'warnings',v_warnings,
    'licence',jsonb_build_object(
      'state',v_license_state,'licensed_students',coalesce(v_limit,0),'active_students',coalesce(v_active_count,0)
    )
  );
end;
$function$;

comment on function public.preview_paper_assignment_v19(uuid,jsonb) is
  'D4 server-authoritative assignment preview: exact active-student count, bounded sample, licence state, and explicit eligibility/exclusion warnings.';
