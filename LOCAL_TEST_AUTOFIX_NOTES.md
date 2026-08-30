# Evidara Phase 1 — Local Test Auto-Fix

The Windows launch workflow has been changed so a normal user can double-click `TEST_EVIDARA.bat` without manually repairing npm metadata.

## Fixed

1. The previous `npm ci` first-run failure caused by an out-of-sync `package.json` / `package-lock.json` no longer blocks startup.
2. Fresh/repair installs now use `npm install`, which reconciles the dependency graph, repairs the lockfile when required, and installs dependencies in one operation.
3. Existing healthy `node_modules` is reused, so normal subsequent launches do not reinstall packages or require internet.
4. The same dependency helper is used by Test, Verify, Setup and Publish scripts.
5. Local health checks now expect Evidara `19.1.0` instead of the stale `19.0.0` value.

## What the user does

- Keep `.env` or `.env.local` in the Evidara folder.
- Double-click `TEST_EVIDARA.bat`.
- The first run requires internet access to download npm packages.
- Later runs reuse the installed dependencies unless npm detects that repair is required.

`TEST_EVIDARA.bat` does not publish the website and does not run Supabase migrations.


## 2026-08-27 Phase-1 QA compatibility fix

The legacy `post8-public-student-smoke.mjs` originally required the public landing page to link the student store and market independent-student commerce. That contradicted the Phase-1 launch policy, where those engines are intentionally retained but parked from public/school access.

Fixed behavior:
- Phase-1 landing must **not** link `/products/`.
- Phase-1 landing must **not** market independent-student commerce.
- The underlying store/referral/commerce source and migrations are still checked so the future engines are not deleted.
- `qa:regression` now runs `phase1-launch-smoke.mjs` first, so launch visibility and Super-Admin-only policy are verified as part of every TEST_EVIDARA preflight.
