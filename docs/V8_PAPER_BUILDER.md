# Evidara V8 Paper Builder

V8 starts from `evidara-v7-final-locked` and upgrades the paper lifecycle together with the academic settings needed by the Question Bank, dynamic imports and Paper Builder. The locked V7 branch remains unchanged.

## Included in this build

- Grade-aware question creation, paper creation and question filtering.
- Full-length, subject, chapter, topic, unit, diagnostic, scholarship, previous-year, practice, foundation, school and custom paper classifications.
- Question-level test type has been removed. Test type exists only when creating a paper.
- Manual, Automatic and Hybrid question selection at paper-default and individual-section level.
- Five-level difficulty distributions for Automatic and Hybrid sections, with live available-question counts for Very Easy, Easy, Intermediate, Hard and Very Hard.
- Exam, grade, subject, chapter and topic-aware question-bank filtering.
- Physics, Chemistry, Mathematics, Biology and Logical Reasoning defaults.
- Biology remains the parent subject while each question may be classified as Combined Biology, Botany or Zoology for section filtering and analytics.
- Direct reviewed question upload from the paper builder; approved imports are also stored in the question bank.
- Dynamic Excel question template generated from active subjects, chapters, topics, grades and examinations visible to the current school or institute.
- Student-facing paper preview containing only questions and options, without difficulty, chapter, solution or answer metadata.
- A single rich formatted paper description; the separate Extra Instructions field has been removed.
- Draft autosave and browser recovery.
- Draft, Under Review, Approved, Published, Paused, Closed, Archived and Rejected statuses.
- School Teacher → School Admin approval and Evidara Admin → Super Admin approval.
- Edit, archive and protected-delete controls.
- Score Only, Score and Answers, and In-depth Analytics result modes.
- Product-ready access behavior: paper creators no longer configure access modes; product and school entitlements will control access later.

## Super Admin settings

Question Settings now provides no-code management for:

- Subjects, chapters and topics, including bulk select, move, rename and delete/archive.
- Grades.
- Examinations.
- Paper test types.
- Global defaults and school/institute-specific options.

Items already referenced by questions or papers are archived instead of being destructively removed.

## Database rollout

Run these migrations in order in the Supabase SQL Editor:

1. `supabase/32_v8_paper_builder.sql`
2. `supabase/33_v8_configurable_assessment_settings.sql`

Migration 33 creates configurable academic options, adds Logical Reasoning, removes obsolete question-level test-type metadata and enables Super Admin taxonomy governance. Refresh the application after both migrations complete.

## QA

The branch includes `.github/workflows/evidara-v8-paper-qa.yml` and `scripts/v8-paper-smoke.mjs`. The workflow runs lint, TypeScript, the V8 feature assertions and a production Next.js build.
