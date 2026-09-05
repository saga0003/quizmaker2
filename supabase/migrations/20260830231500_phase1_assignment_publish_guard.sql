begin;

create or replace function public.phase1_require_assigned_audience_v19()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.organization_id is null or new.status <> 'published'::public.paper_status then
    return new;
  end if;

  -- Existing already-published institutional papers retain their historical
  -- audience semantics until an administrator explicitly reassigns them.
  if tg_op = 'UPDATE' and old.status = 'published'::public.paper_status then
    return new;
  end if;

  -- A newly created institutional paper must first be saved as draft/approved,
  -- assigned to an explicit materialized cohort, and only then published.
  if tg_op = 'INSERT' then
    raise exception 'Save this institutional paper before publishing, assign its student audience, then publish it.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.paper_assignment_profiles profile
    where profile.paper_id = new.id
      and profile.organization_id = new.organization_id
  ) then
    raise exception 'Assign this test to students before publishing it.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.paper_student_assignments assignment
    where assignment.paper_id = new.id
      and assignment.organization_id = new.organization_id
      and assignment.status = 'assigned'
  ) then
    raise exception 'This test assignment has no eligible students. Preview and assign at least one active student before publishing.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function public.phase1_require_assigned_audience_v19() from public, anon, authenticated;
grant execute on function public.phase1_require_assigned_audience_v19() to service_role;

drop trigger if exists trg_phase1_require_assigned_audience_v19 on public.question_papers;
create trigger trg_phase1_require_assigned_audience_v19
before insert or update of status on public.question_papers
for each row execute function public.phase1_require_assigned_audience_v19();

commit;
