# Evidara V6.7.1 Production Setup

This guide activates the merged Evidara V6.7 assessment, benchmark, achievement and certificate release with:

- Supabase authentication, Postgres, Row Level Security and Edge Functions
- Razorpay Standard Checkout, server-side verification and webhooks
- Super Admin percentage vouchers from 1% to 100%
- auditable offline-payment and complimentary access records
- Cloudflare Workers deployment through the OpenNext adapter
- manual, controlled GitHub Actions deployment

Never paste production secrets into source files, browser code, support messages or screenshots.

## 1. Required accounts and identifiers

Prepare:

- a Supabase project
- a Razorpay account with Test Mode enabled first
- a Cloudflare account
- this GitHub repository with Actions enabled
- the final application domain, or a temporary `workers.dev` address

Record the following non-secret identifiers:

- Supabase project reference
- Cloudflare Account ID
- final application origin, for example `https://app.example.com`

## 2. Supabase database setup

Open Supabase Dashboard → SQL Editor and apply the SQL files in numeric order.

For an existing V6.7 database, apply only the new file after confirming migrations 1–23 are already present:

```text
supabase/24_voucher_offline_payment_hardening.sql
```

For a new database, apply all repository SQL files in numeric order through migration 24. Do not skip the earlier profile, commerce, school-lifecycle, benchmark, achievement or certificate migrations.

Migration 24 adds:

- `voucher_codes`
- `voucher_redemptions`
- voucher references and payment-source evidence on `orders`
- percentage validation from 1–100%
- account- or school-binding for 100% vouchers
- product, date, usage and per-account enforcement
- concurrency-safe short-lived voucher reservations
- service-role-only zero-value order fulfilment
- auditable offline-payment references

### Supabase application keys

In Supabase Dashboard → Project Settings → API, collect:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- Publishable key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- Service role key → `SUPABASE_SERVICE_ROLE_KEY`

The publishable key is intended for browser use with RLS. The service-role key bypasses RLS and must exist only as a server or deployment secret.

### Authentication URLs

In Supabase Dashboard → Authentication → URL Configuration:

- set Site URL to the production Cloudflare domain
- add the Cloudflare `workers.dev` preview during testing
- add the callback paths used by the application, including `/auth/callback/`
- remove obsolete preview origins after launch

For Google login, configure the Google OAuth client and copy the Supabase callback URL exactly as shown in the Supabase provider setup screen.

## 3. Razorpay setup

Start in Razorpay Test Mode.

In Razorpay Dashboard → Account & Settings → API Keys:

- generate a Test Key ID
- copy the Test Key Secret once
- store them as `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`

Configure automatic payment capture in the Razorpay Dashboard before live launch. Evidara grants paid access only after the payment is confirmed as captured.

### Webhook

Create a Razorpay webhook with this endpoint:

```text
https://<SUPABASE_PROJECT_REF>.supabase.co/functions/v1/razorpay-webhook
```

Subscribe at minimum to:

- `payment.captured`
- `order.paid`
- `payment.failed`

Generate a strong webhook secret and store the identical value as `RAZORPAY_WEBHOOK_SECRET` in Supabase.

The webhook function is deployed without Supabase JWT verification because Razorpay cannot provide a Supabase user token. It independently verifies the raw request body using Razorpay's HMAC signature before processing the event.

### Supabase Edge Function secrets

Set these in Supabase Dashboard → Edge Functions → Secrets, or use the included manual GitHub workflow:

```text
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
APP_ORIGINS
```

`APP_ORIGINS` is a comma-separated allow-list. During rollout it can contain both domains:

```text
https://evidara.<account-subdomain>.workers.dev,https://app.example.com
```

Do not add a trailing slash.

### Deploy Edge Functions

The repository contains:

```text
supabase/functions/create-razorpay-order
supabase/functions/verify-razorpay-payment
supabase/functions/razorpay-webhook
```

Manual CLI deployment:

```bash
supabase login
supabase link --project-ref <SUPABASE_PROJECT_REF>
supabase secrets set --env-file supabase/.env.functions.local
supabase functions deploy create-razorpay-order
supabase functions deploy verify-razorpay-payment
supabase functions deploy razorpay-webhook --no-verify-jwt
```

The included GitHub Actions workflow is:

```text
Deploy Evidara Supabase Payment Functions
```

It requires these GitHub production secrets:

```text
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_ID
RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET
EVIDARA_APP_ORIGINS
```

## 4. Voucher and offline-payment behaviour

Only a signed-in Super Admin can create or edit vouchers from:

```text
/admin/products/
```

Voucher rules:

- percentage discounts only
- minimum 1%, maximum 100%
- optional product restriction
- optional school restriction
- optional assigned email
- optional start and end time
- total and per-account usage limits
- 100% vouchers must be assigned to an email address or school
- offline-payment vouchers require the received amount and transaction, receipt or invoice reference

### Partial voucher

