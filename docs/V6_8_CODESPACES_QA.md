# Evidara V6.8.0 Codespaces Production QA Checklist

Use this checklist only on branch `evidara-v6-8-production-qa`.

This is a validation release. Do not deploy, connect Vercel, merge to `main`, or replace Razorpay Test Mode credentials with Live Mode credentials while completing this checklist.

## 1. Confirm branch and clean workspace

```bash
git branch --show-current
git status --short
git log -1 --oneline
```

Expected:

- current branch is exactly `evidara-v6-8-production-qa`
- the working tree is clean before testing
- the branch contains the V6.8 QA commits

## 2. Install and run the complete automated gate

```bash
npm ci
npm run qa
```

`npm run qa` must complete all four stages:

1. ESLint
2. TypeScript typecheck
3. V6.8 static smoke checks
4. production Next.js build

Do not continue to launch testing if any stage fails.

## 3. Configure Codespaces secrets safely

Use Codespaces repository or user secrets. Do not commit a populated `.env.local`.

Required application values:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
```

For a forwarded Codespaces port, set `NEXT_PUBLIC_APP_URL` to the exact HTTPS forwarded origin without a trailing slash. Add the same origin to Supabase Authentication URL Configuration and to the Supabase Edge Function `APP_ORIGINS` secret.

Razorpay values remain in Supabase Edge Function secrets, not browser environment variables:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
APP_ORIGINS
```

The key ID must begin with `rzp_test_` during this QA cycle.

## 4. Start the application

```bash
npm run dev
```

Open the forwarded port as a private HTTPS URL. Keep the port visibility private unless a temporary public callback is required for OAuth testing.

## 5. Public health and configuration checks

Open:

```text
/api/health
/api/config
```

Expected:

- release is `6.8.0`
- deployment target is `cloudflare-workers`
- `qaRelease` is `true`
- configured cloud mode reports `supabase`
- partial Supabase configuration reports a clear issue instead of silently switching to demo data

No response may expose a service-role key, Razorpay secret, webhook secret, access token or API token.

## 6. Super Admin readiness dashboard

Sign in with a real `super_admin` profile and open:

```text
/admin/readiness/
```

Expected:

- non-authenticated users are redirected to login
- school and student roles are denied and redirected to their own workspace
- the Super Admin sees release, configuration, Supabase, migration 24, Razorpay and access-control sections
- failed checks show a direct corrective action
- secret presence is shown only as a boolean readiness result
- refreshing diagnostics does not create or modify business records

## 7. Supabase database and authentication diagnostics

The following checks must pass:

- public project URL and publishable key are present
- server-only service-role key belongs to the same Supabase project
- `profiles`, `organizations`, `products` and `orders` are queryable
- Supabase Auth Admin can list a one-user sample without returning user details to the browser
- the signed-in diagnostic identity is `super_admin`

Test a missing or incorrect service-role key in a temporary Codespaces environment. The readiness page must show an actionable blocked state and authenticated server APIs must fail closed.

## 8. Migration 24 readiness

Confirm migration 24 has been applied to the connected QA database:

```text
supabase/24_voucher_offline_payment_hardening.sql
```

The readiness page must confirm:

- `voucher_codes` exists
- `voucher_redemptions` exists
- `orders` contains `voucher_id`, `payment_source`, `offline_reference` and `commerce_metadata`
- `fulfill_voucher_order` exists and rejects the zero-UUID probe with `Order not found`

Also manually verify in Supabase SQL Editor:

```sql
select to_regclass('public.voucher_codes') is not null as voucher_codes_ready;
select to_regclass('public.voucher_redemptions') is not null as voucher_redemptions_ready;
select to_regprocedure('public.fulfill_voucher_order(uuid)') is not null as voucher_fulfilment_ready;
```

All three values must be `true`.

## 9. Deploy only the diagnostic function to the QA Supabase project

This repository release includes:

```text
supabase/functions/readiness-check
```

For Codespaces QA, deploy it manually to the non-production or designated QA Supabase project with JWT verification enabled:

```bash
supabase functions deploy readiness-check
```

This command is a manual QA prerequisite, not part of the GitHub Actions workflow. Do not deploy application code from this branch.

## 10. Razorpay Test Mode diagnostics

From `/admin/readiness/`, confirm:

- Test Mode key detected
- no Live Mode key detected
- key ID and key secret are both present
- webhook secret is present
- `APP_ORIGINS` is configured
- the current `NEXT_PUBLIC_APP_URL` origin is allowed
- Razorpay accepts the Test Mode credential pair

If a Live Mode key is detected, stop. The diagnostic intentionally skips API validation for Live Mode credentials.

## 11. Protected-route smoke checks

Test these routes in separate browser profiles or Incognito sessions:

| Role | `/admin/readiness/` | `/school/` | `/student/` |
|---|---:|---:|---:|
| Super Admin | Allow | Redirect to admin | Allow |
| Institute Admin / Teacher | Redirect to school | Allow | Allow |
| Student | Redirect to student | Redirect to student | Allow |
| Signed out | Redirect to login | Redirect to login | Redirect to login |

Also call the readiness API without an Authorization header:

```bash
curl -i https://<codespace-origin>/api/admin/readiness
```

With Supabase configured, the response must be `401` with a clear sign-in message. A signed-in non-Super Admin request must return `403`.

## 12. Razorpay Test Mode transaction smoke test

Use a low-value published test product and a test user.

### Standard paid order

- create the order
- complete Razorpay Test Mode Checkout
- verify signature, amount, currency and captured status server-side
- confirm exactly one payment and one entitlement
- replay the webhook and confirm fulfilment remains idempotent

### Partial voucher

- create a 25% voucher
- confirm the Razorpay order amount is reduced correctly
- complete payment
- confirm the voucher redemption ledger records the discount

### Offline-paid 100% voucher

- bind the voucher to the exact account email or school
- add amount and receipt, invoice, UTR or transaction reference
- confirm Checkout does not open
- confirm one zero-value order, entitlement and immutable redemption record

### Rejection cases

Every rejection must fail without granting access:

- wrong account
- wrong school or product
- expired or not-yet-active voucher
- usage limit reached
- tampered amount
- invalid payment signature
- invalid webhook signature

## 13. Error-message review

Force and review these errors:

- missing Supabase public configuration
- missing service-role key
- expired Supabase session
- non-Super Admin diagnostics request
- migration 24 table missing
- readiness Edge Function not deployed
- Razorpay Test Mode credentials rejected
- canonical origin absent from `APP_ORIGINS`

Each message must name the failing dependency and the next corrective action. It must not expose secret values or internal stack traces.

## 14. Pull-request evidence

Attach or record in the draft pull request:

- successful GitHub Actions QA run
- `npm run qa` result from Codespaces
- `/api/health` release result
- readiness dashboard summary counts
- migration 24 SQL confirmation
- Razorpay Test Mode credential diagnostic result
- one successful Test Mode order
- one successful webhook replay/idempotency check
- role-routing results

Do not mark the pull request ready for review until all blockers are resolved. Do not merge or deploy as part of this checklist.
