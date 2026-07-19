# ScholarOS Version 3 — Exact Live Upgrade Guide

This guide upgrades the working Version 2 website to Version 3 without changing the domain, Razorpay Test setup, Google login or existing commerce data.

## What Version 3 adds

- Username + email + password registration with immediate access.
- Google login remains available.
- ScholarOS master question bank.
- School-private question banks.
- Manual question editor with LaTeX and images.
- Excel and CSV import.
- Optional ZIP image upload and filename matching.
- Validation before import.
- Question status and review workflow.
- Question edit/version history.

---

## Part 1 — Prepare the computer folder

1. Do not delete the working Version 2 folder.
2. Create a new folder, for example:

```text
D:\Hema Sagar\Quiz and Testing Webapp\V3
```

3. Extract `rankmint-tests-v3-source.zip` into that folder.
4. Open the final folder that directly contains:

```text
package.json
src
public
supabase
scripts
```

5. Open that exact folder in Visual Studio Code.
6. Open **Terminal → New Terminal**.
7. Confirm the prompt ends inside the Version 3 project folder.
8. Run:

```powershell
Test-Path .\package.json
```

It must show `True`.

---

## Part 2 — Copy live configuration from Version 2

### `.env.local`

1. Open the Version 2 folder in Windows File Explorer.
2. Turn on **View → Show → Hidden items** if `.env.local` is not visible.
3. Copy `.env.local` from Version 2.
4. Paste it into the Version 3 project root beside `package.json`.

It should contain only the public Supabase settings:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Never put Razorpay secrets, the Supabase service role key or the database password in `.env.local`.

### Business details

Open the Version 2 and Version 3 copies of:

```text
src\config\site.ts
```

Copy your completed legal name, support details, address and website URL into the Version 3 file.

---

## Part 3 — Install Version 3

Inside the Version 3 Visual Studio Code terminal run:

```powershell
npm.cmd install
```

Do not run `npm audit fix --force`.

After installation, run:

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

Keep the terminal open while testing.

---

## Part 4 — Upgrade Supabase

1. Open Supabase.
2. Open the same live project already used by ScholarOS.
3. Open **SQL Editor**.
4. Click **New query**.
5. On your computer open:

```text
supabase\05_version_3_question_bank.sql
```

6. Copy the entire file.
7. Paste it into Supabase SQL Editor.
8. Click **Run** once.

A successful migration creates these new tables:

```text
subjects
chapters
topics
questions
question_options
question_reviews
question_imports
question_versions
```

It also creates a Storage bucket named:

```text
question-assets
```

### Verify the migration

Open **Table Editor**. Confirm the new tables appear.

Open **Storage**. Confirm `question-assets` appears.

Open this local page:

```text
http://localhost:3000/setup-check/
```

The Version 3 question-bank and username checks should turn green.

---

## Part 5 — Disable manual email verification

1. In Supabase open **Authentication**.
2. Open **Sign In / Providers**.
3. Open **Email**.
4. Keep the Email provider enabled.
5. Keep new-user sign-up enabled.
6. Turn **Confirm email** OFF.
7. Save.

This makes email/password registration immediate. Google login continues to work normally.

The username is a unique public profile name. Password login uses the email address and password.

---

## Part 6 — Test a new registration locally

1. Open an Incognito window.
2. Open:

```text
http://localhost:3000/login/
```

3. Select **Register**.
4. Enter a full name.
5. Enter a username such as `rankmint_test_student`.
6. Enter an unused email.
7. Enter a password with at least 8 characters.
8. Click **Create account & continue**.
9. The student dashboard should open immediately.
10. In Supabase open `profiles` and confirm the new row contains the username.

Also test a duplicate username. The app should ask for another username.

---

## Part 7 — Test the master question bank locally

Sign in using your super-admin account.

Open:

```text
http://localhost:3000/admin/questions/
```

Test these pages:

```text
http://localhost:3000/admin/questions/new/
http://localhost:3000/admin/questions/import/
http://localhost:3000/admin/questions/review/
```

### Manual question test

1. Click **New question**.
2. Select Physics.
3. Select Kinematics.
4. Keep `single-correct MCQ`.
5. Enter a plain-text question.
6. Paste a LaTeX equation such as:

