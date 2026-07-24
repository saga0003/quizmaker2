# Evidara V10 Analytics — Phase 1

## Purpose

Phase 1 replaces the demo student analytics page with live Supabase evidence and establishes the academic hierarchy required for teachers, schools and Evidara platform administrators.

Apply `supabase/35_v10_analytics_phase_1.sql` after migration 34.

## Delivered in Phase 1

### Student analytics dashboard

- Product-specific and all-assessment views
- Product test-completion progress
- Date filters, last-three, last-five and full-history ranges
- Test timeline with completed and pending papers
- Average percentage
- Product percentile locked until every bundled paper is completed
- Accuracy across attempted questions
- Time-management score from completion, trap avoidance, rush control and end control
- Subject performance profile
- Subject comparison
- Test-wise and rolling performance trends
- Anonymous cohort average and top-10 threshold where enough comparable attempts exist
- Evidence-based strongest subject and development priority
- Print / Save as PDF

### Sections and assignments

- Normalized academic sections by school, academic year and grade
- Automatic backfill from the existing membership `section` text
- Student-to-section assignment
- Teacher-to-section assignment with a subject/teaching label
- Audited create, update, assign and remove operations

### Role access

- Student: own analytics only
- School Teacher: only students in assigned sections
- School Admin: all active students in their school, filtered by grade and section
- Evidara Admin: school → grade → section → student navigation
- Super Admin: the same platform hierarchy with full platform scope

### Privacy and security

- All access rules are enforced in security-definer RPCs, not only in React
- Teachers cannot see students outside assigned sections
- School admins cannot cross school boundaries
- Student identities are not exposed in cohort benchmark calculations
- Cohort reference series are suppressed below five comparable attempts
- Product percentile remains unavailable until the entire selected product series is complete

## Four-phase implementation plan

### Phase 1 — Student intelligence foundation

Status: implemented in this branch.

Includes the live student dashboard, sections, assignments, role-scoped directory and student drill-down.

### Phase 2 — Teacher analytics dashboard

Pending:

- Aggregate performance for all assigned sections
- Teacher subject/class filters
- Completion and participation rates
- Class performance trend
- Students improving, stagnant or needing attention
- Topic and chapter weak-area aggregation
- Teacher intervention notes and follow-up status
- Drill-down from class insight to student evidence

### Phase 3 — School Admin analytics

Pending:

- School-wide KPIs
- Grade and section comparisons
- Section heatmaps
- Subject and teacher-level comparisons
- Test participation and completion monitoring
- Student distribution bands
- Intervention and follow-up workflow
- CSV and printable school reports
- Academic-year comparison

### Phase 4 — Evidara Admin and Super Admin platform analytics

Pending:

- Multi-school command centre
- School performance and adoption summaries
- School → grade → section → student drill-down improvements
- Cross-school anonymous benchmark controls
- Data-quality and low-evidence warnings
- Platform exports and scheduled reports
- Query caching, materialized summaries and large-school performance hardening
- Governance, audit review and metric configuration

## QA

The V10 workflow runs:

1. Dependency installation
2. ESLint
3. TypeScript
4. V8 Paper smoke checks
5. V9 Products smoke checks
6. V10 Analytics Phase 1 smoke checks
7. Next.js production build

No migration is automatically applied and no production deployment is performed by this branch.
