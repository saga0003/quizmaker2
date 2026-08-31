create index if not exists paper_questions_question_id_idx
  on public.paper_questions(question_id);

comment on index public.paper_questions_question_id_idx is
'Phase 1 C8: supports retained-question usage checks and question-to-paper lookups without scanning all paper_questions rows.';
