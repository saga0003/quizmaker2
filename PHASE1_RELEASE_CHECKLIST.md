# Evidara Phase 1 Production Release Checklist

This is the single source of truth for the Evidara Phase 1 hardening programme.

## Product contract

- Institution-first online testing and analytics platform.
- Price: ₹199 per licensed active student per year.
- Institution teachers maintain/update their own question bank.
- Evidara provides question management, paper/test creation, online testing, results, subject/chapter/topic analytics, user/admin controls, subscription controls and platform operations.
- Phase 1 deliberately excludes public marketplace, direct student checkout, vouchers/coupons, referrals, wallet/credits, self-assessment commerce, gamification and public SEO catalogue.

## Status legend

- [x] Verified complete.
- [ ] Required before Phase 1 production sign-off.
- Evidence/notes are added beside an item when it is verified.

---

# P0 — Launch blockers

- [ ] **P0.1 Release gate / current main build** — latest code must pass TypeScript + production build + Phase 1 smoke tests before main is promoted. Current latest main deployment failed on `question-response-audit.tsx` PromiseLike `.finally()` type-check.
- [ ] **P0.2 Canonical real-student paper eligibility** — use `student_school_memberships` for student access; do not require students to be duplicated in `organization_members`.
- [ ] **P0.3 Test assignment engine** — institution/academic-year/grade/programme/section/selected-student targeting with an exact assigned-student preview count.
- [ ] **P0.4 Server-enforced result release modes** — hidden, score-only, score+answers, after-close, in-depth analytics; never rely on UI hiding.
- [ ] **P0.5 Cross-school analytics isolation** — school staff can only read attempts belonging to their institution; student personal history and Super Admin support access must be explicitly scoped/audited.
- [ ] **P0.6 Historical analytics snapshots** — analytics must use test-time question/taxonomy snapshot so later question edits do not rewrite historical reports.
- [ ] **P0.7 ₹199/student/year licence model** — remove all “unlimited students” behaviour/text; licensed quantity and active count must be explicit.
- [ ] **P0.8 Subscription enforcement** — active/grace/expired/suspended policy must be enforced by backend operations, not only UI.
- [ ] **P0.9 Safe Super Admin `View As`** — replace role-changing preview semantics with read-only institution-scoped preview; privileged writes remain disabled while previewing.
- [ ] **P0.10 Exam network reliability** — pending-answer/offline retry queue, visible sync state, and block final submit until pending responses are confirmed.
- [ ] **P0.11 RPC permission allowlist** — revoke unnecessary `anon` EXECUTE grants on private/legacy SECURITY DEFINER RPCs; document intentionally public RPCs.
- [ ] **P0.12 Credential hardening** — cryptographically secure temporary credentials, first-login reset/setup flow, privileged MFA recommendation/requirement.

---

# A — Stability, security and tenancy

- [ ] A1 Automated preview QA before production promotion.
- [ ] A2 Tenant-isolation regression suite for School A vs School B.
- [ ] A3 Audit every privileged change: institution/subscription/account/password/question/paper/result/view-as/resource.
- [ ] A4 RLS cleanup for legacy staging/recovery tables and documented grants.
- [ ] A5 Protected resources use authenticated/signed URLs where content is private.
- [ ] A6 Upload hardening: file signatures/magic bytes; sanitize or restrict SVG.
- [ ] A7 ZIP safety: compressed size, expanded size, file count, per-file size and compression-ratio limits.
- [ ] A8 Rich HTML sanitation uses a proven sanitizer or safe structured editor.
- [ ] A9 Explicit active institution selector for multi-organization staff accounts.
- [ ] A10 Local autosave keys include organization ID and are cleared/scoped on logout/publish.

# B — Institution, staff and student lifecycle

- [ ] B1 Transactional institution onboarding: institution + licence + first School Admin + membership + defaults + audit.
- [ ] B2 One institution onboarding wizard.
- [ ] B3 First-class bulk student import with validation and failed-row export.
- [ ] B4 Student lifecycle uses Active / Withdrawn / Completed / Suspended; no destructive delete after attempts exist.
- [ ] B5 Student attempt/enrollment snapshot preserves institution, academic year, grade, section and programme history.
- [ ] B6 Teacher assignment to sections/subjects is explicit and consistently enforced.
- [ ] B7 Academic-year rollover/promotion flow preserves historic data.

# C — Question bank