```latex
R=\frac{u^2\sin 2\theta}{g}
```

7. Enter four options.
8. Click the letter of the correct option.
9. Enter the solution and solution LaTeX.
10. Set status to `approved` for the super-admin master bank.
11. Save.
12. Return to the question bank and confirm it appears.
13. Reopen it, change the solution and save again.
14. Confirm the version changes from `v1` to `v2`.

### Direct image upload test

1. Open another new question.
2. Under Question image click **Upload**.
3. Select a PNG, JPG, WebP or SVG under 5 MB.
4. Confirm the preview loads.
5. Save the question.
6. Open Supabase Storage → `question-assets` and confirm the file exists.

A public web image URL may also be pasted directly into the image field.

---

## Part 8 — Test Excel/CSV and image ZIP import

Open:

```text
http://localhost:3000/admin/questions/import/
```

The downloadable files are also inside:

```text
public\templates
```

Use:

```text
rankmint-question-template.xlsx
rankmint-sample-question-images.zip
```

1. Select the sample Excel template.
2. Wait for the validation preview.
3. Confirm ready and invalid row totals appear.
4. Select the sample image ZIP.
5. Click **Import valid questions**.
6. Keep the browser tab open until the import completes.
7. Return to the question bank.
8. Confirm the imported Physics, Chemistry, Mathematics and Biology questions appear.
9. Open the projectile and cell questions and confirm their images load.

The importer supports a maximum of 1,000 rows per file in Version 3. Split larger files into multiple uploads.

---

## Part 9 — Test review workflow

1. Create or import a question with status `in_review`.
2. Open:

```text
http://localhost:3000/admin/questions/review/
```

3. Add a reviewer note.
4. Test **Request changes** on one question.
5. Submit another question for review.
6. Test **Approve**.
7. Confirm the approved question moves out of the queue and appears as approved in the bank.

---

## Part 10 — Test school-private questions

Use an school-owner account that already has an school workspace.

Open:

```text
http://localhost:3000/school/questions/
```

Then test:

```text
http://localhost:3000/school/questions/new/
http://localhost:3000/school/questions/import/
```

School questions are stored with the school's `organization_id`. They are not visible to unrelated schools.

School users may submit questions as `draft` or `in_review`; approval is handled through authorised review roles or the super admin.

---

## Part 11 — Build the live Version 3 site

Stop the development server using:

```text
Ctrl + C
```

Inside the Version 3 project root run:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\scripts\BUILD_FOR_HOSTINGER.ps1
```

Wait for `SUCCESS`.

The safest deployment method is the method that already worked for you:

1. Open the generated `out` folder on your computer.
2. Select every file and folder inside `out`.
3. Upload all selected items directly into the active Hostinger `public_html` for:

```text
rankmint-tests.printbureauindia.com
```

Do not upload the `out` folder itself as an extra nested folder.

The live `public_html` must directly contain:

```text
index.html
_next
admin
school
login
products
student
trial
templates
```

Do not delete `.well-known` from Hostinger.

---

## Part 12 — Test Version 3 live

Hard-refresh using `Ctrl + Shift + R`.

Open:

```text
https://rankmint-tests.printbureauindia.com/setup-check/
https://rankmint-tests.printbureauindia.com/login/
https://rankmint-tests.printbureauindia.com/admin/questions/
https://rankmint-tests.printbureauindia.com/admin/questions/new/
https://rankmint-tests.printbureauindia.com/admin/questions/import/
https://rankmint-tests.printbureauindia.com/admin/questions/review/
```

Also confirm these downloads work:

```text
https://rankmint-tests.printbureauindia.com/templates/rankmint-question-template.xlsx
https://rankmint-tests.printbureauindia.com/templates/rankmint-sample-question-images.zip
```

### Live acceptance checklist

- Google login works.
- New username/email/password registration enters immediately.
- Duplicate usernames are rejected.
- Existing super-admin access remains intact.
- Products and Razorpay Test Mode remain functional.
- A manual question saves.
- A LaTeX preview renders.
- A directly uploaded image loads.
- Excel validation works.
- Sample images ZIP imports correctly.
- The review queue works.
- School-private questions remain isolated.

After these checks, Version 3 is complete and the platform is ready for Version 4: the examination builder and test-taking engine.
