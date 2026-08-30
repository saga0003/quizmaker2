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

- [x] **P0.1 Release gate / current main build** — hardening release candidate `12768d564ea19ea73599def24ce9b074f502f4d1` passed the complete GitHub Actions release gate (run `33326695104`) on 30 Aug 2026: install, hardening smoke, TypeScript, lint, all regression suites and production build; matching Vercel preview is READY. Production `main` remains on its last known-good READY deployment until all remaining P0/release acceptance items are complete.
- [x] **P0.2 Canonical real-student paper eligibility** — live Supabase verified 30 Aug 2026: `list_available_papers`, `find_paper_by_code` and `start_exam_attempt` accept active `student_school_memberships`; students do not need duplicated `organization_members`. Internal `is_active_student_member` is not executable by `anon`/`authenticated` browser roles.
- [x] **P0.3 Test assignment engine** — verified 30 Aug 2026. Hardening release candidate routes `PaperAssignmentCenter` into School Papers and passes the full release gate. Live Supabase now has RLS-protected `paper_assignment_profiles`/`paper_student_assignments`, exact audience preview, academic-year/grade/section/programme/specific-student targeting, scoped student search, materialized/frozen cohorts, student discovery/start enforcement, and a publish guard that prevents a new institutional paper from being published without at least one assigned student.
- [x] **P0.4 Server-enforced result release modes** — verified 30 Aug 2026. Live Supabase migrations `phase1_result_release_security` and `phase1_result_release_legacy_rpc_lockdown` centralize `hidden → none`, `score_only → score`, `score_and_answers → answers`, `in_depth_analytics → analytics`, and `after_close → analytics only after server-side available_until`. Submission and student result listing mask unreleased marks; answer review/reflection are blocked until answers are released; raw/legacy result analytics helpers are no longer browser-executable; student self-analytics fails closed when its evidence set includes an unreleased assessment. Student Results shows an explicit withheld-result state. Hardening commit `a8fb8bafe4105a60cb9343e80fe0823d0831719c` passed GitHub release gate run `33328669232`: hardening checks, TypeScript, lint, every regression suite and production build.
- [x] **P0.5 Cross-school analytics isolation** — verified 31 Aug 2026. School Admin/Teacher directories, live student analytics, comparison cohorts and answer review are institution/section scoped. Live Supabase migration `phase1_platform_support_analytics_scope` removes implicit cross-school platform-support aggregation: explicit support reads use `get_student_analytics_scoped_v20(…, p_organization_id, …)`, write `support.analytics.view` audit records, and the compatibility path refuses transferred/multi-institution student history instead of combining it. The scoped helper is internal-only and the support RPC is not anonymous. Hardening commit `435b1f89cffbc38b0d4727e72a0a4a7ad81059df` passed release gate run `33331354248` including hardening checks, TypeScript, lint, all regression suites and production build; matching Vercel preview is READY.
- [x] **P0.6 Historical analytics snapshots** — verified 31 Aug 2026. Live Supabase migration `phase1_historical_analytics_snapshots` freezes paper-question subject/chapter/topic IDs and display names into `question_snapshot` with a snapshot version before assessment evidence exists; production contained zero `paper_questions` when introduced, so no real historical assessment data was rewritten. Student analytics, answer review and topic-reflection analytics now prefer frozen test-time taxonomy. Institution analytics now fetches `paper_questions.question_snapshot` and resolves subject/chapter/topic from that frozen evidence before mutable question-bank taxonomy. Dedicated P0.6 regression checks, TypeScript, lint, all existing regression suites and production build passed release gate run `33331871665` on commit `726652258df452e6c1e83c3bcb672ca8b1015f67`; matching Vercel preview is READY.
- [x] **P0.7 ₹199/student/year licence model** — verified 31 Aug 2026. The School Subscription workspace explicitly shows licensed students, active students, remaining licences, annual start/end dates and `₹199 / licensed student / year`; all “unlimited students” semantics are removed while unlimited tests remain with no per-test charge. Live Supabase is configured with an explicit `seat_limit` and `annual_price_per_student_paise=19900`; the active-student membership trigger serializes concurrent activations and rejects missing/zero licences or over-allocation. Dedicated P0.7 checks plus TypeScript, lint, all regression suites and production build passed release gate run `33332413338` on commit `af3b7939e6f4f4dd75fedad80d04ee3e37e6223d`; matching Vercel preview is READY.
- [x] **P0.8 Subscription enforcement** — verified 31 Aug 2026. One server-side licence state now governs institutional activity: `active`, a seven-day `grace` window, `expired`, and `suspended`; only active/grace may activate students, assign new test audiences, publish institutional papers, expose institutional tests to students, or start a new institutional attempt. Historical result reads remain available independently of current licence state so expiry does not destroy or hold prior data hostage. Licence helpers are internal and not browser-executable. Dedicated P0.8 checks passed in release gate run `33332413338` together with TypeScript, lint, all regression suites and production build; matching Vercel preview is READY.
- [x] **P0.9 Safe Super Admin `View As`** — hardening branch verified by release smoke and full gate: role preview is explicitly read-only, workspace content is `inert`, page actions are disabled and a persistent `Super Admin · Read-only View As / No writes allowed` banner is shown.
- [x] **P0.10 Exam network reliability** — verified 31 Aug 2026. The exam client persists pending responses per attempt, recovers them after reload, retries with bounded backoff, automatically resynchronizes when connectivity returns, performs periodic recovery, debounces numeric saves, shows `All saved / Syncing / Offline` state, and refuses final submission until every pending answer has been confirmed by the server. Dedicated 12-point P0.10 assertions plus TypeScript, lint, all regression suites and production build passed the hardening release gate before this checklist update; the physical disconnect→answer→reconnect exercise remains independently required as acceptance item R10 and is not waived by this P0 completion.
- [x] **P0.11 RPC permission allowlist** — verified 31 Aug 2026. Live Supabase no longer gives `anon` implicit EXECUTE on the broad private `SECURITY DEFINER` surface. Every public-schema SECURITY DEFINER routine has PUBLIC/anon/authenticated EXECUTE reset, authenticated application access is explicitly restored, and anonymous access is limited to a documented nine-RPC compatibility/read/lead allowlist (`create_institute`, username availability and legacy public catalogue reads). Critical exam, paper-assignment, question mutation and analytics RPCs were live-verified authenticated-only. Migration `phase1_rpc_permission_allowlist` is applied; dedicated P0.11 assertions plus the complete release gate passed on commit `d34f417ac18a2d871858c499382b9fc5eafd5b83` in run `33334097055`; matching Vercel preview is READY.
- [x] **P0.12 Credential hardening** — implementation verified 31 Aug 2026 on hardening commit `47930604b55bb40a229c8583cc059dccaa4095bd`. School-issued/reset student passwords use cryptographically secure randomness and now create a server-side `must_change_password` state through an audited database trigger; the workspace blocks until the student replaces that temporary credential with a server-validated 12+ character password. Privileged platform/institution-admin accounts are gated through Supabase TOTP MFA/AAL2 at both server-route and database permission-helper layers. A dedicated 14-point P0.12 regression, TypeScript, lint, every regression suite and production build passed release gate run `33337396700`; the matching Vercel preview is READY. The safe password-state/RLS/trigger foundation is already live. The final AAL2 database-helper activation is deliberately staged for the coordinated production cutover (Z8) so the currently served pre-MFA production UI cannot lock existing administrators out before the new credential gate is deployed.

