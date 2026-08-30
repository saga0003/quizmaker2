# Evidara Phase 1 — Increments 5–8 Build Report

Date: 7 August 2026

## Completed locally in source

### Increment 5 — Institution resources + subscription
- Reconnected the active institution ResourceLibrary and SubscriptionCenter.
- Removed cloud/demo fallback from institution resources and subscriptions.
- Added platform vs institution resource ownership.
- Existing historical resources remain platform-owned unless an explicit organization exists.
- Institution managers can publish URL-backed organization resources and remove only their own organization resources.
- Student access accepts platform resources or resources belonging to their active institution, subject to existing eligibility/subscription rules.

Migration: `supabase/migrations/20260807182000_scope_academic_resources.sql`
SQL test scaffold: `supabase/tests/institution_resource_scope_authorization.sql`

### Increment 6 — Institution dashboard
- Replaced fake school identity, seats, plan, revenue, assessment counts, student segments and activity with authorized live school-platform values.
- Live cards now show active students, subscription status, available seats, resources and sections.
- Metrics without an authorized source are omitted rather than fabricated.

### Increment 7 — Platform command center + subscriptions
- Added `/api/admin/platform-overview` protected by platform-admin authorization.
- Live counts: profiles/users, organizations, products, papers, questions, active subscriptions.
- Revenue is calculated only from verified paid orders.
- Subscription rows use real institution/subscription/seat data.
- Fake uptime / system-health claims and fake revenue charts were removed.

### Increment 8 — Production truth + cleanup
- Split active student Results/Resources into `student-live-views.tsx` so the root no longer imports demo-only student screens.
- Removed legacy demo data modules after confirming no source references remained.
- Removed obsolete public setup/deployment diagnostic pages and old setup banner.
- Removed obsolete V6.8 smoke script.

## Verification completed here
- Changed TS/TSX files: syntax/transpile verification passed.
- Student live smoke: 22/22.
- Increment 3 smoke: 29/29.
- Increment 4 smoke: 36/36.
- Increment 5–8 smoke: 18/18.
- Existing V13.2 smoke/profile/analytics checks were also run during the build and passed before final cleanup changes.

## Verification limitation
The clean source intentionally contains no `node_modules`. `npm ci` could not complete in the Chat sandbox because its internal package mirror returned 404 for `zwitch@2.0.4`. Therefore full lint/typecheck/Next build must be run on the user's Windows machine with the normal npm registry/dependency cache.

## Deployment status
DO NOT deploy yet. Pending Phase 0/1 migrations and SQL authorization tests must first pass in an isolated non-production Supabase environment.
