-- Phase 1 P0.5: prevent a staff member in one institution from reading a
-- student's attempts/membership rows belonging to another institution.
-- Student self-service keeps personal history; platform support remains a
-- privileged path until explicit support scoping/audit is completed.

create or replace function public.analytics_can_view_membership_v20(
  p_organization_id uuid,
  p_section_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    public.is_evidara_platform_admin()
    or exists (
      select 1
      from public.organization_members manager
      where manager.organization_id = p_organization_id
        and manager.user_id = auth.uid()
        and manager.is_active = true
        and manager.member_role::text in ('institute_owner','institute_admin','school_owner','school_admin')
    )
    or exists (
      select 1
      from public.teacher_section_assignments assignment
      join public.academic_sections section_row on section_row.id = assignment.section_id
      where assignment.teacher_id = auth.uid()
        and assignment.is_active = true
        and section_row.is_active = true
        and section_row.organization_id = p_organization_id
        and section_row.id = p_section_id
    ), false
  );
$$;

revoke all on function public.analytics_can_view_membership_v20(uuid, uuid) from public, anon, authenticated;
grant execute on function public.analytics_can_view_membership_v20(uuid, uuid) to service_role;

create or replace function public.analytics_scope_organization_v20(p_student_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_orgs uuid[];
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role'
     or auth.uid() = p_student_id
     or public.is_evidara_platform_admin() then
    return null;
  end if;

  select array_agg(distinct membership.organization_id)
    into v_orgs
  from public.student_school_memberships membership
  where membership.student_id = p_student_id
    and membership.status = 'active'
    and public.analytics_can_view_membership_v20(membership.organization_id, membership.section_id);

  if coalesce(array_length(v_orgs, 1), 0) = 0 then
    raise exception 'You do not have an institution-scoped analytics relationship with this student.' using errcode='42501';
  end if;
  if array_length(v_orgs, 1) > 1 then
    raise exception 'Multiple institutions match this student. Select an active institution before opening analytics.' using errcode='42501';
  end if;
  return v_orgs[1];
end;
$$;

revoke all on function public.analytics_scope_organization_v20(uuid) from public, anon, authenticated;
grant execute on function public.analytics_scope_organization_v20(uuid) to service_role;

create or replace function public.list_analytics_students_v12()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Login required.'; end if;

  return jsonb_build_object(
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'student_id', membership.student_id,
        'full_name', coalesce(profile.full_name, 'Student'),
        'organization_id', membership.organization_id,
        'organization_name', organization.name,
        'academic_year', membership.academic_year,
        'grade', membership.grade,
        'section_name', coalesce(section_row.name, membership.section, 'Unassigned')
      ) order by membership.academic_year desc, membership.grade, coalesce(section_row.name,membership.section,''), lower(coalesce(profile.full_name,'')))
      from public.student_school_memberships membership
      join public.profiles profile on profile.id = membership.student_id
      join public.organizations organization on organization.id = membership.organization_id
      left join public.academic_sections section_row on section_row.id = membership.section_id
      where membership.status = 'active'
        and (
          public.is_evidara_platform_admin()
          or public.analytics_can_view_membership_v20(membership.organization_id, membership.section_id)
        )
    ), '[]'::jsonb),
    'generated_at', now()
  );
end;
$$;

revoke all on function public.list_analytics_students_v12() from public, anon;
grant execute on function public.list_analytics_students_v12() to authenticated, service_role;

-- Patch the established V12 analytics engine in place so every aggregation is
-- scoped before facts are built. This avoids duplicating the large, audited
-- aggregation function while keeping the migration deterministic after V12.
do $$
declare
  v_oid oid;
  v_definition text;
  v_original text;
begin
  select p.oid into v_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='get_live_student_analytics_v12'
  limit 1;
  if v_oid is null then raise exception 'get_live_student_analytics_v12 is required before P0.5 migration.'; end if;

  v_definition := pg_get_functiondef(v_oid);
  v_original := v_definition;

  v_definition := replace(
    v_definition,
    E'declare\r\n  v_student uuid := coalesce(p_student_id, auth.uid());\r\n  v_result jsonb;',
    E'declare\r\n  v_student uuid := coalesce(p_student_id, auth.uid());\r\n  v_result jsonb;\r\n  v_scope_org uuid;'
  );

  v_definition := replace(
    v_definition,
    E'  if p_date_from is not null and p_date_to is not null and p_date_to < p_date_from then\r\n    raise exception ''The end date must be on or after the start date.'';\r\n  end if;\r\n\r\n  with',
    E'  if p_date_from is not null and p_date_to is not null and p_date_to < p_date_from then\r\n    raise exception ''The end date must be on or after the start date.'';\r\n  end if;\r\n  v_scope_org := public.analytics_scope_organization_v20(v_student);\r\n\r\n  with'
  );

  v_definition := replace(
    v_definition,
    'where membership.student_id = v_student and membership.status = ''active''',
    'where membership.student_id = v_student and membership.status = ''active'' and (v_scope_org is null or membership.organization_id = v_scope_org)'
  );

  v_definition := replace(
    v_definition,
    'and attempt.submitted_at is not null',
    'and attempt.submitted_at is not null and (v_scope_org is null or attempt.organization_id = v_scope_org)'
  );

  v_definition := replace(
    v_definition,
    'and cohort_attempt.paper_id in (select paper_id from selected_attempts)',
    'and cohort_attempt.paper_id in (select paper_id from selected_attempts) and (v_scope_org is null or cohort_attempt.organization_id = v_scope_org)'
  );

  if v_definition = v_original
     or position('v_scope_org uuid' in v_definition) = 0
     or position('attempt.organization_id = v_scope_org' in v_definition) = 0 then
    raise exception 'P0.5 analytics patch did not match the expected V12 function body.';
  end if;

  execute v_definition;
