# Evidara — Evidence-Driven Student Development

Evidara is a subscription-based assessment and student-intelligence platform for schools serving Grades 8–12.

## Version 6.6

Version 6.6 connects private shared-paper benchmarks to Evidara’s real question-paper and secure exam-attempt engine.

Included in this release:

- Cloud benchmark publishing from an existing published school paper
- Server-calculated SHA-256 paper fingerprints
- Student joining through a private access code
- Secure benchmark attempts through the existing live exam route
- Automatic contribution creation after submission
- Automatic exclusion for timing, integrity, score and fingerprint failures
- First-submission-only contribution rules
- Private named cohort evidence for each participating school
- Anonymous external averages, medians, percentiles and score bands
- Minimum 20 external attempts from at least 3 external schools
- Small-cell suppression below 10 records
- Publisher-only access codes and lifecycle controls
- School review of its own student contributions
- Super Admin review requirement for automatic integrity exclusions
- Locked paper, section and question content while a benchmark is published or closed
- Cloud-aware school, student and Super Admin benchmark workspaces

## Benchmark privacy principles

- Students do not receive a catalogue of other schools’ access codes.
- School staff see only benchmarks they publish or in which their own students participated.
- A school can never see another school’s named students, answer sheets or exact attempts.
- External comparison excludes the requesting school’s own cohort.
- No public school leaderboard is produced.
- Benchmark evidence cannot decide admission, discipline, promotion, fees, scholarship, access or employment.

## New cloud migrations

Apply the Supabase SQL files in numeric order through:

- `supabase/11_shared_benchmarks.sql`
- `supabase/12_benchmark_aggregate_function.sql`
- `supabase/13_benchmark_cloud_operations.sql`
- `supabase/14_benchmark_operation_hardening.sql`
- `supabase/15_benchmark_security_and_lifecycle_hardening.sql`
- `supabase/16_benchmark_fingerprint_lock_hardening.sql`

## Main routes

- `/school/benchmarks/`
- `/school/benchmarks/publish/`
- `/student/benchmarks/`
- `/admin/benchmarks/`
- `/api/benchmarks`

## Preserved capabilities

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

The application continues to provide demo workspaces when Supabase is not configured. Live shared benchmarks require:

- all migrations through `16_benchmark_fingerprint_lock_hardening.sql`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose the service-role key to browser code.

Automatic Vercel Git deployment remains paused. Validate with GitHub Actions and test through GitHub Codespaces before intentionally publishing production.
