# 05 — Put Version 1 Live on Hostinger: Every Step

Version 1 uses Next.js static export. The generated `out` folder contains ordinary HTML, CSS, JavaScript, SVG, and font files. It can be hosted on regular Hostinger web space without AWS and without a running Node.js server.

## Recommended structure

Do not overwrite an existing main website. Use a subdomain such as:

```text
tests.yourdomain.com
```

Replace `yourdomain.com` with your real domain.

## Part A — Create the Hostinger subdomain

1. Log in to Hostinger hPanel.
2. Click **Websites**.
3. Locate the website connected to your main domain.
4. Click **Dashboard** or **Manage**.
5. In the left menu, open **Domains**.
6. Open **Subdomains**.
7. Enter:

```text
tests
```

8. Choose your domain.
9. Keep Hostinger’s default folder unless you have a specific reason to change it.
10. Click **Create**.
11. Hostinger creates a folder for the subdomain.
12. Wait until the subdomain appears in hPanel.

If your plan asks you to add a separate website instead, choose **Add website**, select a custom HTML/PHP type or empty website, and assign `tests.yourdomain.com`.

## Part B — Add production URLs to Supabase before building

1. Open Supabase.
2. Open **Authentication → URL Configuration**.
3. Set Site URL to:

```text
https://tests.yourdomain.com
```

4. Add Redirect URL:

```text
https://tests.yourdomain.com/auth/callback/
```

5. Keep the localhost redirect as an additional allowed redirect.
6. Save.

## Part C — Add production origin to Google

1. Open Google Cloud Console.
2. Open ScholarOS project.
3. Open Google Auth Platform → Clients.
4. Open `ScholarOS Web`.
5. Under Authorized JavaScript origins, add:

```text
https://tests.yourdomain.com
```

6. Keep the existing Supabase callback under Authorized redirect URIs.
7. Save.

## Part D — Build using your Supabase keys

1. Open the project in VS Code.
2. Confirm `.env.local` contains your real Supabase Project URL and publishable key.
3. Open Terminal.
4. Stop the development server with `Ctrl + C` if it is running.
5. Run:

```powershell
npm run build
```

6. Wait for a successful build.
7. Open the project folder in File Explorer.
8. Open the new `out` folder.
9. Confirm `index.html` is directly inside `out`.

Important: Next.js embeds the public Supabase values into the built JavaScript. If you change `.env.local`, you must run `npm run build` again.

## Part E — Create the upload ZIP correctly

The contents of `out` must be at the root of the ZIP. Do not put the `out` folder itself inside another folder level.

1. Open the `out` folder.
2. Press `Ctrl + A` to select everything inside it.
3. Right-click the selected files.
4. Choose **Compress to ZIP file** or **Send to → Compressed (zipped) folder**.
5. Name it:

```text
rankmint-tests-live.zip
```

6. Move the ZIP somewhere easy to find, such as Desktop.

Correct ZIP structure:

```text
index.html
_next\
login\
student\
trial\
icon.svg
```

Incorrect ZIP structure:

```text
out\index.html
```

## Part F — Find the correct Hostinger folder

1. In hPanel, open **Websites**.
2. Open the dashboard for the subdomain or parent website.
3. Open **File Manager**.
4. Find the document root assigned to `tests.yourdomain.com`.
5. It may be a folder such as:

```text
public_html\tests
```

or a separate site folder containing its own `public_html`.

6. The correct folder is the one Hostinger displays as the subdomain’s root.
7. Do not upload into the main website’s `public_html` unless the subdomain is explicitly mapped there.

## Part G — Back up anything already in the target folder

1. Select existing files in the subdomain folder.
2. Download or rename them if they are important.
3. A default `index.php` or `index.html` may exist.
4. Remove the default file only after confirming it belongs to the new empty subdomain.
5. Never delete files from your main website by mistake.

## Part H — Upload and extract

1. Open the correct subdomain root folder.
2. Click **Upload**.
3. Select `rankmint-tests-live.zip`.
4. Wait for upload to finish.
5. Right-click the uploaded ZIP.
6. Click **Extract**.
7. Choose the current folder as the extraction destination.
8. Confirm extraction.
9. After extraction, confirm `index.html` is directly inside the document root.
10. Confirm `_next`, `login`, `student`, `trial`, and other folders are beside it.
11. Delete the uploaded ZIP after successful extraction to save server space.

## Part I — Confirm SSL

1. In hPanel, open the website dashboard.
2. Open **Security → SSL**.
3. Confirm free SSL is active for the subdomain.
4. If it is pending, wait for DNS to finish and use Hostinger’s Install SSL option.
5. Enable or force HTTPS after the certificate is active.

## Part J — Open the live website

Open:

```text
https://tests.yourdomain.com
```

Then test:

```text
https://tests.yourdomain.com/login/
https://tests.yourdomain.com/auth/callback/
https://tests.yourdomain.com/student/
https://tests.yourdomain.com/school/
https://tests.yourdomain.com/school/register/
https://tests.yourdomain.com/admin/
https://tests.yourdomain.com/trial/
https://tests.yourdomain.com/setup-check/
```

## Part K — Test production Google login

1. Open the live login page in an Incognito window.
2. Click **Continue with Google**.
3. Select an account.
4. Confirm Google returns to Supabase.
5. Confirm Supabase returns to:

```text
https://tests.yourdomain.com/auth/callback/
```

6. Confirm the student dashboard opens.

## Part L — Updating the live site later

Whenever code changes:

1. Save all files.
2. Test locally using `npm run dev`.
3. Stop the dev server.
4. Run `npm run build`.
5. ZIP the contents of the new `out` folder.
6. Upload to the same Hostinger root.
7. Replace old files.
8. Keep user data safe because it is stored in Supabase, not in Hostinger files.
9. Clear Hostinger cache if an old version still appears.
10. Hard-refresh Chrome using `Ctrl + Shift + R`.

## Alternative: Hostinger Node.js Apps

Some Hostinger plans show **Node.js Apps** or **Web Apps** and can deploy Next.js directly from GitHub. Version 1 does not require this because static upload works on broader plans and is easier for a beginner. We can move to Git-based automatic deployment later without changing the Supabase database.
