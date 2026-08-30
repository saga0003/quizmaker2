# Evidara Phase 1 Clean — Build Report

## Scope delivered

This build keeps the Evidara V19.1 architecture and Phase 1 feature-parking policy, while replacing the rough school-facing workflows with the approved clean Phase 1 experience.

Implemented areas:

- Teacher-friendly Question Import + Paper Creation workflow.
- Provider-independent AI conversion helper for Evidara-ready LaTeX / Excel / image-ZIP preparation.
- Atomic organization question import with duplicate reuse and optional draft paper creation.
- Institution-owned Subject → Chapter → Topic management with bulk creation and safe archival.
- Dynamic taxonomy completeness warnings tied to analysis quality.
- Full School Admin student profile operations, password controls and bulk promotion.
- Teacher assigned-section read-only roster behaviour.
- Clean Founding Institution Plan subscription dashboard.
- Unlimited-student marker (`seat_limit = 0`) for Phase 1 subscriptions.
- Existing Phase 1 hidden/public module rules retained; Study Resources retained.

## Verification completed in the build environment

- Changed TypeScript/TSX files: syntax transpilation passed.
- `npm run qa:phase1-clean`: **40/40 passed**.
- `npm run qa:regression`: **passed completely**.
- Phase 1 launch visibility suite: **42/42 passed**.
- Institution analytics suite: **48 checks passed**.
- Student lifecycle Phase 1 Increment 4: **36 checks passed**.
- Student live dashboard/resources: **22/22 passed**.
- V18 PYQ/Paper Engine: **41/41 passed**.
- V19 source-fidelity engine: **25/25 passed**.
- V19.1 LaTeX Paper Import: **19/19 passed**.

The complete regression output is retained in `PHASE1_CLEAN_REGRESSION.log`.

## Final build note

The working build environment does not contain this project's `node_modules`, so a full Next.js `typecheck + lint + production build` could not be completed here without a dependency download. The included one-click Windows launcher already handles that final verification: on your internet-connected PC, double-click `TEST_EVIDARA.bat`; it installs/repairs dependencies and runs the release preflight/build before starting Evidara.

## Required database change

Run `APPLY_PHASE1_CLEAN_TO_SUPABASE.sql` once before testing the new **Import Questions & Create Paper** operation. The same SQL is also present as the timestamped migration under `supabase/migrations/`.
