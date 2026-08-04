# Evidara V6.8.0 — Production QA and Launch Readiness

Evidara V6.8.0 is a validation release built on the merged V6.7.1 baseline. It does not add a deployment provider and does not change the production deployment boundary.

## Included

- protected Super Admin system-readiness dashboard at `/admin/readiness/`
- server-side Supabase configuration, database and Auth Admin diagnostics
- migration 24 table, column and fulfilment-RPC readiness checks
- authenticated `readiness-check` Supabase Edge Function
- Razorpay Test Mode key-format, secret-pair, webhook, origin allow-list and API credential diagnostics
- shared role-access contract used by the client guard and QA smoke matrix
- clear configuration and API remediation messages without exposing secrets
- branch-only GitHub Actions QA workflow
- deterministic `npm run qa:smoke` release checks
- complete Codespaces validation checklist
- runtime version update to `6.8.0`

## Safety boundaries

- Razorpay Live Mode credentials are detected and intentionally not validated by the diagnostic function.
- Diagnostic responses expose only booleans, counts and safe status messages.
- Migration 24 fulfilment is probed with the zero UUID and must stop at `Order not found` before mutation.
- The GitHub Actions workflow installs, lints, typechecks, smoke-checks and builds only.
- No Vercel configuration is introduced.
- No deployment, merge or infrastructure mutation is performed by the QA workflow.

## Required manual evidence before launch

- successful GitHub Actions run
- successful Codespaces `npm run qa`
- real Super Admin readiness report with zero blocked checks
- migration 24 SQL confirmation
- Razorpay Test Mode API authentication
- paid, partial-voucher and 100% offline-voucher test cases
- webhook replay/idempotency confirmation
- signed-out, student, school and Super Admin route checks

See `docs/V6_8_CODESPACES_QA.md` for the exact procedure.
