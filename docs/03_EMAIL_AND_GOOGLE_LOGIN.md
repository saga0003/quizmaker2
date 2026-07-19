# 03 — Email and Google Login: Every Step

## Part A — Test email/password login first

Before configuring Google, confirm email registration works using the previous guide. Google configuration is easier to troubleshoot when email login already works.

## Part B — Open Google Cloud Console

1. Open `https://console.cloud.google.com/`.
2. Sign in with the Google account that will own the application configuration.
3. At the top, click the current project selector.
4. Click **New Project**.
5. Project name: `ScholarOS`.
6. Click **Create**.
7. Wait for creation to complete.
8. Ensure the new ScholarOS project is selected.

## Part C — Configure the OAuth consent screen

Google’s wording may appear under **Google Auth Platform**.

1. Open the navigation menu.
2. Search for **Google Auth Platform** or **OAuth consent screen**.
3. Click **Get started** if shown.
4. App name: `ScholarOS`.
5. User support email: select your email.
6. Audience: choose **External** because students and schools may use different Google accounts.
7. Contact email: enter your email.
8. Accept the policy acknowledgement.
9. Save.
10. Add an app logo later if Google asks; `public/icon.svg` is included in the project.
11. During testing, add your own Google accounts as test users if Google keeps the app in testing mode.

## Part D — Get the Supabase callback URL

1. Open your Supabase project.
2. Open **Authentication**.
3. Open **Providers**.
4. Select **Google**.
5. Find and copy the callback URL shown by Supabase.

It normally looks like:

```text
https://YOUR_PROJECT_REFERENCE.supabase.co/auth/v1/callback
```

Copy the exact value shown in your dashboard.

## Part E — Create Google OAuth credentials

1. Return to Google Cloud Console.
2. Open **Google Auth Platform**.
3. Open **Clients**.
4. Click **Create client**.
5. Application type: **Web application**.
6. Name: `ScholarOS Web`.
7. Under **Authorized JavaScript origins**, add:

```text
http://localhost:3000
```

8. Later, add your production origin, for example:

```text
https://tests.yourdomain.com
```

9. Under **Authorized redirect URIs**, add the exact Supabase callback URL copied earlier.
10. Do not add `/auth/callback/` here. Google redirects to Supabase first.
11. Click **Create**.
12. Copy the Google Client ID.
13. Copy the Google Client Secret.
14. Keep both private.

## Part F — Enable Google inside Supabase

1. Return to Supabase.
2. Open **Authentication → Providers → Google**.
3. Enable the Google provider.
4. Paste the Google Client ID.
5. Paste the Google Client Secret.
6. Save.

## Part G — Confirm Supabase redirect URLs

1. Open **Authentication → URL Configuration**.
2. Confirm Site URL is:

```text
http://localhost:3000
```

3. Confirm Redirect URLs contains:

```text
http://localhost:3000/auth/callback/
```

4. Save.

## Part H — Test Google login locally

1. Restart the local app if needed:

```powershell
npm run dev
```

2. Open:

```text
http://localhost:3000/login/
```

3. Click **Continue with Google**.
4. Select your Google account.
5. Approve access.
6. Google sends you to Supabase.
7. Supabase sends you to:

```text
http://localhost:3000/auth/callback/
```

8. The callback page sends you to the student dashboard.
9. In Supabase, open **Authentication → Users** and confirm the user appears.
10. Open `profiles` and confirm a matching profile appears.

## Part I — Optional custom SMTP later

The Supabase default email sender is suitable for low-volume testing but has restrictions. Do not configure paid email now.

When registrations increase, create a free Brevo account and connect its SMTP details in Supabase **Authentication → SMTP Settings**. This is optional for Version 1 testing.

## Part J — Production Google URLs after deployment

After Hostinger is live, return to Google OAuth and add:

Authorized JavaScript origin:

```text
https://tests.yourdomain.com
```

In Supabase URL Configuration:

Site URL:

```text
https://tests.yourdomain.com
```

Additional Redirect URL:

```text
https://tests.yourdomain.com/auth/callback/
```

Keep the localhost redirect while development continues.
