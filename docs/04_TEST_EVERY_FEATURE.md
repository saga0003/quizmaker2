# 04 — Test Every Version 1 Feature

Complete this checklist before uploading to Hostinger.

## Test 1 — Homepage

1. Open `/`.
2. Confirm the ScholarOS logo appears.
3. Resize Chrome narrower.
4. Confirm the layout becomes single-column.
5. Click **Take Trial Test**.
6. Return to the homepage.
7. Click **Open Login**.
8. Return to the homepage.
9. Click **Register School**.

## Test 2 — Trial examination

1. Open `/trial/`.
2. Click **Start Trial Test**.
3. Confirm Question 1 contains a rendered equation and projectile image.
4. Select an answer.
5. Click **Save & Next**.
6. Confirm the first palette number becomes green.
7. Click **Mark for Review** on another question.
8. Confirm that number becomes purple.
9. Confirm circuit, cell, and graph images display.
10. Confirm equations display as formatted mathematics rather than raw backslashes.
11. Submit the test.
12. Confirm score, correct, incorrect, unanswered, and accuracy appear.
13. Confirm each question shows your answer, correct answer, and explanation.
14. Click **Retake**.

## Test 3 — Email account

1. Register using email and password.
2. Confirm the verification email arrives.
3. Click the verification link.
4. Log in.
5. Refresh the page.
6. Confirm the session remains active.
7. Sign out from a dashboard.
8. Log in again.

## Test 4 — Google account

1. Click **Continue with Google**.
2. Confirm Google’s account chooser opens.
3. Complete login.
4. Confirm you return to `/auth/callback/` briefly.
5. Confirm you reach `/student/`.
6. In Supabase, confirm the user and profile records exist.

## Test 5 — Student dashboard

1. Open `/student/`.
2. Confirm four summary cards appear.
3. Confirm the chart displays five tests.
4. Confirm score and subject lines display.
5. Confirm improvement map displays.
6. Open the page on a mobile screen width.
7. Confirm cards stack without horizontal overflow.

## Test 6 — School registration

1. Log in as a non-super-admin test user.
2. Open `/school/register/`.
3. Complete every field.
4. Submit.
5. Confirm the success screen appears.
6. Check `organizations` in Supabase.
7. Check `organization_members`.
8. Check the profile role.
9. Check `audit_logs`.

## Test 7 — Admin setup

1. Register your own account.
2. Run `02_make_me_super_admin.sql` using your email.
3. Log out and in again.
4. Open `/admin/`.
5. Confirm the admin dashboard preview loads.

Version 1 currently shows dashboard previews rather than blocking routes by role. Strict role route guards will be completed when the real dashboard CRUD modules are connected. Database access is already protected by RLS.

## Test 8 — Production build

Stop the development server, then run:

```powershell
npm run build
```

Expected result:

- Build completes without errors.
- An `out` folder appears.
- `out\index.html` exists.
- Folders such as `out\trial` and `out\login` exist.

## Test 9 — Test the static output locally

Run:

```powershell
npx serve out
```

If asked whether to install `serve`, type `y` and press Enter.

Open the address shown, often:

```text
http://localhost:3000
```

or another port such as `http://localhost:3001`.

Repeat the homepage, login, trial, student, school, and admin tests. Press `Ctrl + C` when finished.
