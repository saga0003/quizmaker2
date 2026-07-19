# Evidara — Evidence-Driven Student Development

Evidara is a subscription-based assessment and student-intelligence platform for schools serving Grades 8–12.

## Version 6.2

This release makes Evidara's visible metrics understandable and replaces the broken logo implementation with clean, transparent PNG variants supplied for light and dark backgrounds.

Version 6.2 includes:

- Transparent PNG Evidara logo for light backgrounds
- Transparent PNG Evidara logo for dark backgrounds
- Standalone transparent Evidara emblem for compact and icon use
- No white holding card or rectangular clipped background around the logo
- Accessible information controls beside important metrics
- Metric definitions stating what each measure means
- Calculation and evidence-window explanations
- Responsible-use notes to prevent overclaiming
- Transparent student development-segment rules
- Segment recalculation and recommended-next-action explanations
- Public `/metric-guide/` reference page
- Metric-guide navigation for Super Admin, School Admin, Teacher and Student workspaces
- Metric explanations on platform, school and student overview dashboards
- Expanded explanations throughout student intelligence analytics

## Evidence principles

- A metric must show what it means, how it is evaluated and why it is useful.
- A percentile is specific to the participating group and exact assessment context.
- A trend is an observation across comparable evidence, not a prediction.
- A readiness index is a navigation aid, not a diagnosis.
- A development segment is temporary and must never become a permanent student label.
- Recoverable marks are an evidence estimate, not a guaranteed improvement.

## Existing product capabilities

- School and master question banks
- Manual MCQ, multi-correct, numerical and image-based questions
- LaTeX questions and solutions
- CSV, XLSX and image-ZIP imports
- Review workflow and question versioning
- Section-based paper builder
- Manual, hybrid and automatic question selection foundations
- Duration, marks, negative marks, schedules, access codes and result modes
- Secure attempts, autosave, timer, question palette and mark for review
- Automatic evaluation and student result history
- Student score, percentile, speed, error, mastery and intervention analytics
- Annual school subscriptions and seat limits
- Free school-created tests with no additional per-test fee
- Complimentary previous-year resources during an active subscription
- Board, grade and preparation-track eligibility
- Individual and bulk promotion
- Individual and bulk revoke
- Permanent promotion exclusion for revoked students

## Development

```bash
npm install
npm run dev
```

## Validation

```bash
npm run typecheck
npm run build
```

## Supabase setup

Apply SQL files in the `supabase` directory in numeric order. Configure `.env.example` values through Vercel environment variables. Never commit service-role, payment or private integration secrets.

## Business terminology

- **Free:** school-created tests carry no additional per-test charge within an active annual school subscription.
- **Complimentary:** previous-year board and entrance resources are included during an active subscription; they are not public free downloads.
