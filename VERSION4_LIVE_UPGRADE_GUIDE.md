# ScholarOS Version 4 — Exact Live Upgrade Guide

This guide assumes Version 3.1, Supabase, Google login, super-admin access, products and Razorpay Test Mode are already working.

## Part 1 — Create the Version 4 folder

1. Do not delete your working Version 3 folder.
2. Create:

```text
D:\Hema Sagar\Quiz and Testing Webapp\V4
```

3. Extract the Version 4 source ZIP there.
4. Open the inner folder that directly contains `package.json`, `src`, `public`, `scripts` and `supabase` in Visual Studio Code.

## Part 2 — Copy live configuration

Copy from the working Version 3 project:

```text
.env.local
```

Paste it into the Version 4 project root beside `package.json`.

Also compare and copy your real business details from:

```text
src\config\site.ts
```

Do not copy `node_modules`, `.next` or `out`.

## Part 3 — Install

Open **Terminal → New Terminal** in Visual Studio Code. Confirm:

```powershell
Test-Path .\package.json
```

returns `True`.

Run:

```powershell
npm.cmd install
```

Do not run `npm audit fix --force`.

## Part 4 — Run the Supabase Version 4 migration

1. Open your existing Supabase project.
2. Open **SQL Editor → New query**.
3. Open locally:

```text
supabase\07_version_4_exam_builder.sql
```

4. Copy its complete contents into Supabase.
5. Click **Run** once.

Expected new tables:

```text
question_papers
paper_sections
paper_questions
exam_attempts
exam_responses
exam_attempt_events
```

The same migration also updates the `question-assets` storage bucket to accept the supported image MIME types and a 10 MB per-image limit.

## Part 5 — Start locally

Run:

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:3000/setup-check/
```

The Version 4 paper-builder check must show green.

## Part 6 — Verify the image MIME repair

Open:

```text
http://localhost:3000/admin/questions/import/
```

Download or select these files from `public/templates`:

```text
rankmint-image-format-test.csv
rankmint-image-format-test.zip
```

1. Choose the CSV.
2. Choose the matching ZIP.
3. Confirm all rows show **Ready**.
4. Click import.

Expected result:

```text
Import completed: 8 question(s) added, 0 failed.
```

The test ZIP contains JPG, JPEG, JFIF, PNG, WEBP, GIF, BMP and SVG examples.

If the same test was imported earlier, duplicate or database rules may produce a different result. Use the normal question template after confirming the MIME error has disappeared.

## Part 7 — Create the first question paper

Open:

```text
http://localhost:3000/admin/papers/
```

1. Click **Create question paper**.
2. Enter a title such as `ScholarOS Version 4 Test Paper`.
3. Select an exam type.
4. Enter duration and attempts.
5. Keep access mode as **All logged-in students** for the first test.
6. Add or rename sections.
7. Select an active section.
8. Add approved questions from the left-side bank.
9. Adjust marks and negative marks when required.
10. Click **Save draft**.
11. Open **Preview** from the paper list.
12. Return and click **Save & publish**.

Only approved questions can be placed in a paper.

## Part 8 — Test using a student account

Use an Incognito window and a normal student account.

Open:

```text
http://localhost:3000/student/tests/
```

1. Open the published paper.
2. Click **Start / Resume**.
3. Enter fullscreen when prompted.
4. Answer questions.
5. Use the question palette and mark-for-review.
6. Submit the test.
7. Open:

```text
http://localhost:3000/student/results/
```

Confirm that score, percentage, correct, incorrect and unanswered counts appear.

In Supabase, verify rows in:

```text
exam_attempts
exam_responses
exam_attempt_events
```

## Part 9 — Build for Hostinger

Stop the local server with `Ctrl + C`.

Run:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\BUILD_FOR_HOSTINGER.ps1
```

Expected:

```text
SUCCESS
```

The build creates:

```text
out
rankmint-tests-v4-hostinger-upload.zip
```

## Part 10 — Upload to Hostinger using the method that already worked

1. Open the active File Manager for `rankmint-tests.printbureauindia.com`.
2. Open its active `public_html`.
3. Keep `.well-known`.
4. Remove the old ScholarOS application files and folders.
5. On your computer, open the Version 4 `out` folder.
6. Select **every file and folder inside `out`**.
7. Upload all selected items directly into the active `public_html`.
8. Do not upload the outer `out` folder itself.
9. Confirm `index.html`, `_next`, `admin`, `student`, `school` and `.htaccess` are directly under `public_html`.
10. Hard-refresh with `Ctrl + Shift + R`.

## Part 11 — Live checks

Open:

```text
https://rankmint-tests.printbureauindia.com/setup-check/
https://rankmint-tests.printbureauindia.com/admin/papers/
https://rankmint-tests.printbureauindia.com/admin/papers/new/
https://rankmint-tests.printbureauindia.com/student/tests/
https://rankmint-tests.printbureauindia.com/student/results/
```

Create one short live paper and complete it with a student account before creating large test series.

## Important safety rule

After a student starts a paper, Version 4 prevents structural edits to that paper. This protects historical answers and marks. Create a new paper when questions must change after attempts already exist.
