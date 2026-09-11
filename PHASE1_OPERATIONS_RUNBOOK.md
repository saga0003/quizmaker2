# Evidara Phase 1 Operations & Recovery Runbook

## Scope

This runbook is the production recovery contract for Phase 1. Permanent production is not promoted until the release checklist, real-school acceptance, load acceptance and coordinated credential cutover are complete.

## Monitoring and first response

1. GitHub `Evidara Phase 1 Release Gate` is the build/release alarm: any TypeScript, lint, regression or production-build failure blocks promotion.
2. GitHub `Evidara Phase 1 Production Monitor` probes the canonical public application plus `/api/ops/health/` hourly. A failed scheduled job is an operational alert.
3. `/api/ops/health/` is deliberately sanitized. It returns only release identity, dependency booleans, and boolean activity-failure categories; no student, institution or usage data is exposed publicly.
4. Vercel runtime errors are checked for production 5xx/fatal clusters when an alert fires. Supabase database/auth/storage logs are then checked for the matching window.
5. Classify the incident: deployment/build, application 5xx, database, auth, Supabase Storage, import, test start, answer save, submission, or unknown.

## Supabase database backup / PITR strategy

- Production database recovery must use the Supabase project backup/PITR capability available on the active plan. Before final Z5/Z8 cutover, verify in the Supabase dashboard that scheduled backups are current and, where the project plan supports PITR, that PITR is enabled with the intended retention window.
- Schema changes are represented by committed `supabase/migrations/*` files. Never use a production-only unrecorded DDL change for a release.
- Before a destructive or high-risk production migration, take/verify the latest recoverable backup point and record the migration version in `PHASE1_PROGRESS_LOG.md`.
- For a database incident, stop new write-producing operations first if continuing writes can worsen corruption. Preserve historical result reads where safe.
- Recovery order: identify last known-good timestamp → restore to a separate recovery project/branch when possible → validate row counts/tenant isolation/attempt and response integrity → only then schedule production restore or data replay.
- Never overwrite production from an unverified recovery copy.

## Supabase Storage recovery strategy

- Public question and PYQ image bytes are stored in the public Supabase Storage bucket `question-assets`. Private academic resources remain in the private bucket `academic-resources-private` and are served through short-lived signed URLs.
- Storage credentials remain server-only. Do not expose service-role or secret keys in client code, logs, tickets or screenshots.
- `/api/ops/health/` probes the real `question-assets` bucket through the server-side Supabase client; a missing bucket, permission failure or Storage outage must make the storage dependency unhealthy.
- For a missing-object incident, first confirm the database/question content points to the expected object key. Do not fabricate a replacement URL.
- Restore the exact object key from an available provider backup/history source when possible. If no recoverable object exists, require an authorized institution/platform operator to re-upload it.
- After restoration, verify upload signature policy, permanent public access semantics for question assets, signed/private access semantics for academic resources, and tenant authorization before declaring recovery complete.

## Vercel rollback

1. Identify the last known-good production deployment and exact Git commit.
2. Confirm the prior deployment is `READY` and its database contract is backward-compatible with the current live schema.
3. Roll back/promote the last known-good deployment from Vercel only when doing so will not strand newer required database migrations.
4. Re-run the permanent-domain health probe and inspect production runtime errors after rollback.
5. Record deployment ID, commit, reason, operator and verification result in `PHASE1_PROGRESS_LOG.md`.

A web rollback does not automatically roll back Supabase. Database rollback/restoration is a separate controlled operation.

## Incident playbooks

### Build/release gate failure
- Do not promote.
- Inspect the failing GitHub job and first failing regression/build step.
- Fix on the active Phase 1 hardening branch; rerun the complete gate on the exact candidate.

### Production 5xx / dependency outage
- Check Vercel runtime-error clusters and deployment state.
- Check Supabase project health plus API/auth/postgres/storage logs.
- Check `question-assets` bucket reachability where question-image paths are involved and `academic-resources-private` where protected resource paths are involved.
- Prefer rollback for a release-caused fault; prefer dependency recovery/fail-closed behavior for provider outages.

### Authentication failure spike
- Check Supabase Auth logs and project health.
- Verify publishable/server key configuration without exposing values.
- Do not bypass MFA/AAL2 or weaken tenant authorization as an emergency fix.

### Test start / answer save / submission failures
- Use the Audit & Health failure evidence plus attempt/event IDs available to privileged support.
- Preserve idempotent submission and pending-answer recovery semantics.
- Never manually edit authoritative marks without an audited, separately approved correction workflow.

### Import failure spike
- Inspect failed-row reports and server validation errors.
- Do not relax signature, ZIP-safety, duplicate or analytics-ready validation to force an import through.

## Recovery verification checklist

After any incident or rollback: production deployment is READY; permanent domain responds; `/api/ops/health/` is green; Vercel runtime error check is clean for the verification window; Supabase project is ACTIVE_HEALTHY; representative privileged login works with MFA policy; representative student discovery/start/save/submit/result read works as applicable; tenant-isolation smoke remains green; complete release gate passes before any new promotion.
