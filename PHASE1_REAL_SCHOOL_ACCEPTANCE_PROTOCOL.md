# Evidara Phase 1 — Real-School Acceptance Protocol

Status: execution-ready protocol for checklist R1–R18. It does **not** by itself satisfy any R item.

## Acceptance rule

R1–R18 require an authorised institution dataset and genuine end-to-end evidence. Synthetic fixtures may be used for rehearsal and destructive probes, but they must not be labelled “real-school acceptance”. Each item receives a checkmark only after its evidence is captured and the complete Phase 1 release gate remains green.

Permanent production remains protected until R1–R18, load acceptance and production sign-off are complete.

## Pre-flight controls

Before starting R1:

- Record exact hardening branch SHA and matching READY preview/deployment.
- Confirm complete release gate PASS on that SHA.
- Confirm production remains on the previous known-good release.
- Confirm Supabase project health and security advisors have no unresolved release-blocking finding.
- Confirm counsel-approved Privacy Policy and institution processing terms, or explicitly record J3 as a blocker to using production personal data.
- Obtain written/internal authorisation for the institution dataset used in acceptance.
- Define named acceptance operators: Super Admin, School Admin, Teacher and Student.
- Do not paste passwords, service-role keys, access tokens, parent phone numbers, raw student answer payloads or other secrets into screenshots/logs.

## Evidence bundle structure

Create one dated evidence folder outside the public repository if it contains personal data. The repository may store only redacted metadata/summary references.

Suggested structure:

- `00-run-manifest.md` — date, branch SHA, release-gate run, preview/deployment ID, Supabase project, operators.
- `01-school-a.md` — R1–R8 evidence.
- `02-student-exam.md` — R9–R13 evidence.
- `03-admin-analytics-export.md` — R14–R15 evidence.
- `04-school-b-isolation.md` — R16 evidence.
- `05-licence-lifecycle.md` — R17–R18 evidence.
- `acceptance-results.csv` — item, pass/fail, evidence reference, operator, timestamp, notes.

## R1 — Create Test School A as a real institution

Pass criteria:

- Institution created through the production-intended transactional onboarding path.
- Institution ID captured privately.
- Onboarding audit event present.
- No partial tenant/bootstrap state if any attempted validation fails.

Evidence: redacted institution record + audit metadata + exact onboarding timestamp.

## R2 — Create a 100-seat annual licence at ₹199/student

Pass criteria:

- Seat limit exactly `100`.
- Annual price exactly ₹199/student/year in UI and persisted configuration.
- Start/end dates valid and visible.
- Remaining-licence calculation is correct before imports.

Evidence: redacted subscription screenshot/export and database-side count summary.

## R3 — Create School Admin and Teacher accounts

Pass criteria:

- Separate named accounts/identities; no shared privileged account.
- School Admin membership active for School A only.
- Teacher membership active for School A only.
- Temporary-password / required-change flow works where applicable.
- Privileged MFA/AAL2 requirement is exercised when the coordinated cutover is active.

Evidence: role/membership summary; never record passwords or MFA secrets.

## R4 — Import 100 real student accounts

Pass criteria:

- Exactly 100 authorised student rows imported/activated.
- Licence usage becomes 100/100 with no over-allocation.
- Invalid rows, if any, are rejected with an exportable failed-row report and corrected deliberately.
- No accidental duplicate membership/account records.

Evidence: import totals, failed-row summary, final licence count. Do not place personal-data exports in the public repo.

## R5 — Assign Teacher to Physics/section scope

Pass criteria:

- Teacher is explicitly scoped to the intended Grade 11 Physics section/programme.
- Teacher can access intended students/questions/papers.
- Teacher cannot access another section/institution merely by changing client parameters.

Evidence: redacted scope configuration + negative-access probe result.

## R6 — Import at least 500 questions and resolve invalid rows

Pass criteria:

- At least 500 usable School A questions are imported.
- Subject/chapter/topic mapping is present for analytics-ready questions.
- Invalid rows/assets are surfaced and resolved or explicitly excluded.
- Duplicate prevention and upload/ZIP safety remain active.

Evidence: import totals, invalid/resolved totals, taxonomy coverage summary.

## R7 — Approve questions

Pass criteria:

- Required questions move through the approved institutional workflow.
- Correct-answer authority and analytics-readiness requirements are satisfied.
- Audit/collaboration metadata remains present.

Evidence: approved-count summary and representative redacted approval records.

## R8 — Create Physics test and assign Grade 11 section/programme

Pass criteria:

- Test uses approved questions.
- Intended Grade 11 programme/section audience preview is exact.
- Published paper has at least one assigned student.
- Frozen question/taxonomy snapshot exists for assessment evidence.

Evidence: redacted paper configuration, audience count and snapshot summary.

## R9 — Login using a real student account and start assigned test

Pass criteria:

- A student in the assigned cohort can discover and start the test.
- A non-assigned student cannot start it.
- One authoritative active attempt is created despite refresh/retry.

Evidence: student journey capture + attempt metadata summary.

