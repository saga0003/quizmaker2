# Phase 1 Acceptance — R1-R5 Evidence

Recorded: 2 Sep 2026

This evidence applies only to the isolated synthetic acceptance tenant `Evidara School` (`evidara-school-acceptance`) in the existing SMIS QP Supabase project. It must never be interpreted as evidence from St. Mary's or any future-client data.

## Environment safety

- Acceptance mode: same-project isolated synthetic tenant.
- Permanent production was not used for the browser exercise.
- Acceptance browser target: `https://quizmaker2-git-phase1-hardening-saga0003s-projects.vercel.app`.
- Supabase project ref: `xzfozpnzvznqrvcsoail`.
- Database size at verification: `216411283` bytes, below the hard acceptance ceiling used by the preflight.

## Authenticated rendered-browser readiness

GitHub Actions run `33645773392` (`Phase 1 Authenticated Acceptance Readiness`) passed on candidate `b063e32fee2332011b5d2223f09f3841168f9c80`.

The run performed the same-project safety preflight, verified that all six role credentials were configured, used the protected-preview bootstrap without recording secrets, installed Chromium/Playwright, and signed in as each acceptance role.

Observed rendered results:

- `school_admin` — PASS, landed on `school-dashboard`, zero captured console errors, zero page errors.
- `school_teacher` — PASS, landed on `school-dashboard`, zero captured console errors, zero page errors.
- `student` — PASS, landed on `student-dashboard`, zero captured console errors, zero page errors.

The readiness runner explicitly states that this is only readiness for R1-R18 and does not by itself satisfy an R checklist item.

## Live R1-R5 preconditions

Fresh live SQL inspection on 2 Sep 2026 established the following inside `evidara-school-acceptance`:

- R1 tenant fixture exists: organization name `Evidara School`, slug `evidara-school-acceptance`, status `active`, marked demo/synthetic.
- R2 licence fixture exists and is active: plan `Evidara ₹199 Student Licence`, start `2026-09-02`, end `2027-09-02`, seat limit `100`, annual price per student `19900` paise (₹199).
- R3 role fixtures exist and the corresponding School Admin, Teacher and Student credentials successfully authenticate in the rendered browser readiness run above.
- R5 scope fixture exists: Grade 11 / Section A has an active Physics teacher-section assignment.
- Current active student fixture count is intentionally below R4's 100-student requirement; therefore R4 remains pending.

No R item is checked solely by this evidence document. Checklist checkmarks require the acceptance criterion itself, regression protection where applicable, and a complete green release gate from the exact recording commit.

## Next acceptance action

Build and execute the R4 synthetic bulk-roster path to reach exactly 100 active acceptance students without exceeding the 100-seat licence, verify all accounts/lifecycle rows through canonical product paths, then continue R6-R18. R1/R2/R3/R5 may be recorded as complete only after the exact evidence-recording commit is covered by the complete release gate and the checklist is updated without weakening R4-R18.
