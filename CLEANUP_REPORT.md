# Evidara Source Cleanup Report — 7 August 2026

## Removed automatically generated/local-only material

- `.next/` build and development cache
- `node_modules/` dependency installation
- `.vercel/` local Vercel link metadata
- `backups/`
- nested ZIP/build/log/TypeScript incremental artifacts from the shared source package

These are reproducible or machine-local and do not belong in a clean source archive.

## Removed obsolete one-off update/hotfix launchers

- `APPLY_ANALYTICS_UPDATE.*`
- `APPLY_INSTITUTION_ANALYTICS_UPDATE.*`
- `APPLY_LIVE_INSTITUTION_ANALYTICS_FIX.*`
- `FIX_SETUP_ERROR.bat`
- `REPAIR_AND_START_EVIDARA.*`
- `VERIFY_ANALYTICS_AND_BUILD.*`
- `VERIFY_AND_START_EVIDARA.bat`
- associated old hotfix/readme/report files

These scripts were tied to earlier packaging/update steps rather than the current V13.2 source workflow.

## Removed obsolete historical QA/update scripts

- V7 smoke
- V8 paper smoke
- V9 product smoke
- V10 analytics phase/reference smoke scripts
- V12 smoke
- old production-baseline smoke
- old institution analytics patch/apply scripts
- old V10 analytics trial bootstrap helper

The active package scripts use the V13.2 checks plus Phase 0 / Phase 1 Increment 2–4 checks, which were retained.

## Retained important launchers

- `TEST_EVIDARA.bat`
- `RUN_EVIDARA_SERVER.bat`
- `SETUP_EVIDARA_ON_THIS_COMPUTER.bat`
- `CHECK_R2_LOCAL.bat`
- `PUBLISH_EVIDARA.bat`

A new `VERIFY_EVIDARA.bat` was added to run the current verification chain without relying on retired analytics-specific helpers.

## Retained development/source material

- all `src/` application source
- all Supabase historical SQL and Edge Functions
- current `supabase/migrations/` hardening migrations
- current `supabase/tests/` authorization suites
- current V13.2 and Phase 1 QA scripts
- current audit and implementation tracker
- sample-import assets
- package manifests and application configuration

## Additional cleanup

Unused default Next.js/Vercel starter SVG assets were removed after confirming no application reference to them.

No application feature source, current migration, current authorization test, or current Phase 1 implementation file was intentionally removed.