- [x] C1 Multiple question types supported: single/multiple correct, numerical, integer, assertion-reason, match, passage, image-based. Existing implementation verified.
- [x] C2 Question taxonomy fields exist: exam, grade, subject, chapter, topic, difficulty, marks, negative marks, solution, language, tags. Existing implementation verified.
- [x] C3 Versioning/review workflow exists. Existing implementation verified.
- [x] C4 Bulk question import foundation exists for spreadsheet/document/ZIP/image workflows. Existing implementation verified.
- [ ] C5 Server-side “analytics-ready approval” validation.
- [ ] C6 One authoritative correct-answer model; enforce consistency with option correctness.
- [ ] C7 Institutional collaboration: teachers can view approved bank in assigned subjects, create/edit own drafts and submit; School Admin can review all institutional questions.
- [ ] C8 School Admin archive policy; permanent delete only for unused mistaken records.
- [ ] C9 Server-side question search/filter/pagination; do not load entire bank into browser.
- [ ] C10 Simplify `Add Questions` flow: Upload → Map → Review → Import; optional Create Paper.
- [ ] C11 Duplicate detection is server-authoritative across appropriate institution scope.

# D — Paper, assignment and test creation

- [x] D1 Paper builder supports manual/automatic/hybrid selection, sections, difficulty, scheduling, attempts, shuffle and result mode. Existing implementation verified.
- [x] D2 Papers with student attempts are protected from question-set mutation. Existing implementation verified.
- [ ] D3 Simplified five-step flow: Details → Questions → Audience → Settings → Preview & Publish.
- [ ] D4 Assignment preview shows exact student count and eligibility warnings before publish.
- [ ] D5 Clone-as-new-version for papers that already have attempts.
- [ ] D6 Publish checklist validates approved questions, duration, marks, audience, schedule and result policy.
- [ ] D7 Test Results / Analytics / Export are first-class actions on a paper.

# E — Online exam engine

- [x] E1 Server-backed attempts, server expiry, save/resume, answer protection, server scoring exist. Existing implementation verified.
- [x] E2 Question/option shuffling exists. Existing implementation verified.
- [x] E3 Basic integrity events (tab/window/fullscreen/copy shortcuts) exist. Existing implementation verified.
- [ ] E4 Reliable sync queue with retry/backoff and visible `All saved / Waiting / Offline` state.
- [ ] E5 Numeric/text answer final-save confirmation before navigation/submit.
- [ ] E6 Idempotent submission and clear submission receipt.
- [ ] E7 Integrity report presented as events/evidence, not “cheating prevention”.
- [ ] E8 Load test concurrent starts, saves and submissions.

# F — Results and analytics

- [x] F1 Live student analytics engine exists with subject/chapter/topic breakdowns, timing, trends and priorities. Existing implementation verified.
- [ ] F2 Define metric dictionary: Tests Taken, Unique Questions, Question Outcomes, Attempted, Unanswered, Accuracy, Score %, Participation.
- [ ] F3 `No data` displays as `— / Not assessed`, never misleading 0%.
- [ ] F4 Student hierarchy: Overview → Subject → Chapter → Topic → Question Evidence.
- [ ] F5 Standard analytics row/card contains exposure, attempted, correct, incorrect, unanswered, accuracy, score %, time, trend and evidence count.
- [ ] F6 Topic weakness/strength requires minimum evidence threshold; display sample size.
- [ ] F7 Percentile labelled by actual cohort; minimum cohort threshold for prominent comparisons.
- [ ] F8 School → programme → grade → section → subject → chapter → topic → student drilldown.
- [ ] F9 Teacher `Needs Attention` dashboard with actionable evidence rather than chart overload.
- [ ] F10 Raw question-response evidence remains auditable and correctly scoped.
- [ ] F11 Traditional result sheet with rank/score/accuracy/time.
- [ ] F12 Excel export for test results and student×subject/chapter/topic analytics.
- [ ] F13 Heavy institutional aggregates progressively move to database-side aggregation where needed for scale.

# G — Subscription and commercial controls

- [ ] G1 Canonical plan: ₹199 × licensed students × annual licence period.
- [ ] G2 School view: Licensed Students, Active Students, Available Licences, Rate, Start, End.
- [ ] G3 Super Admin: annual amount calculated from licensed quantity; payment/invoice reference fields retained.
- [ ] G4 No per-test charge; unlimited tests within active licence.
- [ ] G5 Grace/expired/suspended states preserve historical read/export access and block restricted new activity according to policy.
- [ ] G6 Manual invoicing/activation supported; payment gateway not required for Phase 1.

