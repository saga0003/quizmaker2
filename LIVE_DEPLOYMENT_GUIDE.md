# ScholarOS Version 2 — Complete Live Deployment Guide

This guide assumes:

- You use Windows.
- The project folder is already extracted.
- Node.js is installed.
- `npm.cmd install` worked.
- You have Hostinger hosting/server space.
- Your domain may use Hostinger nameservers or external nameservers such as GoDaddy.
- You want a free-first setup: Hostinger for files, Supabase Free for database/auth/functions, Brevo Free for email, and Razorpay Test Mode before real payments.

Do not upload `.env.local`, Razorpay Key Secret, Supabase secret/service key, SMTP password, or Google Client Secret to Hostinger.

---

## Part 1 — Decide the live address

Use a separate subdomain so the platform does not disturb your existing website.

Recommended format:

```text
tests.YOURDOMAIN.com
```

Throughout this guide, replace:

```text
https://tests.YOURDOMAIN.com
```

with your actual live address.

Keep the final address consistent. Do not alternate between `www`, non-`www`, HTTP and HTTPS.

---

## Part 2 — Create the Hostinger website/subdomain

### Method A — Domain uses Hostinger nameservers

1. Sign in to Hostinger hPanel.
2. Open **Websites**.
3. Click **Add website** or create a new empty website under your hosting plan.
4. Choose **Custom PHP/HTML website**. Do not select WordPress for this subdomain.
5. Enter the subdomain:

   ```text
   tests.YOURDOMAIN.com
   ```

6. Finish creating the website.
7. Open **Websites → Manage/Dashboard** for that subdomain.
8. Open **File Manager**.
9. Locate its root directory. It is normally named `public_html`.
10. Keep this tab open. We will upload the final ZIP later.

### Method B — Domain DNS is managed at GoDaddy or another provider

1. In Hostinger hPanel, find the hosting/server IPv4 address:
   - Open the hosting plan dashboard.
   - Open **Plan details**, **Server details**, **FTP accounts**, or **IP address**.
   - Copy the hosting IPv4 address.
2. In Hostinger, add the empty Custom PHP/HTML website for:

   ```text
   tests.YOURDOMAIN.com
   ```

3. Sign in to the company that controls your domain DNS, for example GoDaddy.
4. Open the DNS records for `YOURDOMAIN.com`.
5. Create an **A record**:

   ```text
   Type: A
   Name/Host: tests
   Value/Points to: YOUR_HOSTINGER_IPV4
   TTL: Default or 600 seconds
   ```

6. Save the record.
7. Wait for DNS propagation. It may start working quickly but can take longer.
8. Back in Hostinger, enable SSL for `tests.YOURDOMAIN.com`.
9. The final address must open with HTTPS:

   ```text
   https://tests.YOURDOMAIN.com
   ```

If Hostinger shows a placeholder page, that is acceptable at this stage.

---

## Part 3 — Create the Supabase Free project

1. Open Supabase and create/sign in to your account.
2. Click **New project**.
3. Select or create an organisation.
4. Project name:

   ```text
   rankmint-tests
   ```

5. Create a strong database password.
6. Save the password in a password manager. Do not put it into the website source.
7. Choose the nearest available region to your users in India.
8. Select the Free plan.
9. Click **Create new project**.
10. Wait until the project status is ready.

### Save the project reference

Your Supabase project URL looks like:

```text
https://abcdefghijk.supabase.co
```

The project reference is:

```text
abcdefghijk
```

Save both values.

---

## Part 4 — Create the Version 1 and Version 2 database

The Version 2 project contains these SQL files:

```text
supabase/01_version_1_schema.sql
supabase/03_version_2_commerce.sql
supabase/04_seed_version_2_products.sql
```

Run them in this exact order.

### Run file 1

1. In Supabase Dashboard, open **SQL Editor**.
2. Click **New query**.
3. In Windows File Explorer, open the project folder.
4. Open:

   ```text
   supabase\01_version_1_schema.sql
   ```

5. Press `Ctrl + A`, then `Ctrl + C`.
6. Paste it into the Supabase SQL Editor.
7. Click **Run**.
8. Wait for a successful result.

### Run file 2

1. Create another new query.
2. Open:

   ```text
   supabase\03_version_2_commerce.sql
   ```

3. Copy the complete file.
4. Paste into SQL Editor.
5. Click **Run**.
6. Wait for success.