## R10 — Disconnect network, answer, reconnect and verify recovery/sync

This must be a physical/rendered browser network exercise, not only a source-code assertion.

Procedure:

1. Start the assigned test online.
2. Confirm save state is `All saved`.
3. Disconnect browser/network using a real network-offline mechanism.
4. Answer at least one choice question and one numeric/text question while offline if the paper supports them.
5. Confirm UI shows offline/waiting state rather than false success.
6. Reload only if the defined recovery scenario requires it; verify pending data is retained.
7. Restore connectivity.
8. Confirm automatic retry/resynchronisation completes.
9. Read back authoritative server responses and verify the offline answers are present exactly once.
10. Confirm final submission is blocked while any pending save is unconfirmed.

Evidence: timestamped network-state capture, client save-state transitions, redacted authoritative response verification.

## R11 — Submit and verify authoritative marks manually

Pass criteria:

- Final submission returns authoritative durable receipt.
- Retrying submission returns the same receipt and does not double-score.
- A human manually recomputes expected marks from the paper/correct answers for the acceptance student and matches server marks exactly.

Evidence: receipt ID redacted/hash, manual scoring worksheet and server result comparison.

## R12 — Verify held/released result modes

Exercise at least:

- hidden → no marks/answers/analytics;
- score_only → score only;
- score_and_answers → score + answer review;
- in_depth_analytics → analytics;
- after_close → remains withheld before server close time and releases only after close.

Pass criteria: server/API and UI agree; a client cannot bypass release mode by calling legacy/raw helpers.

Evidence: per-mode matrix with timestamp and expected/actual visibility.

## R13 — Verify student subject/chapter/topic/question analytics

Pass criteria:

- Released analytics are derived from authoritative submitted evidence.
- Subject → chapter → topic → question drill-down is internally consistent.
- Not-assessed states are not converted to fabricated zero performance.
- Historical/frozen taxonomy is used for the assessment.

Evidence: redacted analytics workbook/screenshots and recomputed sample.

## R14 — Verify Teacher and School Admin drilldowns

Pass criteria:

- Teacher sees only assigned academic scope.
- School Admin sees School A institutional scope.
- School → programme → grade → section → subject → chapter → topic → student hierarchy works where evidence exists.
- Needs Attention and leaderboard/percentile semantics match the metric dictionary and evidence thresholds.

Evidence: redacted drill-down matrix and negative-scope checks.

## R15 — Export test result and analytics spreadsheet

Pass criteria:

- A genuine Excel workbook is downloaded/opened successfully.
- Result sheet contains authoritative expected fields/marks.
- Student × subject/chapter/topic analytics sheets are present and scoped to School A.
- Parent contact data and cross-school data are absent unless explicitly required by an approved export purpose.

Evidence: private acceptance workbook + repository-safe sheet/row-count/hash summary.

## R16 — Create School B and prove isolation from School A

Pass criteria:

- School B exists as an independent tenant with its own admin/test data.
- School B browser/API calls cannot read School A students, questions, papers, attempts, answers, results or analytics.
- Parameter tampering with known School A identifiers returns no unauthorised data.
- Multi-institution support compatibility paths fail closed or require explicit audited scope.

Evidence: table of attempted cross-tenant reads with endpoint/RPC class and denied/empty result. Do not disclose student data in the evidence summary.

## R17 — Expire School A licence

Pass criteria:

- New institutional activity that requires active/grace licensing is blocked after expiry according to the product contract.
- Historical submitted results remain readable where contract/policy permits.
- Existing data is not deleted or silently reassigned.

Evidence: before/after licence status, blocked action matrix, historical-read confirmation.

## R18 — Renew licence and verify restoration

Pass criteria:

- Renewal restores permitted new activity without recreating institution, users, questions, papers or historical attempts/results.
- Seat calculations remain correct.
- Audit/subscription history records the lifecycle change.

Evidence: renewal metadata, restored-action matrix and stable historical identifiers.

## Completion matrix

| Item | Result | Evidence reference | Operator | Timestamp | Notes |
|---|---|---|---|---|---|
| R1 | Pending | | | | |
| R2 | Pending | | | | |
| R3 | Pending | | | | |
| R4 | Pending | | | | |
| R5 | Pending | | | | |
| R6 | Pending | | | | |
| R7 | Pending | | | | |
| R8 | Pending | | | | |
| R9 | Pending | | | | |
| R10 | Pending | | | | |
| R11 | Pending | | | | |
| R12 | Pending | | | | |
| R13 | Pending | | | | |
| R14 | Pending | | | | |
| R15 | Pending | | | | |
| R16 | Pending | | | | |
| R17 | Pending | | | | |
| R18 | Pending | | | | |

## Post-run release rule

After R18, re-run the **complete** Phase 1 release gate on the exact candidate SHA. Any code/data migration fix discovered during acceptance invalidates earlier final-candidate evidence until the full gate passes again. Then proceed to load acceptance L1–L6 and production sign-off; do not promote production merely because R1–R18 have passed.
