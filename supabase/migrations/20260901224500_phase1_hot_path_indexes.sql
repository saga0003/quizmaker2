-- Evidara Phase 1 I7: targeted indexes for high-frequency institutional paths.
-- Applied only after live index inspection to avoid redundant broad indexes.

create index if not exists exam_attempts_org_status_expiry_idx
  on public.exam_attempts (organization_id, status, expires_at, id);

create index if not exists student_memberships_org_status_section_student_idx
  on public.student_school_memberships (organization_id, status, section_id, student_id);

create index if not exists questions_org_status_taxonomy_updated_idx
  on public.questions (organization_id, status, subject_id, chapter_id, topic_id, updated_at desc, id);

create index if not exists question_papers_org_status_window_idx
  on public.question_papers (organization_id, status, available_from, available_until, id);

create index if not exists paper_assignments_org_student_status_idx
  on public.paper_student_assignments (organization_id, student_id, status, paper_id);