This creates products, price versions, coupons, orders, payments, entitlements, webhook events, RLS policies and database functions.

### Run file 3 — sample live products

1. Create another new query.
2. Open:

   ```text
   supabase\04_seed_version_2_products.sql
   ```

3. Copy and run it.

This creates:

- NEET Complete Test Series — ₹5,999 shown as ₹1,999.
- JEE Main Practice Series — ₹3,999 shown as ₹1,499.
- School Starter Plan — ₹9,999 shown as ₹5,999.
- Coupon `LAUNCH10`.

### Verify tables

1. Open **Table Editor**.
2. Confirm these tables exist:

```text
profiles
organizations
organization_members
audit_logs
products
product_versions
coupons
orders
payments
entitlements
webhook_events
```

Do not manually disable Row Level Security.

---

## Part 5 — Get the two safe frontend Supabase values

1. In Supabase Dashboard, click **Connect**.
2. Choose the Next.js/app framework connection view, or open **Project Settings → API Keys**.
3. Copy:

```text
Project URL
Publishable key
```

The publishable key generally starts with:

```text
sb_publishable_
```

Do not copy a secret key or service-role key into `.env.local`.

---

## Part 6 — Create `.env.local`

1. Open the Version 2 project in Visual Studio Code.
2. In the Explorer panel, locate `.env.example`.
3. Right-click it and choose **Copy**.
4. Paste a copy in the same folder.
5. Rename the copied file to:

```text
.env.local
```

6. Open `.env.local`.
7. Enter your real values:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_REAL_KEY
```

8. Save with `Ctrl + S`.

The `NEXT_PUBLIC` values are intentionally available to the browser. Database security is enforced using login tokens and RLS. Never add a Supabase secret/service key here.

---

## Part 6A — Enter your legal and support details

Before accepting real payments, edit:

```text
src\config\site.ts
```

Replace every placeholder with your actual information:

```ts
legalEntityName: "Your registered business/proprietor name"
supportEmail: "your real support email"
supportPhone: "your real support number"
businessAddress: "your business address"
websiteUrl: "https://tests.YOURDOMAIN.com"
```

Save the file. The Terms, Privacy, Refund and Contact pages use these values. The `/setup-check/` page remains red until all placeholders are replaced. These pages are structured starter policies, not a substitute for legal review.

Test these routes after deployment:

```text
/terms/
/privacy/
/refund-policy/
/contact/
```

---

## Part 7 — Build the live Hostinger frontend

### Easy script method

1. Open PowerShell in the project folder.
2. Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\BUILD_FOR_HOSTINGER.ps1
```

The script will:

- Confirm `.env.local` exists.
- Install dependencies.
- Build the production site.
- Create:

```text
rankmint-tests-v2-hostinger-upload.zip
```

### Manual method

Run:

```powershell
npm.cmd install
npm.cmd run build
```

The production files will be inside:

```text
out
```

To make a ZIP manually:

1. Open the `out` folder.
2. Select everything inside `out`.
3. Right-click → **Compress to ZIP file**.
4. Name it:

```text
rankmint-tests-v2-hostinger-upload.zip
```

Do not ZIP the outer `out` folder itself. The ZIP root must directly contain `index.html`, `_next`, `products`, `login`, and other route folders.

---

## Part 8 — Upload the frontend to Hostinger

1. Open Hostinger hPanel.
2. Open the website for `tests.YOURDOMAIN.com`.
3. Open **File Manager**.
4. Open the website root, usually:

```text
public_html
```

5. Delete the Hostinger placeholder `index.php` or placeholder `index.html` if present.
6. Upload:

```text
rankmint-tests-v2-hostinger-upload.zip
```

7. Select the uploaded ZIP.
8. Click **Extract**.
9. Extract into the current root folder.
10. Confirm these are directly inside `public_html`:

```text
index.html
_next
admin
auth
school
login
products
reset-password
setup-check
student
trial
```

11. Delete the uploaded ZIP after extraction if you want to save server storage.
12. Open:

```text
https://tests.YOURDOMAIN.com
```

13. Test:

```text
https://tests.YOURDOMAIN.com/products/
https://tests.YOURDOMAIN.com/trial/
https://tests.YOURDOMAIN.com/setup-check/
```

The setup check should confirm Supabase environment keys and Version 2 database connectivity.

---

## Part 9 — Configure Supabase production URLs

1. Open Supabase Dashboard.
2. Open **Authentication → URL Configuration**.
3. Set **Site URL**:

