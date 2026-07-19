# ScholarOS — School Assessment Intelligence

ScholarOS is a subscription-based assessment and student-intelligence platform for schools serving Grades 8–12.

## Major integrated release

This release rebuilds the functionality of the supplied offline testing platform inside ScholarOS without retaining its earlier visual design. It includes:

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
- FREE school-created tests with no per-test fee
- COMPLIMENTARY previous-year resources unlocked by an active subscription
- Board, grade and preparation-track eligibility
- Individual promotion and Promote All
- Individual revoke and Revoke All
- Permanent bulk-promotion exclusion for revoked students

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
npm start
```

## Supabase setup

Apply the SQL files in the `supabase` directory in numeric order. The latest subscription, resource and promotion model is in:

`supabase/08_version_5_school_subscription_lifecycle.sql`

Configure the values in `.env.example` through Vercel environment variables. Never commit service-role or payment secrets.

## Business terminology

- **Free:** school-created tests carry no additional per-test charge within an active annual school subscription.
- **Complimentary:** previous-year board and entrance resources are included with an active subscription; they are not public free downloads.
