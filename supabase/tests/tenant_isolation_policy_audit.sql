-- Evidara Phase 1 A2: production-safe tenant-isolation policy audit.
-- This file is intentionally read-only. It inspects installed RLS/function
-- definitions and raises if a future migration removes an institution boundary.

do $$
declare
  v_text text;
begin
  -- Student memberships: students see themselves; school staff must be scoped
  -- through the membership's organization/section.
  select string_agg(coalesce(qual, '') || ' ' || coalesce(with_check, ''), E'\n')
  into v_text
  from pg_policies
  where schemaname = 'public' and tablename = 'student_school_memberships';
  if v_text is null
     or position('student_id = auth.uid()' in v_text) = 0
     or position('is_evidara_school_manager(organization_id)' in v_text) = 0
     or position('is_evidara_teacher_for_section(organization_id, section_id)' in v_text) = 0 then
    raise exception 'A2 FAILED: student membership RLS lost student/org/section isolation.';
  end if;

  -- Institution-owned questions must use the row organization for manager
  -- access; teachers are limited to their own rows until the collaboration
  -- model is deliberately expanded under C7.
  select string_agg(coalesce(qual, '') || ' ' || coalesce(with_check, ''), E'\n')
  into v_text
  from pg_policies
  where schemaname = 'public' and tablename = 'questions';
  if v_text is null
     or position('is_evidara_school_manager(organization_id)' in v_text) = 0
     or position('created_by = auth.uid()' in v_text) = 0 then
    raise exception 'A2 FAILED: question RLS lost organization/creator isolation.';
  end if;

  -- Papers must remain scoped by the paper row's organization, with student
  -- institutional reads tied to an active membership in that same organization.
  select string_agg(coalesce(qual, '') || ' ' || coalesce(with_check, ''), E'\n')
  into v_text
  from pg_policies
  where schemaname = 'public' and tablename = 'question_papers';
  if v_text is null
     or position('is_evidara_school_manager(organization_id)' in v_text) = 0
     or position('m.organization_id = question_papers.organization_id' in v_text) = 0
     or position('m.student_id = auth.uid()' in v_text) = 0 then
    raise exception 'A2 FAILED: paper RLS lost institution/student isolation.';
  end if;

  -- Assignment profiles/cohorts must always evaluate staff access against the
  -- assignment row's organization. Student cohort rows may additionally expose
  -- only the signed-in student's own assignment.
  select string_agg(coalesce(qual, '') || ' ' || coalesce(with_check, ''), E'\n')
  into v_text
  from pg_policies
  where schemaname = 'public' and tablename = 'paper_assignment_profiles';
  if v_text is null or position('is_evidara_school_staff(organization_id)' in v_text) = 0 then
    raise exception 'A2 FAILED: assignment-profile RLS lost organization isolation.';
  end if;

  select string_agg(coalesce(qual, '') || ' ' || coalesce(with_check, ''), E'\n')
  into v_text
  from pg_policies
  where schemaname = 'public' and tablename = 'paper_student_assignments';
  if v_text is null
     or position('student_id = auth.uid()' in v_text) = 0
     or position('is_evidara_school_staff(organization_id)' in v_text) = 0 then
    raise exception 'A2 FAILED: assignment cohort RLS lost student/organization isolation.';
  end if;

  -- Attempt/response staff reads must traverse to the paper and call the paper
  -- manager check with that paper's organization, never just trust student_id.
  select string_agg(coalesce(qual, '') || ' ' || coalesce(with_check, ''), E'\n')
  into v_text
  from pg_policies
  where schemaname = 'public' and tablename = 'exam_attempts';
  if v_text is null
     or position('student_id = auth.uid()' in v_text) = 0
     or position('is_paper_manager(p.organization_id)' in v_text) = 0 then
    raise exception 'A2 FAILED: exam-attempt RLS lost student/paper-organization isolation.';
  end if;

  select string_agg(coalesce(qual, '') || ' ' || coalesce(with_check, ''), E'\n')
  into v_text
  from pg_policies
  where schemaname = 'public' and tablename = 'exam_responses';
  if v_text is null
     or position('a.student_id = auth.uid()' in v_text) = 0
     or position('is_paper_manager(p.organization_id)' in v_text) = 0 then
    raise exception 'A2 FAILED: exam-response RLS lost student/paper-organization isolation.';
  end if;

  -- Critical SECURITY DEFINER helpers must still include explicit organization
  -- boundaries. These checks are deliberately semantic strings, not hashes, so
  -- harmless formatting/function updates do not break the audit.
  select pg_get_functiondef(p.oid) into v_text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'start_exam_attempt'
  order by p.oid desc limit 1;
  if v_text is null
     or position('student_school_memberships' in v_text) = 0
     or position('organization_id' in v_text) = 0 then
    raise exception 'A2 FAILED: start_exam_attempt lost institution membership enforcement.';
  end if;

  select pg_get_functiondef(p.oid) into v_text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'analytics_can_view_student_v12'
  order by p.oid desc limit 1;
  if v_text is null
     or position('student_school_memberships' in v_text) = 0
     or position('organization_members' in v_text) = 0
     or position('teacher_section_assignments' in v_text) = 0 then
    raise exception 'A2 FAILED: analytics authorization lost institution/section scope.';
  end if;

  if to_regprocedure('public.get_student_analytics_scoped_v20(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)') is not null then
    select pg_get_functiondef('public.get_student_analytics_scoped_v20(uuid,uuid,uuid,timestamp with time zone,timestamp with time zone)'::regprocedure)
    into v_text;
    if position('p_organization_id' in v_text) = 0
       or position('organization_id' in v_text) = 0 then
      raise exception 'A2 FAILED: scoped support analytics lost explicit organization scope.';
    end if;
  end if;

  raise notice 'A2 tenant-isolation policy audit passed: core student, question, paper, assignment, attempt, response and analytics boundaries are present.';
end
$$;