```text
https://tests.YOURDOMAIN.com
```

4. Add the following Redirect URLs one by one:

```text
https://tests.YOURDOMAIN.com/auth/callback/
https://tests.YOURDOMAIN.com/reset-password/
http://localhost:3000/auth/callback/
http://localhost:3000/reset-password/
```

5. Save.

The production URLs must exactly match the HTTPS domain and trailing route used by the app.

---

## Part 10 — Configure authentication email using Brevo Free

Supabase's built-in test email provider is too restricted for a public launch. Configure custom SMTP.

### Create Brevo SMTP credentials

1. Create/sign in to Brevo.
2. Verify your account.
3. Add a sender email such as:

```text
no-reply@YOURDOMAIN.com
```

4. Authenticate your domain in Brevo by adding the DNS records it provides.
5. Open **Settings → SMTP & API → SMTP**.
6. Click **Generate a new SMTP key**.
7. Name it:

```text
ScholarOS Supabase
```

8. Copy the SMTP key immediately and store it securely.
9. Note the SMTP login/username displayed by Brevo.

### Add SMTP to Supabase

1. In Supabase, open **Authentication → SMTP Settings / Custom SMTP**.
2. Enable custom SMTP.
3. Enter:

```text
Sender name: ScholarOS
Sender email: no-reply@YOURDOMAIN.com
Host: smtp-relay.brevo.com
Port: 587
Username: your Brevo SMTP login
Password: your Brevo SMTP key
```

4. Save.
5. Keep email confirmation enabled under the Email provider settings.

### Test email registration

1. Open the live login page.
2. Select **Register**.
3. Use an email address you can access.
4. Create the account.
5. Open the confirmation email.
6. Click the confirmation link.
7. Confirm the browser returns to:

```text
https://tests.YOURDOMAIN.com/auth/callback/
```

8. Confirm the student dashboard opens.

---

## Part 11 — Make your account the super admin

First register your own account on the live website and confirm its email.

Then:

1. Open Supabase SQL Editor.
2. Open the included file:

```text
supabase\02_make_me_super_admin.sql
```

3. Replace:

```text
YOUR_EMAIL_HERE
```

with the exact email used for your account. Replace both occurrences.

Example:

```sql
where id = (
  select id from auth.users where email = 'your-real-email@example.com'
);
```

4. Run the SQL.
5. Sign out of ScholarOS.
6. Sign in again.
7. You should be redirected to:

```text
/admin/
```

8. Open:

```text
/admin/products/
```

9. Confirm the sample products appear.
10. Edit a product, change a price, and save.
11. Open `/products/` in another tab and confirm the changed price is visible.

Every price edit creates a new product-version record, preserving previous order history.

---

## Part 12 — Configure Google login

### Get the Supabase Google callback URL

1. In Supabase, open **Authentication → Sign In / Providers → Google**.
2. Copy the callback URL shown there. It normally resembles:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

Use the exact URL shown by Supabase.

### Create the Google OAuth application

1. Open Google Cloud Console.
2. Create a new project named:

```text
ScholarOS
```

3. Open **APIs & Services → OAuth consent screen**.
4. Configure the application name:

```text
ScholarOS
```

5. Add your support email and developer email.
6. Add the application domain if requested.
7. Add your own Google account as a test user if the consent screen is still in testing mode.
8. Open **Credentials**.
9. Click **Create Credentials → OAuth client ID**.
10. Application type: **Web application**.
11. Name:

```text
ScholarOS Web
```

12. Under **Authorized JavaScript origins**, add:

```text
https://tests.YOURDOMAIN.com
http://localhost:3000
```

13. Under **Authorized redirect URIs**, add the Supabase callback URL copied earlier:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

14. Create the credential.
15. Copy the Google Client ID and Client Secret.

### Enable Google in Supabase

1. Return to Supabase Google provider settings.
2. Enable Google.
3. Paste the Google Client ID.
4. Paste the Google Client Secret.
5. Save.

### Test Google login

1. Sign out of ScholarOS.
2. Open the live `/login/` page.
3. Click **Continue with Google**.
4. Select an account.
5. Accept the consent screen.
6. Confirm you return to `/auth/callback/` and then the correct dashboard.

---

## Part 13 — Create Razorpay Test Mode keys

Use Test Mode first. No real money moves in Test Mode.

