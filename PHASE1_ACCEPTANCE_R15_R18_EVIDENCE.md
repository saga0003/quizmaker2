# Evidara Phase 1 Acceptance Evidence — R15–R18

Date: 5 September 2026

All evidence below uses only the existing synthetic acceptance institution `Evidara School` (`evidara-school-acceptance`) in Supabase project `SMIS QP` (`xzfozpnzvznqrvcsoail`). No St. Mary’s or future-client data was used and no additional Supabase project was created.

## R15 — Export test result and analytics spreadsheet

- Rendered protected-preview acceptance workflow `33942962018` passed on functional candidate `60503827afd46e28994b2dcc6f2c15f022e1ad14`.
- The browser downloaded and opened the real workbook `Evidara-School-A-analytics.xlsx`.
- Workbook evidence: Results = 100 students; Test Results = 3; Subject Analytics contains Physics; Chapter Analytics contains Kinematics; Topic Analytics contains Motion in One Dimension.
- Browser evidence: 0 console errors, 0 page errors, 0 failed HTTP responses.
- Complete Phase 1 release gate `33943063087` passed on branch checkpoint `c15c2a4e679da04288041939d19945b123d97418`, which contains the R15 authorization fix and acceptance harness.

## R16 — Cross-school isolation

Because the acceptance programme is constrained to the one existing synthetic tenant, School B was created only as a rollback-style transient synthetic probe inside the same `SMIS QP` database and was removed before the proof finished. No persistent second customer tenant was retained.

Using the existing synthetic School Admin identity with its Evidara School membership temporarily disabled and a transient School B `school_admin` membership active, authenticated-role RLS produced:

- School A student memberships visible: 0.
- School A question papers visible: 0.
- School A exam attempts visible: 0.
- `is_evidara_school_manager(School A)` = false.
- `is_evidara_school_manager(School B)` = true.
- For an A-only learner (`937bc187-9d34-4609-851e-7f526bafb21e`), `analytics_can_view_student_v12` = false.
- `get_student_analytics_v12` for that School A learner was denied with SQLSTATE `42501`.
- Probe cleanup verified persistent School B organizations = 0 and the original Evidara School Admin membership restored = 1.

An initial diagnostic used a synthetic learner whose auth identity also belongs to the separate sales-demo fixture; that identity can legitimately expose its sales-demo analytics and was therefore not valid evidence of a School A leak. The final proof intentionally used an A-only learner and confirmed the School A boundary.

## R17 — Expired licence behaviour

The synthetic Evidara School subscription was temporarily moved to a fully elapsed annual period (past the seven-day grace window), then immediately restored after the proof.

While expired:

- `school_license_state_v19(Evidara School)` = `expired`.
- `school_can_run_new_activity_v19(Evidara School)` = false.
- The assigned Phase 1 Physics paper disappeared from `list_available_papers()` for the synthetic learner.
- `start_exam_attempt(...)` was denied with SQLSTATE `42501` and message `This institution licence is not active. Contact your school administrator.`
- Historical submitted result `134ddbe2-bc9f-4863-9aba-3b9def08d69e` remained visible through `list_my_attempt_results()`, proving read-only historical access remains available after expiry.

## R18 — Renewal restores access without recreating data

The exact synthetic annual licence was restored to its original active dates `2026-09-02` → `2027-09-02`, 100 seats.

After restoration:

- `school_license_state_v19(Evidara School)` = `active`.
- `school_can_run_new_activity_v19(Evidara School)` = true.
- The existing assigned Physics paper became visible again to an active A-only synthetic learner without recreating the paper, assignment, roster or taxonomy.
- A zero-attempt active synthetic learner successfully started the existing paper, producing probe attempt `7f4992cd-4bac-4c1f-8326-9548478c69b2`.
- The probe attempt was deleted immediately after verification.
- Post-cleanup counts returned to the established acceptance baseline: 100 student memberships, 1 institutional paper, 3 attempts; probe attempt count = 0.
- Subscription post-cleanup: `active`, 100 seats, starts `2026-09-02`, ends `2027-09-02`.

Permanent production was not promoted or modified during these acceptance operations.
