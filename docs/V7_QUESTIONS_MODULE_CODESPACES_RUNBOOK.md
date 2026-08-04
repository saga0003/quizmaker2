# Evidara V7 Questions module — Codespaces setup and test runbook

This runbook covers the completed V7 Questions module on branch:

```text
evidara-v7-super-ui
```

Pull request:

```text
https://github.com/saga0003/quizmaker2/pull/18
```

Keep the pull request in Draft while testing. These instructions do not merge or deploy the branch.

## What this Questions build includes

- one-page Add/Edit Question workspace
- searchable A–Z subject, chapter and topic selectors
- Super Admin universal subject management
- inline chapter and topic creation for non-student question users
- normal text, images and editable LaTeX
- single-correct, multiple-correct, numerical, integer, assertion/reason, passage, image and Match the Following manual questions
- live mobile, tablet and laptop learner preview
- Excel, CSV, image ZIP and import-guide downloads
- Excel fixed-value dropdown validation
- editable bulk question review with Previous/Next and direct error correction
- paste-and-review LaTeX bulk workflow
- topic-wise dynamic serial numbers
- published-date and updated-date range filters
- deep search across questions, options, answers, solutions, tags, images and taxonomy
- teacher Draft/In Review boundary
- administrator approval, rejection and archiving controls
- school-created question ZIP export
- no Evidara master-bank export

## 1. Open the correct Codespace

Open the repository:

```text
https://github.com/saga0003/quizmaker2
```

Choose the branch:

```text
evidara-v7-super-ui
```

Then select:

```text
Code → Codespaces → Create codespace on evidara-v7-super-ui
```

Inside the Codespaces terminal, verify the branch:

```bash
git branch --show-current
```

Expected:

```text
evidara-v7-super-ui
```

## 2. Pull the latest Questions build

Stop any currently running development server with `Ctrl + C`, then run:

```bash
git restore package-lock.json 2>/dev/null || true
git fetch origin
git switch evidara-v7-super-ui
git pull --ff-only origin evidara-v7-super-ui
rm -rf node_modules .next .open-next
npm ci
```

Confirm the application version:

```bash
node -p "require('./package.json').version"
```

Expected:

```text
7.0.0
```

## 3. Configure Codespaces secrets

The Codespace needs these repository or Codespaces secrets:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

A legacy project may use this instead of the publishable key:

```text
NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Do not commit any `.env` or `.env.local` file.

Safe presence check:

```bash
node -e '
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_APP_URL"
]) console.log(`${name}: ${process.env[name] ? "SET" : "MISSING"}`)
'
```

At least one of the publishable/anon keys must be set.

## 4. Apply the required Supabase migrations

Open your Supabase project and go to:

```text
SQL Editor → New query
```

Run the complete migration files in this order:

```text
supabase/25_role_access_control.sql
supabase/26_v7_role_compatibility.sql
supabase/27_v7_question_access_governance.sql
supabase/28_v7_question_module_completion.sql
```

Do not copy isolated fragments. Run each complete file once, in order.

Migration 27 adds:

- module access settings
- Questions workspace visibility rules
- import-batch governance
- Questions disabled permanently for students

Migration 28 adds:

- teacher publication restrictions at database level
- published-at metadata
- topic/chapter/date indexes
- protection against teachers editing approved, rejected or archived questions

Verify the migrations:

```sql
select to_regprocedure('public.assign_evidara_role_by_email(text,text)') is not null
  as role_assignment_ready;

select to_regprocedure('public.is_evidara_school_staff(uuid)') is not null
  as school_staff_ready;

select to_regprocedure('public.evidara_module_enabled(text,text,uuid)') is not null
  as module_access_ready;

select to_regprocedure('public.enforce_question_publication_permissions()') is not null
  as question_publication_guard_ready;

select to_regclass('public.module_access_settings') is not null
  as module_access_table_ready;

select to_regclass('public.question_import_batches') is not null
  as import_batch_table_ready;