1. Sign in to Razorpay Dashboard.
2. Switch the dashboard to **Test Mode**.
3. Open **Account & Settings → API Keys**.
4. Click **Generate Key**.
5. Download or copy:

```text
Key ID
Key Secret
```

6. Store the Key Secret securely. It is confidential.
7. Create a long random webhook secret. Example format:

```text
RM_TEST_WEBHOOK_very-long-random-value
```

Do not use this example literally.

---

## Part 14 — Deploy the three secure Supabase Edge Functions

The frontend is static, so payment secrets are handled by Supabase Edge Functions.

### Confirm Node.js version

Run:

```powershell
node --version
```

Use Node.js 20 or newer for `npx supabase`.

### Login and link the project

In PowerShell inside the project folder, run:

```powershell
npx.cmd supabase login
```

Complete the browser login.

Then run, replacing the project reference:

```powershell
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
```

### Set the three Razorpay secrets

Run this as one command, replacing all values:

```powershell
npx.cmd supabase secrets set RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET RAZORPAY_WEBHOOK_SECRET=YOUR_LONG_WEBHOOK_SECRET
```

These values are stored in Supabase, not in Hostinger files.

### Deploy functions

Run each command:

```powershell
npx.cmd supabase functions deploy create-razorpay-order --no-verify-jwt
```

```powershell
npx.cmd supabase functions deploy verify-razorpay-payment --no-verify-jwt
```

```powershell
npx.cmd supabase functions deploy razorpay-webhook --no-verify-jwt
```

`--no-verify-jwt` is intentional. The two customer-facing functions manually validate the user's Supabase access token, while the webhook validates Razorpay's HMAC signature.

### Confirm function URLs

In Supabase Dashboard, open **Edge Functions**. Confirm all three are deployed.

The webhook URL is:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook
```

---

## Part 15 — Add the Razorpay webhook

1. Open Razorpay Dashboard in Test Mode.
2. Open **Account & Settings → Webhooks**.
3. Click **Add New Webhook**.
4. Webhook URL:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/razorpay-webhook
```

5. Webhook secret: enter the exact same value used for `RAZORPAY_WEBHOOK_SECRET`.
6. Select these events:

```text
payment.captured
order.paid
```

7. Save and activate the webhook.

The webhook is a reconciliation path. The browser payment handler also verifies the checkout signature server-side before access is granted.

---

## Part 16 — Complete the first Test Mode purchase

1. Open:

```text
https://tests.YOURDOMAIN.com/login/
```

2. Sign in as a student account, not the super-admin account if possible.
3. Open:

```text
https://tests.YOURDOMAIN.com/products/
```

4. Enter coupon:

```text
LAUNCH10
```

5. Click **Buy & get instant access** on a student package.
6. Razorpay Test Checkout should open.
7. Use Test Mode UPI:

```text
success@razorpay
```

8. Complete the simulated payment.
9. You should be redirected to:

```text
/student/purchases/?payment=success
```

10. Confirm the package appears under **Active access**.
11. Open Supabase Table Editor and verify:

```text
orders: status = paid
payments: status = captured
entitlements: status = active
webhook_events: processed = true
```

12. Open Razorpay Test Dashboard and confirm the test payment appears.

### Test failure flow

Repeat and use:

```text
failure@razorpay
```

Confirm no entitlement is created.

---

## Part 17 — Test school purchase

1. Register a second account or use an school-owner account.
2. Sign in.
3. Open:

```text
/school/register/
```

4. Create the school workspace.
5. Open `/products/`.
6. Select the School filter.
7. Purchase School Starter Plan in Test Mode.
8. Confirm the entitlement record has `organization_id`, not `user_id`.

The product is tied to the school workspace.

---

## Part 18 — Change a product price live

1. Sign in as super admin.
2. Open:

```text
/admin/products/
```

3. Click **Edit** beside a product.
4. Change:

```text
List price ₹
Selling price ₹
Access days
Maximum attempts
Student limit
Features
Status
Featured flag
```

5. Click **Save new product version**.
6. Open `/products/`.
7. Confirm the new price is live.

Existing paid orders keep their original `product_version_id` and historical amount.

---

## Part 19 — Switch Razorpay from Test Mode to real payments later

Do not switch until:

- Your live website is complete enough for Razorpay review.
- Required legal pages are published.
- Razorpay KYC and website verification are complete.
- Test payment success and failure paths work.

When Razorpay provides live keys:

