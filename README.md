# Evidara — Evidence-Driven Student Development

Evidara is a subscription-based assessment and student-intelligence platform for schools serving Grades 8–12.

## Version 6.8.0 production QA release

Version 6.8.0 preserves the merged V6.7.1 production-commerce baseline and adds a production QA and launch-readiness layer:

- protected Super Admin system-readiness dashboard at `/admin/readiness/`
- Supabase public configuration, service-role, database and Auth Admin diagnostics
- migration 24 table, order-column and `fulfill_voucher_order` readiness checks
- Razorpay Test Mode key-format, credential-pair, webhook-secret and origin allow-list diagnostics
- authenticated `readiness-check` Supabase Edge Function that never returns secret values
- shared role and protected-route access contracts with deterministic smoke cases
- clear configuration and API remediation messages
- branch-only GitHub Actions QA and production CI workflows
- Codespaces production QA and Test Mode transaction checklist
- standard Next.js and Cloudflare OpenNext build validation
- no Vercel integration, automatic deployment or automatic merge

Production QA procedures are documented in:

```text
docs/V6_8_CODESPACES_QA.md
docs/V6_8_RELEASE_NOTES.md
```

## Version 6.7.1 production baseline

Version 6.7.1 preserves the merged V6.7 achievement and certificate release and adds its production commerce and hosting layer:

- Supabase-backed products, orders, payments and entitlements
- Razorpay Standard Checkout with server-created Orders
- mandatory server-side signature, amount, currency and captured-status verification
- idempotent Razorpay webhook fulfilment
- Super Admin percentage vouchers from 1% to 100%
- account-, school-, product-, date- and usage-bound voucher controls
- auditable offline-payment, scholarship and manual-access vouchers
- zero-value entitlement fulfilment without creating fake gateway payments
- Super Admin voucher register and redemption ledger
- origin allow-listing for authenticated payment functions
- Cloudflare Workers deployment through OpenNext
- manual GitHub Actions workflows for Cloudflare and Supabase payment functions

Production setup is documented in:

```text
docs/V6_7_PRODUCTION_SETUP.md
```

## Version 6.7 recognition

Version 6.7 adds transparent, evidence-backed achievements and link-only verifiable certificates to the real assessment and shared-benchmark engine.

Included in this release:

- Eight published achievement rules under rule version `2026.07-v1`
- Automatic evaluation after submitted exam attempts and benchmark contributions
- Invalid or pending benchmark contributions cannot support assessment-derived achievements
- Concurrency-safe first-award creation across submission, refresh and backfill workflows
- Evidence snapshots containing the exact observed values and source record
- Immutable before-and-after audit history for evidence and rule-version changes
- Automatic revocation when a current evidence-window rule is no longer satisfied
- Auditable school revocation and Super Admin restoration boundaries
- Student achievement and certificate workspace
- School recognition review, backfill, issuance, withdrawal and reissue workspace
- Paged school retrieval with batched certificate and learner lookups
- Super Admin achievement-rule governance
- Link-only certificate verification with active and revoked states
- Brand-book-compliant SVG certificate download using the approved Evidara logo
- Browser print and Save as PDF support
- Search-engine exclusion for certificate verification pages and responses
- Fail-closed partial cloud configuration
- No public school or student leaderboard

## Published recognition rules

- First Evidence
- Assessment Excellence
- Perfect Score
- Growth Milestone
- Consistent Performer
- Integrity Streak
- Shared Benchmark Participant
- Benchmark Distinction

Every badge displays its rule version and evidence summary. Achievements recognise a specific result, milestone or current evidence window; they do not define intelligence, character, ability or future potential.

## Voucher and offline-payment rules

Only Super Admin can create or edit production vouchers.

- Discounts are percentage-only.
- The allowed range is 1–100%.
- A 100% voucher must be assigned to an account email or school.
- Offline-payment vouchers require the amount received and a transaction, receipt or invoice reference.
- Partial vouchers reduce the Razorpay order amount.
- A 100% voucher creates a zero-value internal order and an auditable redemption record.
- Voucher constraints and totals are recalculated inside Postgres before the order is accepted.
- Access is granted only by a captured Razorpay payment or the service-role-only voucher fulfilment function.

Super Admin controls are available at:

```text
/admin/products/
```

## Certificate brand standard

The downloadable and printable certificate follows the approved Evidara brand book:

- approved transparent Evidara PNG logo, embedded into the downloaded SVG
- Evidara Teal `#0E5A5A`
- Insight Amber `#F2B84B`
- Cloud White `#F7F9F7`
- Evidence Mist `#DCE9E7`
- Midnight Ink `#14232B`
- Inter with Arial, Helvetica and system fallbacks
- calm compass-path and evidence-point motifs
- no unapproved purple gradient, imitation logo or decorative success promise
- a visible responsible-use note explaining that the certificate is not a prediction, permanent label or guarantee