# H — Role-focused UI/UX

- [ ] H1 Super Admin menu: Command Centre, Institutions, Subscriptions, Analytics, Questions, Papers, Resources, Access & Accounts, Audit & Health, View As.
- [ ] H2 Hide parked Phase-2 modules from Phase-1 navigation.
- [ ] H3 School Admin dashboard focuses on students, teachers, tests, participation, score, licence usage and actions.
- [ ] H4 Teacher dashboard focuses on Upload Questions, Create Test, Upcoming Tests, Recent Results, Students Needing Attention.
- [ ] H5 Student dashboard focuses on Next Test, Recent Result, Improvement and Focus Topics.
- [ ] H6 Standardize page headings, cards, tables, filters, loading, error and empty states.
- [ ] H7 Responsive QA at 360, 390, 430, tablet, 1366 and 1920 widths with long real-world content.
- [ ] H8 Mobile tables use readable cards/compact rows where appropriate.
- [ ] H9 Accessibility baseline: keyboard, focus, labels, contrast, touch target size and meaningful status text.

# I — Super Admin operations and platform health

- [ ] I1 `Audit & Health` workspace.
- [ ] I2 Health status: deployment, database, storage, failed imports, failed test starts/saves/submissions.
- [ ] I3 Usage counts computed in PostgreSQL, not by downloading entire tables into application memory.
- [ ] I4 Support-safe View As actions are audited.
- [ ] I5 Monitoring/alerts for build failures, 5xx, auth/test/import failures and core dependency outages.
- [ ] I6 Backup/PITR strategy, R2 recovery, Vercel rollback and documented incident runbook.
- [ ] I7 Targeted database indexes for exam, student, question, paper and paper-question hot paths.

# J — Privacy, data handling and launch documentation

- [ ] J1 Data-minimisation review for student/parent personal information.
- [ ] J2 Retention, export and institution termination/deletion policy.
- [ ] J3 Privacy Policy and institution data-processing terms prepared and legally reviewed for applicable Indian requirements.
- [ ] J4 External AI helper never silently sends student personal/performance data; question conversion is separated from student analytics.
- [ ] J5 Support/admin access follows least privilege and is auditable.

---

# Release acceptance test — real-school path

- [ ] R1 Create Test School A as a real institution.
- [ ] R2 Create a 100-seat annual licence at ₹199/student.
- [ ] R3 Create School Admin and Teacher accounts.
- [ ] R4 Import 100 real student memberships.
- [ ] R5 Assign Teacher to Physics/section.
- [ ] R6 Import at least 500 questions and resolve invalid rows.
- [ ] R7 Approve questions.
- [ ] R8 Create Physics test and assign Grade 11 section/programme.
- [ ] R9 Login using a real student account and start assigned test.
- [ ] R10 Disconnect network, answer, reconnect and verify recovery/sync.
- [ ] R11 Submit and verify authoritative marks manually.
- [ ] R12 Verify held/released result modes.
- [ ] R13 Verify student subject/chapter/topic/question analytics.
- [ ] R14 Verify Teacher and School Admin drilldowns.
- [ ] R15 Export test result and analytics spreadsheet.
- [ ] R16 Create School B and prove it cannot read any School A student/test/analytics data.
- [ ] R17 Expire School A licence and verify expected read-only/blocked behaviour.
- [ ] R18 Renew licence and verify access restoration without recreating data.

# Load acceptance

- [ ] L1 2,000 students/institution test dataset.
- [ ] L2 50,000 questions/institution searchable without full-browser load.
- [ ] L3 1,000 papers dataset.
- [ ] L4 500 near-concurrent test starts.
- [ ] L5 500 concurrent answer-save patterns.
- [ ] L6 500 submissions in finishing window.

# Production sign-off

- [ ] Z1 All P0 items complete.
- [ ] Z2 Real-school acceptance test complete.
- [ ] Z3 Tenant-isolation tests pass.
- [ ] Z4 Production build passes from exact release commit.
- [ ] Z5 Production deployment is READY and permanent domain serves the release commit.
- [ ] Z6 Runtime error/health check is clean after deployment.
- [ ] Z7 Phase 1 release version/tag/changelog recorded.
