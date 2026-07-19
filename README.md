# Evidara — Evidence-Driven Student Development

Evidara is a subscription-based assessment and student-intelligence platform for schools serving Grades 8–12.

## Version 6.3

This release gives operational tables one consistent way to search, filter and sort records while preserving the V6.2 logo, metric explanations and transparent student-segment rules.

Version 6.3 includes:

- Universal table search across rendered records
- Exact-value filtering by a selected column
- Ascending and descending sorting from eligible column headings
- Numeric handling for marks, percentages, currency and counts
- Date-aware sorting when a table contains dates
- Automatic enhancement of existing Evidara `so-table` interfaces
- Action and interactive columns protected from inappropriate sorting
- Keyboard-focus styling and accessible labels for every data control
- Mobile-friendly full-width controls
- Print layouts that exclude table-control toolbars
- Public `/data-guide/` reference page
- Data Controls navigation in Super Admin, School Admin, Teacher and Student workspaces
- Clear guidance that view controls do not modify records or bypass role boundaries

## Preserved from Version 6.2

- Transparent PNG Evidara logo for light backgrounds
- Transparent PNG Evidara logo for dark backgrounds
- Standalone transparent Evidara emblem for compact and icon use
- No white holding card or rectangular clipped background around the logo
- Accessible information controls beside important metrics
- Metric calculation and evidence-window explanations
- Responsible-use notes to prevent overclaiming
- Transparent student development-segment rules
- Public `/metric-guide/` reference page

## Evidence and data principles

- A metric must show what it means, how it is evaluated and why it is useful.
- A percentile is specific to the participating group and exact assessment context.
- A trend is an observation across comparable evidence, not a prediction.
- A development segment is temporary and must never become a permanent student label.
- Search, filtering and sorting only change the current view; they do not edit stored records.
- Table controls operate only on records already available to the signed-in role.
- High-impact decisions should be based on the complete underlying record, not a filtered list alone.

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
