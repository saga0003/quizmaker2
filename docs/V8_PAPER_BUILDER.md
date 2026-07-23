# Evidara V8 Paper Builder

V8 starts from `evidara-v7-final-locked` and upgrades only the paper lifecycle. The V7 question bank, authentication, school tenancy and student attempt engine remain the foundation.

## Included in this build

- Grade-aware paper creation and grade filtering.
- Full-length, subject, chapter, topic, unit, diagnostic, scholarship, previous-year, practice, foundation, school and custom test classifications.
- Manual, Automatic and Hybrid question selection at paper-default and individual-section level.
- Five-level difficulty distributions for Automatic and Hybrid sections.
- Exam, grade, subject, chapter and topic-aware question-bank filtering.
- Physics, Chemistry, Mathematics, Biology and Logical Reasoning defaults, with Biology split into combined, Botany or Zoology.
- Direct reviewed question upload from the paper builder; approved imports are also stored in the question bank.
- Student-facing paper preview containing only questions and options, without difficulty, chapter, solution or answer metadata.
- Draft autosave and browser recovery.
- Draft, Under Review, Approved, Published, Paused, Closed, Archived and Rejected statuses.
- School Teacher → School Admin approval and Evidara Admin → Super Admin approval.
- Edit, archive and delete controls. Papers with attempts cannot be deleted or structurally edited.
- Score Only, Score and Answers, and In-depth Analytics result modes.
- Product-ready access behavior: paper creators no longer configure access modes; product and school entitlements will control access later.

## Database rollout

Run `supabase/32_v8_paper_builder.sql` in the Supabase SQL Editor after all V7 migrations. Refresh the application after the migration completes.

## QA

The branch includes `.github/workflows/evidara-v8-paper-qa.yml` and `scripts/v8-paper-smoke.mjs`. The workflow runs lint, TypeScript, the V8 feature smoke assertions and a production Next.js build.
