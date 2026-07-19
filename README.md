# Evidara — Evidence-Driven Student Development

Evidara is a subscription-based school assessment and student-intelligence platform for Grades 8–12. It turns assessment evidence into clear, responsible development pathways for school leaders, teachers, students and parents.

## Version 6

This release applies the Evidara brand system and adds the first cross-school evidence layer:

- Anonymous shared-paper benchmarks using the exact same paper version
- Aggregate-only comparison with a minimum privacy sample of 20 valid attempts
- No public school leaderboard, student identity, contact details or response-sheet disclosure
- Server-derived benchmark facts recorded atomically during shared exam submission
- Persisted school controls to create, pause and resume benchmark links
- Metric information controls explaining meaning, evidence window, usefulness and limitations
- Transparent, temporary student segment definitions and next actions
- Search, filtering and click-to-sort behaviour for product tables
- Evidara badges and downloadable/printable student certificates
- Brand-aligned colours, typography, spacing, accessibility and language
- Versioned metric, segment, achievement and certificate database foundations

Existing integrated capabilities remain available:

- School and master question banks
- Manual MCQ, multi-correct, numerical and image-based questions
- LaTeX questions and solutions
- CSV, XLSX and image-ZIP imports
- Review workflow and question versioning
- Section-based paper builder
- Manual, hybrid and automatic question selection foundations
- Duration, marks, negative marks, schedules, access codes and result modes
- Secure attempts, autosave, timer, question palette and mark for review
- Tab, blur and fullscreen event logging
- Automatic evaluation and student result history
- Student score, percentile, speed, error, mastery and intervention analytics
- Annual school subscriptions and seat limits
- Free school-created tests with no additional per-test fee
- Complimentary previous-year resources during an active subscription
- Board, grade and preparation-track eligibility
- Individual and bulk promotion
- Individual and bulk revoke
- Permanent promotion exclusion for revoked students

## Brand source of truth

Engineering rules are maintained in:

`docs/EVIDARA_BRAND_SYSTEM.md`

The approved Evidara Brand Book v1.0 remains the source of truth for the master logo, colour system, typography, reports, certificates, dashboards, accessibility and co-branding. Product decisions follow this order: clarity, evidence, humanity and consistency.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run typecheck
npm run build
```

The GitHub Actions workflow `.github/workflows/evidara-v6-ci.yml` runs both checks on the Evidara V6 branch and pull requests to `main`.

## Supabase setup

Apply SQL files in the `supabase` directory in numeric order. Version 6 adds:

- `supabase/11_shared_benchmarks.sql` — benchmark metadata and private fact storage
- `supabase/12_benchmark_aggregate_function.sql` — anonymous privacy-thresholded snapshot
- `supabase/13_metrics_segments_achievements.sql` — explained metrics, segments, badges and certificates
- `supabase/14_secure_benchmark_access.sql` — authorised school creation and sharing controls
- `supabase/15_trusted_benchmark_attempts.sql` — token route, linked attempts and atomic trusted submission
- `supabase/16_school_benchmark_reporting.sql` — private school rows and thresholded wider comparison

Configure `.env.example` values through Vercel environment variables. Never commit service-role, payment or private integration secrets.

## Business terminology

- **Free:** school-created tests carry no additional per-test charge within an active annual school subscription.
- **Complimentary:** previous-year board and entrance resources are included during an active subscription; they are not public free downloads.
- **Private benchmark:** a school sees its own named students, while the broader comparison exposes only privacy-thresholded aggregate evidence.