end;
$$;

-- Restore the P0.4 internal-only grant after CREATE OR REPLACE.
revoke all on function public.get_live_student_analytics_v12(uuid, uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.get_live_student_analytics_v12(uuid, uuid, timestamptz, timestamptz) to service_role;

-- Tighten answer-review scope as well. A staff relationship with a transferred
-- student does not authorize opening a paper/attempt from another institution.
create or replace function public.get_student_test_review_v12(p_student_id uuid, p_paper_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_student uuid := coalesce(p_student_id, auth.uid());
  v_attempt_id uuid;
  v_detail jsonb;
  v_questions jsonb;
  v_release text;
  v_scope_org uuid;
  v_paper_org uuid;
begin
  if auth.uid() is null then raise exception 'Login required.' using errcode='42501'; end if;
  if not public.analytics_can_view_student_v12(v_student) then
    raise exception 'You do not have access to this student answer review.' using errcode='42501';
  end if;

  v_scope_org := public.analytics_scope_organization_v20(v_student);
  select organization_id into v_paper_org from public.question_papers where id = p_paper_id;
  if not found then raise exception 'Paper not found.'; end if;
  if v_scope_org is not null and v_paper_org is distinct from v_scope_org then
    raise exception 'This assessment belongs to another institution.' using errcode='42501';
  end if;

  if auth.uid() = v_student then
    v_release := public.student_result_release_level(p_paper_id, v_student);
    if v_release not in ('answers', 'analytics') then
      raise exception 'Answers and solutions have not been released for this assessment.' using errcode='42501';
    end if;
  end if;

  v_detail := public.get_student_test_comparison_v11(v_student, p_paper_id);

  select attempt.id into v_attempt_id
  from public.exam_attempts attempt
  where attempt.student_id = v_student
    and attempt.paper_id = p_paper_id
    and attempt.status = 'submitted'
    and (v_scope_org is null or attempt.organization_id = v_scope_org)
  order by attempt.submitted_at desc nulls last, attempt.created_at desc, attempt.id desc
  limit 1;

  if v_attempt_id is null then raise exception 'No submitted attempt was found for this paper in the active institution scope.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'question_number', paper_question.display_order,
    'paper_question_id', paper_question.id,
    'subject_name', coalesce(subject.name, paper_section.title, paper_question.question_snapshot->>'subject_name', 'General'),
    'question_text', coalesce(paper_question.question_snapshot->>'stem_text', question.stem_text, 'Question'),
    'question_type', coalesce(paper_question.question_snapshot->>'question_type', question.question_type::text, 'single_correct'),
    'difficulty', coalesce(paper_question.question_snapshot->>'difficulty', question.difficulty::text),
    'selected_keys', coalesce(response.response, '[]'::jsonb),
    'correct_keys', coalesce(paper_question.question_snapshot->'correct_answer', question.correct_answer, '[]'::jsonb),
    'status', case when response.is_correct = true then 'correct' when response.is_correct = false then 'incorrect' else 'unanswered' end,
    'marks_awarded', coalesce(response.marks_awarded, 0),
    'maximum_marks', paper_question.marks,
    'negative_marks', paper_question.negative_marks,
    'time_spent_seconds', coalesce(response.time_spent_seconds, 0),
    'marked_for_review', coalesce(response.marked_for_review, false),
    'options', coalesce(paper_question.question_snapshot->'options', '[]'::jsonb),
    'solution_text', coalesce(paper_question.question_snapshot->>'solution_text', question.solution_text)
  ) order by paper_question.display_order), '[]'::jsonb)
  into v_questions
  from public.paper_questions paper_question
  join public.paper_sections paper_section on paper_section.id = paper_question.section_id
  left join public.subjects subject on subject.id = paper_section.subject_id
  left join public.questions question on question.id = paper_question.question_id
  left join public.exam_responses response
    on response.paper_question_id = paper_question.id and response.attempt_id = v_attempt_id
  where paper_question.paper_id = p_paper_id;

  return coalesce(v_detail, '{}'::jsonb) || jsonb_build_object(
    'attempt_id', v_attempt_id,
    'questions', coalesce(v_questions, '[]'::jsonb),
    'question_count', jsonb_array_length(coalesce(v_questions, '[]'::jsonb)),
    'review_generated_at', now(),
    'organization_scope', v_scope_org
  );
end;
$$;

revoke all on function public.get_student_test_review_v12(uuid, uuid) from public, anon;
grant execute on function public.get_student_test_review_v12(uuid, uuid) to authenticated, service_role;