1. Switch Razorpay Dashboard to Live Mode.
2. Generate the Live Key ID and Secret.
3. Update Supabase secrets:

```powershell
npx.cmd supabase secrets set RAZORPAY_KEY_ID=rzp_live_YOUR_KEY_ID RAZORPAY_KEY_SECRET=YOUR_LIVE_KEY_SECRET RAZORPAY_WEBHOOK_SECRET=YOUR_LIVE_WEBHOOK_SECRET
```

4. Add a separate webhook in Razorpay Live Mode with the live webhook secret.
5. You normally do not need to rebuild or re-upload the Hostinger frontend because the public Key ID is returned by the Edge Function.
6. Complete one small controlled real transaction.
7. Verify settlement/capture and access before announcing the store publicly.

---

## Part 20 — How to deploy every future version

For each new version:

1. Download and extract the new source package into a new version folder.
2. Copy your existing `.env.local` into the new version folder.
3. Run any new SQL migration files in numerical order.
4. Deploy any added/changed Edge Functions.
5. Run locally:

```powershell
npm.cmd install
npm.cmd run dev
```

6. Test the key pages.
7. Build:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\BUILD_FOR_HOSTINGER.ps1
```

8. In Hostinger, download a backup of the current `public_html` or rename it temporarily.
9. Delete old frontend files from the subdomain root.
10. Upload and extract the new Hostinger ZIP.
11. Test login, products, trial exam and dashboards on the live domain.

Database data remains in Supabase and is not erased when frontend files are replaced.

---

## Part 21 — Version 2 live acceptance checklist

Mark every line complete:

```text
[ ] HTTPS domain opens
[ ] Homepage loads on desktop
[ ] Homepage loads on mobile
[ ] /setup-check/ reaches Version 2 database
[ ] Email registration sends confirmation
[ ] Password reset email works
[ ] Google login works
[ ] Student dashboard opens
[ ] School registration creates an organisation
[ ] Super-admin account redirects to /admin/
[ ] Admin product manager creates a product
[ ] Product price edit appears publicly
[ ] Razorpay Test Checkout opens
[ ] Successful Test payment creates a paid order
[ ] Successful Test payment creates an entitlement
[ ] Failed Test payment creates no entitlement
[ ] Coupon LAUNCH10 applies once per user
[ ] Student purchase history shows access
[ ] School plan attaches access to organisation
[ ] Razorpay webhook event is processed
[ ] No secret key appears in Hostinger files
```

---

## Part 22 — Common errors

### `Demo Mode is active`

The production build did not contain Supabase values.

Fix:

1. Confirm `.env.local` exists in the project root.
2. Confirm both values are real.
3. Run `npm.cmd run build` again.
4. Re-upload the contents of the new `out` folder.

### Google returns to localhost

Fix Supabase **Site URL** and exact Redirect URL allow-list entries.

### `Product is not available`

The public page is showing a stale/demo build, or the product ID does not exist in the live Supabase project.

Fix:

1. Rebuild with `.env.local`.
2. Run the seed SQL in the same Supabase project.
3. Refresh `/products/`.

### `Failed to send a request to the Edge Function`

Possible causes:

- Edge Function is not deployed.
- Supabase project reference is wrong.
- Browser has blocked the request.
- User is not logged in.

Check Supabase **Edge Functions → Logs**.

### `Razorpay secrets are not configured`

Run `npx.cmd supabase secrets set ...` with all three values.

### Payment succeeds but access is missing

1. Check `orders` status.
2. Check Edge Function logs for `verify-razorpay-payment`.
3. Check webhook logs.
4. Confirm `fulfill_paid_order` exists by rerunning the Version 2 commerce SQL only if it was never run.
5. Do not manually grant access until the transaction has been verified in Razorpay.

### Hostinger shows `Index of /`

`index.html` is not directly inside the website root. Move the contents out of an extra nested folder.

### Direct page gives 404

Confirm route folders such as `products/index.html` were uploaded and that you are using the trailing-slash URL:

```text
/products/
```

---

## Security rules

- Never place Razorpay Key Secret in `.env.local`.
- Never place Supabase secret/service key in frontend files.
- Never upload `.env.local` to Hostinger.
- Never grant access from a browser-only success message.
- Keep RLS enabled.
- Use HTTPS before Google OAuth or payments.
- Test both payment success and failure.
- Keep the webhook secret different from the Razorpay Key Secret.
- Regenerate credentials immediately if a secret is exposed.
