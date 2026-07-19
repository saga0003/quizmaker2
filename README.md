# Evidara — Evidence-Driven Student Development

Evidara is a subscription-based assessment and student-intelligence platform for schools serving Grades 8–12.

## Version 6.1

This release establishes the Evidara identity while retaining the existing testing, subscription and student-lifecycle functionality.

Brand implementation includes:

- Approved Evidara horizontal master artwork
- Evidara Teal, Insight Amber, Midnight Ink, Cloud White and Evidence Mist design tokens
- Brand-aligned homepage, login, navigation and role dashboards
- Evidara demo identities for Super Admin, School Admin, Teacher and Student
- Accessible focus states and minimum 44 px interactive targets
- Updated product language based on clarity, evidence, humanity and consistency
- The original Evidara Brand Book stored under `docs/brand/`

Existing product capabilities include:

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