```

All six results must be `true`.

## 5. Start Evidara V7

Run:

```bash
npm run dev
```

Open the forwarded port `3000` from the Codespaces **Ports** panel.

Health check:

```text
/api/health
```

Expected core values:

```json
{
  "release": "7.0.0",
  "configured": true,
  "serverReady": true,
  "mode": "supabase",
  "interface": "v7-super-ui"
}
```

After pulling a new version, hard-refresh the browser:

```text
Windows: Ctrl + Shift + R
Mac: Command + Shift + R
```

## 6. Test the one-page Add Question workspace

Sign in as Super Admin and open:

```text
Questions → Add Question
```

Confirm:

1. No Question Content / Answer / Classification page switching is required.
2. The form is one continuous scrollable page.
3. The right side shows a live learner preview.
4. Mobile, Tablet and Laptop preview buttons work.
5. Subject, chapter and topic selectors allow typing and filtering.
6. The selector results are sorted A to Z.
7. `New` beside Chapter creates a chapter without leaving the question.
8. `New` beside Topic creates a topic without leaving the question.
9. Text, LaTeX and image previews update immediately.
10. Options and correct-answer highlighting update immediately.
11. The header and Save/Publish footer remain visible.
12. The same form remains scrollable on mobile.

## 7. Test Question Settings and taxonomy permissions

Open:

```text
Questions → Settings
```

As Super Admin, test:

- add a universal subject
- add a chapter
- add a topic
- search the hierarchy
- confirm A–Z sorting

Then sign in as a School Teacher or School Admin:

- they must not be able to add a universal subject
- they can add a chapter or topic while creating a question
- students must not have access to Questions at all

Use disposable taxonomy names during testing and avoid duplicating production names.

## 8. Test publication permissions

### Super Admin, Evidara Admin and School Admin

These roles may:

- save Draft
- send In Review
- publish Approved
- reject
- archive permitted questions

### School Teacher

A teacher may:

- create Draft
- send In Review
- edit their school Draft/In Review questions
- see whether a question was Approved or Rejected

A teacher must not:

- publish
- reject
- archive
- modify an Approved, Rejected or Archived question
- edit Evidara master-bank questions

Test the teacher account after applying migration 28. The database must reject restricted actions even if the browser UI is bypassed.

## 9. Test Bulk Import templates

Open:

```text
Questions → Bulk Import
```

Download and open each resource:

- Excel
- CSV
- Image ZIP
- Guide

The Excel workbook should contain:

- `Questions` sheet
- `Guide` sheet
- hidden fixed-value list sheet
- dropdown validation for supported fixed fields
- a simple structure without Match the Following columns

Match the Following remains available in the manual Add Question editor.

## 10. Test editable import review

Create three sample Excel rows:

- one valid question
- one invalid difficulty
- one incorrect subject/chapter mapping

Upload the file and confirm:

1. The question navigator shows all detected rows.
2. Invalid rows are marked clearly.
3. `Jump to first error` opens the first invalid question.
4. Previous and Next Question work.
5. Question text and all four options are visible.
6. Fixed fields can be corrected without returning to Excel.
7. LaTeX can be edited and rendered in the preview.
8. The user can import all currently valid questions without reviewing every row.
9. Invalid questions are not imported.
10. Teacher imports cannot publish Approved questions.

## 11. Test image ZIP import

In Excel, enter exact filenames such as:

```text
physics-q001.png
physics-q001-a.png
```

Place those files inside the selected image ZIP.

Upload both the Excel workbook and image ZIP. Confirm that Evidara:

- finds each exact filename
- uploads the images to `question-assets`
- replaces local filenames with public URLs
- shows the images after import

A missing filename must produce a clear import error.

## 12. Test pasted LaTeX

Open Bulk Import and click:

```text
Paste LaTeX
```

Paste a structured block such as:

```latex
\begin{question}
\subject{Physics}
\chapter{Units and Measurements}
\question{The dimensional formula of force is:}
\latex{[M L T^{-2}]}
\option[A]{Option A}
\option[B]{Option B}
\option[C]{Option C}
\option[D]{Option D}
\answer{A}
\solution{Force equals mass multiplied by acceleration.}
\end{question}
```

Click **Review pasted LaTeX**, then correct classification and exam fields as required.

## 13. Test search, dates and topic serial numbers

In the Questions table, confirm:

- searching question text filters while typing
- searching an option filters while typing
- searching an answer or solution filters while typing
- searching tags, topic, chapter or school filters while typing
- subject, chapter and topic filters work together
- Published Date and Updated Date modes work
- From and To dates work
- the exact published date is shown in the table and review screen
- topic-wise serial numbers are stable and dynamic

## 14. Test learner review

Click a question row or its eye icon.

Confirm:

- Mobile preview works
- Tablet preview works
- Laptop preview works
- question text, LaTeX and image are visible
- options and correct answers are visible to the authorised reviewer
- subject, chapter and topic are shown
- published and updated dates are shown
- marking and solution are shown

## 15. Test school export restriction

### Evidara master bank

There must be no export button.

### School-created questions

Choose a school and click:

```text
Export School ZIP
```

The ZIP should contain:

```text
questions.csv
questions.json
image-links.csv
README.txt
images/...
```

Browser CORS rules may prevent packaging some remote images. When that happens, the original public URL must remain in the export files and image manifest.

Super Admin must choose one school before exporting. Evidara master questions must never enter the ZIP.

## 16. Run complete validation

Stop the development server and run:

```bash
npm run lint
npm run typecheck
npm run qa:smoke
npm run build
npm run cf:build
```

Or run the main QA bundle:

```bash
npm run qa
```

No deployment or merge is performed by these commands.

## 17. Keep the PR in Draft

Do not select:

```text
Ready for review
Merge pull request
Delete branch
```

until the Questions module has been manually tested with:

- Super Admin
- Evidara Admin
- School Admin
- School Teacher
- Student

The student account must never display or access the Questions workspace.
