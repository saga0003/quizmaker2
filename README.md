# Evidara — Evidence-Driven Student Development

Evidara is a subscription-based assessment and student-intelligence platform for schools serving Grades 8–12.

## Version 6.7

Version 6.7 adds transparent, evidence-backed achievements and link-only verifiable certificates to the real assessment and shared-benchmark engine.

Included in this release:

- Eight published achievement rules under rule version `2026.07-v1`
- Automatic evaluation after submitted exam attempts and benchmark contributions
- Evidence snapshots containing the exact observed values and source record
- Automatic revocation when a current evidence-window rule is no longer satisfied
- Auditable school revocation and Super Admin restoration boundaries
- Student achievement and certificate workspace
- School recognition review, backfill, issuance and withdrawal workspace
- Super Admin achievement-rule governance
- Link-only certificate verification with active and revoked states
- Branded SVG certificate download
- Browser print and Save as PDF support
- Search-engine exclusion for certificate verification pages
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

## Certificate privacy principles

- Students see only their own achievements and certificates.
- School staff see only learners linked to their organization.
- Super Admin receives rule-level governance counts.
- Raw award evidence, certificate rows and audit events remain server-only.
- Verification is bearer-style and `link_only`.
- Verification pages return `noindex`, `nofollow` and `noarchive` directives.
- A revoked certificate continues to verify as revoked instead of disappearing.
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

## Main V6.7 routes

- `/student/achievements/`
- `/school/achievements/`
- `/admin/achievements/`
- `/verify/certificate/`
- `/verify/certificate/[code]/`
- `/api/achievements`
- `/api/certificates`

Demo verification code:

```text
demo-evidara-2026
```

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
npm run build
```

## Cloud activation boundary

The application continues to provide demonstration workspaces when Supabase is not configured. Live V6.7 recognition requires:

- all migrations through `19_achievement_uuid_aggregate_compatibility.sql`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose the service-role key to browser code.

Automatic Vercel Git deployment remains paused. Validate with GitHub Actions and test through GitHub Codespaces before intentionally publishing production.