A 1–99% voucher reduces the internal order amount. Evidara creates a Razorpay Order for the remaining amount and grants access only after server-side signature, amount, currency and captured-status verification.

### 100% voucher

A valid 100% voucher does not create a fake Razorpay payment. Evidara instead:

1. creates a zero-value internal order
2. validates the voucher again inside Postgres
3. marks the order paid through a service-role-only function
4. grants the product entitlement
5. creates an immutable voucher redemption record
6. stores offline evidence when the purpose is `offline_payment`

This preserves a clean distinction between gateway payments and access already paid or approved outside Razorpay.

## 5. Cloudflare setup

Evidara is configured as a full-stack Next.js application on Cloudflare Workers using OpenNext.

### Find the Account ID

In Cloudflare Dashboard:

1. Open Workers & Pages.
2. Find Account details.
3. Copy Account ID.

You can also copy it from the account menu on Account Home.

### Create the API token

In Cloudflare Dashboard:

1. Open Manage Account → API Tokens, or My Profile → API Tokens.
2. Select Create Token.
3. Choose the `Edit Cloudflare Workers` template or create an equivalent custom token.
4. Restrict it to the single Cloudflare account used by Evidara.
5. Restrict zone access to the final domain when a custom route is required.
6. Copy the token once and store it as a GitHub Actions secret.

Use an API token, not the Global API Key.

### Zone ID

The current deployment workflow does not require a Zone ID. A Zone ID is needed only for direct DNS or route API automation. It can be copied from the domain Overview page under the API section.

### GitHub production secrets for Cloudflare

Create a protected GitHub environment named `production`, then add:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_APP_URL
SUPABASE_SERVICE_ROLE_KEY
```

The included workflow is:

```text
Deploy Evidara to Cloudflare
```

It runs only through manual `workflow_dispatch`. It validates the Next.js build, creates the OpenNext worker, deploys it with Wrangler and applies the server-only Supabase key as a Worker secret.

### First Cloudflare deployment

Run the workflow once and test the generated `workers.dev` domain.

Then in Cloudflare Workers & Pages:

1. open the `evidara` Worker
2. open Settings → Domains & Routes
3. add the final custom domain
4. update `NEXT_PUBLIC_APP_URL`
5. update Supabase Authentication URLs
6. update `APP_ORIGINS` in Supabase Edge Function secrets
7. redeploy the application and payment functions

## 6. Local validation

Install and validate the standard Next.js runtime:

```bash
npm ci
npm run check
```

Build for Cloudflare:

```bash
npm run cf:build
```

Preview in the Cloudflare `workerd` runtime:

```bash
npm run cf:preview
```

Do not treat `npm run dev` alone as Cloudflare production validation. The Next.js development server runs in Node.js, while the deployed Worker runs in Cloudflare's runtime.

## 7. Production test matrix

Complete these tests with Razorpay Test Mode keys before adding Live Mode keys.

### Platform and authentication

- `/api/health` returns `healthy: true`, release `6.7.1` and `deploymentTarget: cloudflare-workers`
- email login works
- Google login returns to the Cloudflare domain
- Super Admin, school and student role routing is correct

### Paid Razorpay order

- create a low-value test product
- purchase without a voucher
- confirm an internal order and Razorpay order are created
- complete the test payment
- confirm the server verifies signature, amount, currency and captured status
- confirm one entitlement is granted
- replay the webhook and confirm no duplicate entitlement is created

### Partial voucher

- create a 25% voucher
- apply it to the intended product
- confirm the Razorpay amount equals the selling price minus 25%
- complete payment and confirm the redemption ledger records the discount

### Offline-paid 100% voucher

- create a 100% voucher with purpose `Offline payment received`
- assign it to the exact purchaser email or school
- enter the offline amount and receipt, invoice, UTR or transaction reference
- redeem it while signed in as that account
- confirm Razorpay Checkout does not open
- confirm the zero-value order, entitlement and redemption ledger are created

### Rejection cases

- use the 100% voucher from another account
- use it for another product
- reuse it after its limit
- use it before the start time or after expiry
- tamper with the payable amount
- send a webhook with a wrong signature

Every case must fail without granting access.

## 8. Live launch

After all tests pass:

1. switch Razorpay to Live Mode
2. create Live Mode API keys
3. create the Live Mode webhook and secret
4. replace only the secrets in Supabase and GitHub
5. confirm automatic capture
6. perform one controlled low-value live payment
7. confirm settlement visibility in Razorpay
8. confirm the matching Evidara order, payment and entitlement
9. keep Test and Live secrets clearly separated

## 9. Operational controls

- deactivate a voucher immediately if it is shared incorrectly
- never delete financial or redemption evidence
- use entitlement revocation for access withdrawal
- keep internal notes factual and avoid sensitive payment data beyond a reference and amount
- do not store card, UPI PIN, bank credential or complete account details
- review failed orders and webhook processing errors from the Super Admin workspace or Supabase tables
- rotate API tokens and secrets when staff access changes
