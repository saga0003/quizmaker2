# Evidara V8 Papers — Phase 1 Interface and Safety Foundation

## Status

Phase 1 is implemented on `evidara-v8-papers` only.

V7 remains frozen. A separate snapshot branch, `evidara-v7-final-locked`, points to the completed V7 baseline and must not receive V8 work.

No Vercel, Cloudflare, Supabase migration, merge, or production deployment is performed by this phase.

## Why the previous V8 interface appeared unchanged

The main Evidara dashboard routed its Admin and School **Papers** navigation to `LivePaperCatalogue`, which was the older catalogue screen. The actual V8 components already existed under the native Papers routes, but the primary dashboard navigation did not render them.

Phase 1 corrects that integration boundary.

## Implemented in Phase 1

1. **V7 freeze boundary**
   - Preserved `evidara-v7-final` without modification.
   - Created `evidara-v7-final-locked` as an additional immutable working snapshot.
   - Continued all Papers work only on `evidara-v8-papers`.

2. **Deployment lock restored**
   - Set `vercel.git.deploymentEnabled` to `false` for the entire repository configuration on the V8 branch.
   - No branch-specific Vercel exception remains.
   - The V8 QA policy can now enforce the non-deployment boundary again.

3. **Real V8 Papers navigation**
   - Replaced the main dashboard's older `LivePaperCatalogue` route for Admin Papers.
   - Replaced the main dashboard's older `LivePaperCatalogue` route for School Papers.
   - Both views now render the database-backed `QuestionPaperList` component.
   - The existing **Create paper** action continues into the dedicated V8 builder route.

4. **Visible V8 route shell**
   - Rebuilt the separate Admin and School route shell with the active Evidara visual system.
   - Added responsive desktop and mobile navigation.
   - Added clear `V8` identification for Paper Builder routes.
   - Added a persistent draft-development notice stating that deployment is disabled.
   - Renamed the native Papers navigation label to **Paper Builder**.

5. **Draft-only product boundary**
   - The interface now states that paper definitions may be saved, duplicated, reviewed, and managed as drafts.
   - Product, pricing, payment, student access, and examination delivery remain outside this module.

## Existing V8 capabilities retained for the next phases

The branch already contains database migrations and components for:

- separate Foundation Grades 7, 8, 9, and 10;
- NEET, JEE Main, JEE Advanced, KCET, grade, Olympiad, scholarship, and custom programmes;
- manual, automatic, and hybrid paper creation;
- sections, Question Bank filtering, blueprints, arrangement, marks, rules, preview, review, versions, templates, exports, and audit history;
- draft-only duplication with a new code;
- non-destructive autosave;
- publication of a reusable paper definition without creating a product or student entitlement.

These capabilities are not declared final merely because files exist. Each will be opened, corrected, connected, and tested phase by phase.

## Deferred to Phase 2

- rebuild and verify the paper management dashboard actions;
- verify Create, Edit, Preview, Duplicate, Version, Template, Archive, and Delete boundaries;
- verify paper details, programme, subject, and section steps against the live V8 schema;
- improve empty, loading, migration-not-ready, and permission states;
- confirm every duplicate and template-created paper starts as Draft and receives a new code;
- verify autosave and reload persistence with a test Supabase project.

## Deferred to Phase 3

- production-sized Question Bank filtering and pagination;
- manual selection across pages;
- automatic blueprint generation;
- availability and shortage matrix;
- hybrid locked-question behaviour;
- complete, section, row, subject, difficulty-group, and single-question regeneration;
- generation audit and reproducible random seeds.

## Deferred to Phase 4

- arrangement, marks, duration, and shuffle-rule verification;
- complete preview modes;
- validation and warning acceptance;
- review comments and decisions;
- immutable published versions;
- templates and version history;
- printable HTML, CSV, Excel-compatible, and JSON exports;
- role matrix, school isolation, student denial, backup, rollback, and browser acceptance testing.

## Intentionally ignored or excluded

The following items are not part of V8 Papers or are unsuitable for the current architecture:

- Product Builder, pricing, bundles, GST, coupons, invoices, subscriptions, and payment gateways;
- student assignment, entitlement, test-taking, invigilation, agent codes, results, ranks, and analytics;
- AI-written questions or a duplicate Question Bank;
- generating 100 artificial questions inside the real Question Bank merely for interface decoration;
- server-side PDF generation as a blocking dependency; printable and PDF-ready HTML remains the supported boundary;
- UI instructions that conflict with the existing Evidara design system or introduce oversized text, unnecessary overlays, or disconnected placeholder controls;
- automatic production migrations, automatic deployment, or automatic merge.

## Phase 1 acceptance check

Phase 1 is accepted when:

1. Signing in as Admin and selecting **Papers** shows the V8 Test Paper Builder catalogue.
2. Signing in as School Admin and selecting **Papers** shows the school-scoped V8 catalogue.
3. Selecting **Create paper** opens a visibly V8-labelled builder workspace.
4. The workspace states that it is draft development and that deployment is disabled.
5. Vercel does not deploy from the branch.
6. V7 remains unchanged on the frozen branches.
