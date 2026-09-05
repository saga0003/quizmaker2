# Evidara Phase 1 — Same-Project Acceptance Addendum

Status: owner-approved Free-plan acceptance mode for Phase 1. This addendum narrows, rather than removes, the existing acceptance safety controls.

## Why this mode exists

A separate Supabase staging project is not available on the current Free-plan budget. Phase 1 acceptance may therefore use the existing Evidara Supabase project **only** as a logically isolated synthetic acceptance tenant while the permanent public web deployment remains protected.

This mode is not permission to load-test real client data or the permanent production web host.

## Fixed acceptance identity

- Acceptance institution name: **Evidara School**.
- Acceptance institution slug: `evidara-school-acceptance`.
- Supabase project ref: `xzfozpnzvznqrvcsoail`.
- The institution must be visibly marked as demo/synthetic acceptance data.
- Students, teachers, administrators, questions, papers and attempts created for acceptance must use deterministic synthetic identifiers or an acceptance-only email domain.
- St. Mary's or any future client institution must not be used as the Phase 1 acceptance identity or source of acceptance data.

## Web/deployment isolation

All rendered acceptance and load traffic must target a READY `phase1-hardening` Vercel preview/acceptance deployment for the exact candidate SHA.

The following remain forbidden load targets:

- the permanent `main` deployment;
- `evidara.in` / `www.evidara.in`;
- permanent quizmaker2 production aliases.

The preview may intentionally use the same Supabase backend only under the database/tenant controls below.

## Shared-database safety envelope

Before each acceptance/load block:

1. Capture `pg_database_size(current_database())` immediately before execution.
2. Confirm the acceptance tenant is exactly `evidara-school-acceptance` and `is_demo=true`.
3. Confirm the permanent Vercel production runtime has no active error incident.
4. Confirm the exact candidate release gate is green.
5. Record the exact candidate SHA, preview deployment, Supabase ref and current database bytes in the acceptance manifest.

Hard capacity rule:

- **450 MiB (`471859200` bytes) is the absolute same-project acceptance ceiling.**
- No fixture batch may begin when the measured database is at or above that ceiling.
- Fixture creation must be batched and the database size rechecked between major L1/L2/L3 stages.
- If projected or measured growth risks the ceiling, abort and clean synthetic fixtures before continuing.
- Do not weaken the 500 MB Free-plan platform limit by relying on read-only mode as a safety mechanism.

## Dataset lifecycle

- R1–R18 use **Evidara School** and dedicated synthetic accounts while exercising the real onboarding/auth/teacher/student/exam/result/analytics paths.
- The phrase “real-school acceptance” in older checklist/protocol wording means a genuine end-to-end institution workflow; under this owner-approved mode the identities/data are synthetic.
- Start the representative acceptance licence at **100 seats / ₹199 per licensed student per year** so the licence lifecycle is tested honestly.
- After R17/R18 are complete, the same acceptance tenant may be expanded to **2,000 seats** for L1–L6.
- L1–L3 scale fixtures must be clearly tagged/prefixed and removable without affecting the existing sales demo or future client data.
- L4–L6 use distinct synthetic student sessions, bounded ramps, predeclared budgets and the existing circuit breaker.
- After acceptance, remove/archive synthetic load data and verify that non-acceptance tenants are unchanged.

## Existing temporary benchmark cleanup

On 2 Sep 2026, before enabling this mode, the old V13 benchmark run explicitly marked `temporary=true` was removed from the four `v13_benchmark_*` tables. It contained 10,000 synthetic benchmark students and 1,200,000 synthetic benchmark responses. No live question-bank rows or sales-demo rows were removed.

Database size changed from approximately **361 MB to 206 MB**, restoring headroom for guarded Phase 1 synthetic acceptance on the Free plan.

## Acceptance credit

This addendum does not itself satisfy any R or L checklist item. Each R/L item still requires its specified end-to-end execution, evidence, correctness checks and a green complete release gate.

J3 legal review remains independently required for final production sign-off. Synthetic acceptance data allows engineering acceptance to continue without treating unreviewed privacy terms as permission to use real student personal data.