## Certificate privacy and lifecycle principles

- Students see only their own achievements and certificates.
- School staff see only learners linked to their organization.
- Super Admin receives rule-level governance counts.
- Raw award evidence, certificate rows and audit events remain server-only.
- Verification is bearer-style and `link_only`.
- Verification pages and APIs return `noindex`, `nofollow` and `noarchive` controls.
- Public verification reports only a neutral withdrawn state; internal free-text withdrawal reasons remain private in the audit record.
- A revoked certificate continues to verify as revoked instead of disappearing.
- A new certificate may be issued from an active eligible achievement while the revoked historical record remains visible.
- Only Super Admin can restore a withdrawn certificate.
- A historical certificate cannot be restored while a newer active certificate exists.
- The linked achievement must be active before a certificate can be restored.
- Recognition cannot decide admission, discipline, promotion, fees, scholarship, access or employment.

## Supabase migrations

Apply all SQL files in numeric order through:

- `supabase/11_shared_benchmarks.sql`
- `supabase/12_benchmark_aggregate_function.sql`
- `supabase/13_benchmark_cloud_operations.sql`
- `supabase/14_benchmark_operation_hardening.sql`
- `supabase/15_benchmark_security_and_lifecycle_hardening.sql`
- `supabase/16_benchmark_fingerprint_lock_hardening.sql`
- `supabase/17_achievement_badge_schema.sql`
- `supabase/18_achievement_certificate_operations.sql`
- `supabase/19_achievement_uuid_aggregate_compatibility.sql`
- `supabase/20_achievement_evidence_audit_hardening.sql`
- `supabase/21_achievement_concurrency_hardening.sql`
- `supabase/22_achievement_certificate_restore_hardening.sql`
- `supabase/23_achievement_benchmark_validity_hardening.sql`
- `supabase/24_voucher_offline_payment_hardening.sql`

## Main V6.8 routes

- `/student/achievements/`
- `/school/achievements/`
- `/admin/achievements/`
- `/admin/products/`
- `/admin/readiness/`
- `/products/`
- `/verify/certificate/`
- `/verify/certificate/[code]/`
- `/api/achievements`
- `/api/certificates`
- `/api/admin/readiness`
- `/api/config`
- `/api/health`

Demo verification code:

```text
demo-evidara-2026
```

## Payment and readiness Edge Functions

- `create-razorpay-order`
- `verify-razorpay-payment`
- `razorpay-webhook`
- `readiness-check`

Razorpay credentials and the allowed application origins are stored as Supabase Edge Function secrets, not as browser variables. The V6.8 readiness function reports only safe booleans, counts and status messages.

## Cloudflare deployment

The full-stack Next.js application is configured for Cloudflare Workers with:

- `wrangler.jsonc`
- `@opennextjs/cloudflare`
- `npm run cf:build`
- `npm run cf:preview`
- `npm run cf:deploy`

Manual deployment workflows:

- `Deploy Evidara to Cloudflare`
- `Deploy Evidara Supabase Payment Functions`

Automatic production deployment remains intentionally disabled. Production releases require a manual workflow run from the protected GitHub `production` environment.

## Preserved capabilities

- Private exact-version shared benchmarks
- Anonymous thresholded external comparison
- Evidara transparent PNG branding
- Metric explanations and responsible-use guidance
- Universal table search, filtering and sorting
- Versioned student development patterns
- School and master question banks
- Manual and bulk question imports
- Secure assessments, autosave and automatic evaluation
- Student analytics and intervention planning
- Annual school subscriptions and seat limits
- Free school-created tests within an active annual plan
- Complimentary previous-year resources during an active subscription
- Academic-year promotion and permanent revocation protection

## Development and validation

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm run qa:smoke
npm run qa
npm run build
npm run cf:build
npm run cf:preview
```

The branch-only QA workflow does not deploy, merge or change external infrastructure. Complete the real Supabase, migration 24, role-routing and Razorpay Test Mode checks in `docs/V6_8_CODESPACES_QA.md` before launch.

## Cloud activation boundary

The application provides demonstration workspaces only when no public Supabase configuration exists. Live V6.8.0 requires:

- all migrations through `24_voucher_offline_payment_hardening.sql`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- deployed Supabase payment and readiness Edge Functions
- Razorpay Edge Function secrets in Test Mode during QA
- Cloudflare application variables and secrets

When public Supabase settings exist without the server service-role key, Evidara reports `supabase-partial` and returns a 503 for authenticated server operations instead of silently selecting demo data.

Never expose the service-role key, Razorpay Key Secret, webhook secret, Supabase access token or Cloudflare API token to browser code or commit them to GitHub.
