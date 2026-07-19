# 02 — Supabase Database Setup: Every Step

Supabase will store accounts, profiles, schools, memberships, roles, and audit logs.

## Part A — Create a free Supabase account

1. Open `https://supabase.com/`.
2. Click **Start your project**.
3. Sign in using GitHub or another supported account.
4. Create an organisation if Supabase asks you to.
5. Use a simple organisation name such as `ScholarOS`.

## Part B — Create the project

1. Click **New project**.
2. Select your organisation.
3. Project name: `rankmint-tests`.
4. Create a strong database password.
5. Save the password in a password manager. Do not put it in the web project.
6. Select the nearest available region to your expected users, preferably an India or nearby Asia region if available.
7. Keep the Free plan selected.
8. Click **Create new project**.
9. Wait until the dashboard opens and the project is ready.

## Part C — Run the Version 1 database script

1. In your extracted project, open:

```text
supabase\01_version_1_schema.sql
```

2. In Supabase, open **SQL Editor** from the left menu.
3. Click **New query**.
4. In VS Code, open the SQL file.
5. Press `Ctrl + A` inside the SQL file.
6. Press `Ctrl + C`.
7. Return to the Supabase SQL editor.
8. Click inside the editor.
9. Press `Ctrl + V`.
10. Click **Run**.
11. Wait for a success message.

The script creates:

- `profiles`
- `organizations`
- `organization_members`
- `audit_logs`
- authentication trigger
- school-creation function
- roles
- Row Level Security policies

If you accidentally run the same file twice, it is designed to avoid most duplicate-object errors.

## Part D — Get the Project URL and publishable key

1. In Supabase, click **Connect** near the top of the project dashboard.
2. Find the **Project URL**.
3. Copy it temporarily into Notepad.
4. Find the **Publishable key**, beginning with something similar to `sb_publishable_`.
5. Copy it into Notepad.

The publishable key is designed for browser use when Row Level Security is enabled. Never copy a secret key or service-role key into `.env.local`.

## Part E — Create `.env.local`

1. In VS Code, locate `.env.example` in the project root.
2. Right-click it.
3. Click **Copy**.
4. Right-click the empty area in the Explorer panel.
5. Click **Paste**.
6. Rename the copy to exactly:

```text
.env.local
```

7. Open `.env.local`.
8. Replace the sample values with your real Project URL and publishable key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REFERENCE.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_REAL_KEY
```

9. Save with `Ctrl + S`.
10. Do not add quotation marks.
11. Do not add spaces before or after the equals sign.
12. Never send `.env.local` to anyone.

The `.gitignore` file prevents `.env.local` from being committed to GitHub.

## Part F — Restart the local app

Environment variables are read when the development server starts.

1. If `npm run dev` is running, stop it with `Ctrl + C`.
2. Start it again:

```powershell
npm run dev
```

3. Open:

```text
http://localhost:3000/setup-check/
```

Expected result:

- Supabase environment keys: green.
- Database schema: green.
- Google OAuth may remain pending until the next guide is completed.

## Part G — Configure authentication URLs for local use

1. In Supabase, open **Authentication**.
2. Open **URL Configuration**.
3. Set **Site URL** temporarily to:

```text
http://localhost:3000
```

4. Add this Redirect URL:

```text
http://localhost:3000/auth/callback/
```

5. Save.

Later, after Hostinger deployment, you will add the production URL without removing the local URL.

## Part H — Enable email registration

1. Open **Authentication**.
2. Open **Providers**.
3. Open **Email**.
4. Ensure email/password sign-up is enabled.
5. Keep **Confirm email** enabled for a proper public platform.
6. Save.

During early testing, you may temporarily disable confirmation if the default email limit becomes inconvenient, but re-enable confirmation before public launch.

## Part I — Create the first student account

1. Open:

```text
http://localhost:3000/login/
```

2. Click **Register**.
3. Enter your name.
4. Enter an email address you control.
5. Enter a password of at least six characters.
6. Click **Create account**.
7. Open the verification email.
8. Click the verification link.
9. Return to the login page.
10. Log in.

## Part J — Make your account super admin

1. In the project folder, open:

```text
supabase\02_make_me_super_admin.sql
```

2. Replace `YOUR_EMAIL_HERE` in both places with your registered email.
3. Copy the complete SQL.
4. Open Supabase **SQL Editor**.
5. Create a new query.
6. Paste the SQL.
7. Click **Run**.
8. The result should show your email and role as `super_admin`.
9. Log out of ScholarOS and log in again so the refreshed profile is loaded.

## Part K — Test school registration using the live database

1. Log in using a separate email account that should become an school owner, or change your account back to student for testing.
2. Open:

```text
http://localhost:3000/school/register/
```

3. Complete the form.
4. Submit it.
5. In Supabase, open **Table Editor**.
6. Open `organizations` and confirm the school record appears.
7. Open `organization_members` and confirm the owner membership appears.
8. Open `profiles` and confirm the user role changed to `school_owner`.
9. Open `audit_logs` and confirm `organization.created` appears.

## Part L — Security rule

The browser may contain only:

- Project URL
- Publishable key

The browser must never contain:

- Secret key
- Service-role key
- Database password
- Razorpay secret

Those future secrets will be stored inside Supabase Edge Functions, not in the website files.