---

# A — Stability, security and tenancy

- [x] A1 Automated preview QA before production promotion. GitHub release gate is bound to `phase1-hardening`/`main`; exact release candidate must pass TypeScript, lint, hardening/regression suites and production build, with a matching READY Vercel preview before promotion.
- [x] A2 Tenant-isolation regression suite for School A vs School B — verified 31 Aug 2026. A production-safe SQL policy audit covers student memberships, organization questions, papers, assignments, attempts/answers and analytics authorization boundaries; the automated `a2-tenant-isolation-smoke.mjs` is wired into every Phase-1 release gate. Hardening commit `7fffbd46cd226db2c6f01e76b2c8b41433bfbd13` passed the complete release gate in run `33337647257`, and the matching Vercel preview is READY. The real two-school end-to-end proof remains independently required under R16.
- [x] A3 Audit every privileged change: institution/subscription/account/password/question/paper/result/view-as/resource — verified 31 Aug 2026. Live Supabase migration `phase1_privileged_audit_coverage` installs metadata-only audit triggers across institution, subscription, account/membership, credential state, question/options, paper/sections/questions/assignments and protected-resource mutations, plus privileged result mutations. Student-owned attempt updates are excluded from privileged audit noise. Super Admin read-only View As now records guarded `view_as.started`/`view_as.ended` events; anonymous execution is denied. The dedicated 18-point `a3-privileged-audit-smoke.mjs`, TypeScript, lint, all regression suites and production build passed release gate run `33342107192` on commit `99b00ec070e9457d1a38bd2c74c1a3ee77110113`.
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
- [x] E4 Reliable sync queue with retry/backoff and visible `All saved / Waiting / Offline` state. Verified as part of P0.10; physical disconnect/reconnect remains R10.
- [x] E5 Numeric/text answer final-save confirmation before navigation/submit. Verified as part of P0.10; final submit waits for server-confirmed pending responses.
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
- [x] I4 Support-safe View As actions are audited — verified as part of A3; read-only Super Admin View As records guarded start/end events in `audit_logs` and refuses to enter preview if the start event cannot be recorded.
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
- [ ] R4 Import 100 real student accounts.
- [ ] R5 Assign teacher to Physics/section scope.
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

- [x] Z1 All P0 items complete — verified 31 Aug 2026; P0.1 through P0.12 are checked with release-gate/live-enforcement evidence. Credential AAL2 production activation remains correctly staged under Z8 as part of coordinated cutover, not as an unchecked P0 implementation item.
- [ ] Z2 Real-school acceptance test complete.
- [ ] Z3 Tenant-isolation tests pass.
- [ ] Z4 Production build passes from exact release commit.
- [ ] Z5 Production deployment is READY and permanent domain serves the release commit.
- [ ] Z6 Runtime error/health check is clean after deployment.
- [ ] Z7 Phase 1 release version/tag/changelog recorded.
- [ ] Z8 Coordinated credential-security cutover: deploy the MFA/password-gated web release, apply the full idempotent `phase1_credential_hardening` migration so privileged database helpers require AAL2, then verify an AAL1 privileged session is blocked, TOTP AAL2 is accepted and school-issued student passwords force first-login replacement. This must be performed as one release operation; do not activate the database AAL2 gate while the old pre-MFA production UI is still being served.
