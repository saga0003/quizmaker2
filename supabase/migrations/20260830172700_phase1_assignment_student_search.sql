create or replace function public.search_assignment_students_v19(
  p_organization_id uuid,
  p_search text default null,
  p_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare v_result jsonb;
begin
  if not public.can_manage_v8_papers(p_organization_id) then
    raise exception 'Paper-builder permission required.' using errcode='42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id',row.student_id,
    'membership_id',row.membership_id,
    'name',row.full_name,
    'grade',row.grade,
    'section_id',row.section_id,
    'section',row.section_name,
    'academic_year',row.academic_year,
    'tracks',row.tracks,
    'roll_number',row.roll_number
  ) order by row.full_name,row.student_id),'[]'::jsonb)
  into v_result
  from (
    select membership.student_id,membership.id as membership_id,
      coalesce(profile.full_name,'Student') as full_name,
      membership.grade,membership.section_id,
      coalesce(section_row.name,membership.section,'Unassigned') as section_name,
      membership.academic_year,membership.tracks,
      coalesce(membership.metadata->>'roll_number','') as roll_number
    from public.student_school_memberships membership
    join public.profiles profile on profile.id=membership.student_id
    left join public.academic_sections section_row on section_row.id=membership.section_id
    where membership.organization_id=p_organization_id
      and membership.status::text='active'
      and (
        nullif(btrim(coalesce(p_search,'')),'') is null
        or profile.full_name ilike '%'||btrim(p_search)||'%'
        or coalesce(membership.metadata->>'roll_number','') ilike '%'||btrim(p_search)||'%'
        or coalesce(membership.section,'') ilike '%'||btrim(p_search)||'%'
      )
    order by profile.full_name,membership.student_id
    limit least(greatest(coalesce(p_limit,30),1),100)
  ) row;
  return v_result;
end;
$$;

grant execute on function public.search_assignment_students_v19(uuid,text,integer) to authenticated;
