# Phase 1 Acceptance — R1-R5 Evidence

Recorded: 2 Sep 2026

This evidence applies only to the isolated synthetic acceptance tenant `Evidara School` (`evidara-school-acceptance`) in the existing SMIS QP Supabase project. It must never be interpreted as evidence from St. Mary's or any future-client data.

## Environment safety

- Acceptance mode: same-project isolated synthetic tenant.
- Permanent production was not used for the browser exercise or R4 roster exercise.
- Acceptance browser target: `https://quizmaker2-git-phase1-hardening-saga0003s-projects.vercel.app`.
- Supabase project ref: `xzfozpnzvznqrvcsoail`.
- Database size after R4 verification: `216624275` bytes, below the hard acceptance ceiling used by the preflight.
- Vercel production/main health probe returned HTTP 200 and project runtime errors were zero in the preceding 24 hours before the R4 exercise.

## Authenticated rendered-browser readiness

GitHub Actions run `33645773392` (`Phase 1 Authenticated Acceptance Readiness`) passed on candidate `b063e32fee2332011b5d2223f09f3841168f9c80`.

The run performed the same-project safety preflight, verified that all six role credentials were configured, used the protected-preview bootstrap without recording secrets, installed Chromium/Playwright, and signed in as each acceptance role.

Observed rendered results:

- `school_admin` — PASS, landed on `school-dashboard`, zero captured console errors, zero page errors.
- `school_teacher` — PASS, landed on `school-dashboard`, zero captured console errors, zero page errors.
- `student` — PASS, landed on `student-dashboard`, zero captured console errors, zero page errors.

The readiness runner explicitly states that this is readiness for R1-R18 and does not by itself satisfy an R checklist item.

## R1-R5 live acceptance evidence

Fresh live inspection and controlled synthetic execution on 2 Sep 2026 established the following inside `evidara-school-acceptance`:

- R1 tenant fixture exists: organization name `Evidara School`, slug `evidara-school-acceptance`, status `active`, marked demo/synthetic.
- R2 licence fixture exists and is active: plan `Evidara ₹199 Student Licence`, start `2026-09-02`, end `2027-09-02`, seat limit `100`, annual price per student `19900` paise (₹199).
- R3 role fixtures exist and the corresponding School Admin, Teacher and Student credentials successfully authenticate in the rendered browser readiness run above.
- R4 was executed only against synthetic accounts under `@demo.evidara.app`. Starting from 2 active synthetic students, 97 synthetic student accounts were created and added through the canonical `add_school_student_membership_v13` lifecycle RPC under the acceptance School Admin actor, producing exactly `99/100` active students. One additional synthetic student was then added through the same canonical RPC, producing exactly `100/100` active students.
- R4 overflow enforcement was then probed with a 101st synthetic activation inside an isolated subtransaction. The canonical insert trigger `enforce_student_licence_v19` blocked the activation with SQLSTATE `23514` and message `Student licence limit reached (100 licensed students). Increase the licensed quantity before activating another student.` The failed synthetic account creation rolled back with the subtransaction; post-probe state remained exactly `100` active students and zero persisted overflow account.
- R5 scope fixture exists: Grade 11 / Section A has an active Physics teacher-section assignment.

The R4 exercise did not alter the seat limit, subscription dates, or licence state and did not touch any St. Mary's or future-client tenant data.

## Release-gate rule

No R item is checked solely by this evidence document. Checklist checkmarks require the acceptance criterion itself and a complete green release gate covering this exact evidence-recording commit. After that gate is green, R1-R5 can be checked and R6 becomes the next acceptance item.

## Next acceptance action

Run the complete release gate for this R4 evidence commit. If green, record R1-R5 as complete in `PHASE1_RELEASE_CHECKLIST.md`, run the gate again for the checklist-only change, and immediately begin R6 with a synthetic CSV of at least 500 questions plus invalid-row correction and duplicate-resolution evidence.
