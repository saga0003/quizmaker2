# Evidara — Evidence-Driven Student Development

Evidara is a subscription-based assessment and student-intelligence platform for schools serving Grades 8–12.

## Version 6.4

Version 6.4 converts student development segments from static labels into a transparent, versioned evidence engine.

Included in this release:

- Central deterministic segment evaluator
- Published rule version `2026.07-v1`
- Minimum evidence requirement of three comparable assessments
- Exact observed values and qualifying thresholds
- Evidence-window and calculation timestamp disclosure
- Automatic recalculation guidance after new valid evidence
- School cohort distribution and student-level evidence review
- Student-facing explanation of the current pattern
- Super Admin governance page showing rule order and responsible-use boundaries
- Segment tables integrated with V6.3 search, filtering and sorting
- Clear distinction between sufficient and limited evidence
- Teaching and practice recommendations attached to each current pattern
- Explicit prohibition on using segments for admission, discipline, promotion, fees, scholarships, access control or prediction

New routes:

- `/school/segments/`
- `/student/segment/`
- `/admin/segments/`

## Segment method

- A learner with fewer than three comparable assessments receives **Not enough evidence**.
- Published rules are evaluated in a documented order.
- The first fully matched rule becomes the current development pattern.
- The learner and school can inspect the evidence values, thresholds, evidence window and active rule version.
- New valid evidence can change the pattern immediately.
- A segment describes a current evidence pattern, not intelligence, character, ability or future potential.

## Preserved from earlier versions

- Transparent PNG Evidara logo variants for light and dark backgrounds
- Accessible metric information controls and `/metric-guide/`
- Universal table search, filtering and sorting with `/data-guide/`
- School and master question banks
- Manual and bulk question import workflows
- Secure assessments and automatic evaluation
- Student analytics and intervention planning
- Annual school subscriptions and seat limits
- Free school-created tests within an active annual plan
- Complimentary previous-year resources during an active subscription
- Board, grade and preparation-track eligibility
- Individual and bulk student promotion and revocation
- Permanent promotion exclusion for revoked students

## Evidence and data principles

- Measure what matters and explain what the data can—and cannot—say.
- A percentile is specific to the participating group and assessment context.
- A trend is an observation, not a prediction.
- A development segment is temporary and must never become a permanent student label.
- Search, filtering and sorting change only the current view.
- High-impact decisions must use the complete underlying record and appropriate human review.

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
