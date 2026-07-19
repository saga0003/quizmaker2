# 07 — Common Errors and Exact Fixes

## `node` is not recognised

Cause: Node.js is not installed or Windows did not refresh PATH.

Fix:

1. Install Node.js LTS.
2. Close VS Code.
3. Restart Windows.
4. Reopen VS Code.
5. Run `node -v`.

## `npm install` fails because PowerShell scripts are disabled

Try running the same command in Command Prompt:

1. In VS Code terminal, click the dropdown beside the plus icon.
2. Select **Command Prompt**.
3. Run `npm install`.

Alternatively, open Windows Command Prompt in the project folder.

## Port 3000 is already in use

Next.js will normally offer another port. Open the URL shown in the terminal.

To stop the old server, find its terminal and press `Ctrl + C`.

## Demo Mode still appears after adding Supabase

1. Confirm the filename is exactly `.env.local`.
2. Confirm it is in the same folder as `package.json`.
3. Confirm the variable names are exact.
4. Stop the dev server.
5. Run `npm run dev` again.
6. Refresh the browser.

## Database setup check is red

1. Confirm `01_version_1_schema.sql` ran successfully.
2. Open Supabase Table Editor and confirm `profiles` exists.
3. Confirm the Project URL belongs to the correct project.
4. Confirm the publishable key belongs to the same project.
5. Remove accidental spaces or quotation marks from `.env.local`.
6. Restart the app.

## Registration succeeds but no profile appears

1. Open Supabase SQL Editor.
2. Confirm the `on_auth_user_created` trigger exists.
3. Run the Version 1 schema again.
4. Delete the failed test user from Authentication → Users.
5. Register again.

## Google says redirect URI mismatch

The Google Authorized redirect URI must be the Supabase callback URL, not the ScholarOS callback page.

Correct Google redirect URI:

```text
https://YOUR_PROJECT_REFERENCE.supabase.co/auth/v1/callback
```

The ScholarOS `/auth/callback/` address belongs in Supabase Redirect URLs.

## Google returns to localhost after live deployment

1. Change Supabase Site URL to your production URL.
2. Add the exact production `/auth/callback/` URL.
3. Add the production origin to Google Authorized JavaScript origins.
4. Rebuild and upload again if any public environment value changed.

## Hostinger shows a blank page or default page

1. Confirm `index.html` is directly in the subdomain document root.
2. Confirm you did not upload the `out` folder as an extra nesting layer.
3. Delete Hostinger’s default `index.php` if it belongs to the empty subdomain.
4. Clear Hostinger cache.
5. Hard refresh using `Ctrl + Shift + R`.

## CSS or JavaScript is missing on Hostinger

1. Confirm the `_next` folder uploaded completely.
2. Confirm the ZIP was extracted successfully.
3. Check that `_next` is beside `index.html`.
4. Re-upload the build if files are missing.

## A page returns 404 on Hostinger

The project uses `trailingSlash: true`, so every page is exported as a folder containing `index.html`.

Open pages with a trailing slash during testing, for example:

```text
https://tests.yourdomain.com/trial/
```

If the folder is missing, upload a fresh complete build.

## Trial images do not display

Confirm these files exist in the uploaded root:

```text
trial/projectile.svg
trial/circuit.svg
trial/cell.svg
trial/graph.svg
```

They originate from the project’s `public/trial` folder.

## Build fails

1. Confirm you did not manually change package versions.
2. Run:

```powershell
npm install
```

3. Run:

```powershell
npm run build
```

4. Read the first red error, not the final generic error.
5. Do not run forced dependency upgrades.
