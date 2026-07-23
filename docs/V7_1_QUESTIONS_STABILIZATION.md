# Evidara V7.1 Questions Stabilization

## Preserved baseline

The last V7.0 checkpoint is preserved permanently on the branch:

```text
evidara-v7-0-snapshot
```

Snapshot commit:

```text
f4d8c0c0c78a4bec5bfe4defdd7fe9b1781a9801
```

The active V7.1 work continues on:

```text
evidara-v7-super-ui
```

## What V7.1 fixes

- approved Evidara master questions are readable by Evidara Admin, School Admin and School Teacher accounts
- School Admin and School Teacher accounts continue to see their own school-created questions
- `btrim(app_role)` compatibility failures are fixed before import
- a database/storage/role preflight runs before the Import button can be used
- the Image ZIP selector remains visible after an Excel file is selected
- local image filenames are checked against the selected ZIP before import
- question images are uploaded to Supabase Storage bucket `question-assets`
- Cloudflare R2 is optional and is not required for question image import
- missing chapters and topics can be created from the bulk-review screen
- cancelling an unfinished import asks for confirmation and clears the batch after confirmation
- visible question serial numbers follow the current row order: 1, 2, 3, 4…
- Test Type remains outside question creation and belongs to paper/test-series creation

## Required database step

Open Supabase SQL Editor and run the complete file:

```text
supabase/30_v7_1_question_import_stabilization.sql
```

Do not copy isolated sections. Run the complete file in one query.

### Verify migration 30

```sql
select to_regprocedure(
  'public.btrim(public.app_role)'
) is not null as app_role_trim_ready;

select to_regprocedure(
  'public.question_import_preflight_v71(uuid)'
) is not null as question_import_preflight_ready;

select to_regprocedure(
  'public.bulk_import_questions_v71(uuid,text,text,jsonb)'
) is not null as question_import_v71_ready;

select exists (
  select 1
  from storage.buckets
  where id = 'question-assets'
) as question_assets_ready;
```

All four results must be `true`.

## Supabase Storage

Migration 30 automatically creates the public bucket:

```text
question-assets
```

It also creates policies that allow authenticated users to upload only under their own user-ID folder, while platform administrators retain platform access.

No Cloudflare dashboard, R2 bucket, API token or payment method is required for this V7.1 image workflow.

Cloudflare remains relevant later for production deployment/CDN strategy, but it is not a prerequisite for importing the Excel file and matching image ZIP.

## Codespaces update

In the existing Codespace:

```bash
git switch evidara-v7-super-ui
git pull --ff-only origin evidara-v7-super-ui
npm run dev:codespaces
```

The development server runs on:

```text
http://127.0.0.1:20241
```

The Codespaces address is:

```text
https://shiny-space-lamp-4j94x497xj963qp6j-20241.app.github.dev/
```

Keep the development terminal running.

## Bulk-import workflow

1. Open Questions → Bulk Import.
2. Confirm the V7.1 preflight says database, role and image storage checks passed.
3. Select the Excel file.
4. If local image filenames are detected, use the permanently visible Matching Image ZIP selector.
5. Evidara checks that every referenced image filename exists inside the ZIP.
6. Fix red rows directly in the review screen.
7. Add a missing chapter/topic individually or select Create all missing taxonomy.
8. Review the live learner preview.
9. Import only after the error count reaches zero.

## Important validation for Evidara_SET_A_LaTeX_Import(1).xlsx

The supplied workbook contains 85 questions and 11 image references. Those 11 references point to the same GitHub avatar URL rather than actual question diagrams:

```text
https://avatars.githubusercontent.com/u/69371472?s=200&v=4
```

V7.1 deliberately flags that as a placeholder image before import.

For each of those 11 rows, either:

- replace the URL with the real public diagram URL, or
- enter an exact local filename such as `kinematics-q12.png` and attach a ZIP containing that file.

Do not publish image-based questions with the avatar placeholder.

## Role visibility test

After importing approved master questions:

- Super Admin: sees all master and school questions
- Evidara Admin: sees all master and school questions
- School Admin: sees approved master questions and questions from their school
- School Teacher: sees approved master questions and questions from their school; administrative decisions remain read-only
- Student: does not receive the Questions workspace

## Cancellation test

1. Select an Excel file.
2. Make a review edit.
3. Press Cancel or the close icon.
4. Confirm that Evidara asks whether the import should be discarded.
5. Choose Cancel in the browser confirmation to keep working.
6. Choose OK to clear the batch.
7. Reopen Bulk Import and confirm it starts empty.

## Release boundary

V7.1 remains on draft PR #18. It is not merged and is not deployed to production.
