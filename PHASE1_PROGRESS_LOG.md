# Evidara Phase 1 Progress Log

This log records each production-hardening run with observable implementation and verification evidence. Times are IST unless noted otherwise.

## 2026-08-31 08:58:24 IST — A8 Rich HTML sanitation

- **Checklist item:** A8 — Rich HTML sanitation uses a proven sanitizer or safe structured editor.
- **Run start:** 2026-08-31 08:58:24 IST.
- **Implementation start (first relevant commit):** 2026-08-31 09:00:13 IST — `a69a936dc00856a461c46a30c594cb5ec02d1efe` (`Harden rich content rendering against raw HTML sinks`).
- **Implementation end (final functional/rework commit):** 2026-08-31 09:07:56 IST — `888a42eed8fba28dc92525a910f93bab8cf813d0` (`Update V19.1 regression for safe KaTeX renderer`).
- **Observable elapsed engineering span:** 7m 43s from first to final relevant commit.
- **Verification:** GitHub Actions release-gate run `33354463933`, 2026-08-31 09:07:58–09:10:08 IST, duration 2m 10s — **PASS**. Dedicated A8 checks, TypeScript, lint, every required regression suite, production build and final release-gate enforcement all passed.
- **Implementation result:** Question authoring remains constrained to structured React text/LaTeX/image fields. The app-owned `katex.renderToString` + `dangerouslySetInnerHTML` rich-math sink was removed; normalized LaTeX now renders through `react-katex`, and parse/error fallback is rendered as React text rather than interpolated HTML. A permanent 12-point A8 regression checks the editor, question preview, source-fidelity renderer, contentEditable/raw-Markdown paths and iframe/srcDoc injection paths.
- **Rework/failures:** Initial A8 candidates failed TypeScript because the installed `react-katex` typings do not expose the attempted `settings` prop (`33354076408`, `33354167418`). After correcting the component typing, run `33354287602` passed A8, TypeScript, lint, all other regressions and the production build but correctly failed the final gate because the legacy V19.1 smoke test still asserted the retired `katex.renderToString` implementation; that regression was updated to assert the safe InlineMath/BlockMath behavior. Rapid intermediate corrective pushes also caused normal concurrency cancellations and were not treated as verification failures.
- **Deployment/health:** Production runtime error/fatal logs were checked for the preceding 24 hours and returned no entries. Permanent production was not changed. The latest automatic branch preview visible during verification was READY on an earlier A8 corrective commit; no production promotion was attempted because final real-school acceptance remains incomplete.
- **Next action:** A9 — add an explicit active-institution selector for staff accounts with more than one active organization membership, then verify all institution-scoped application flows consume the selected organization explicitly.

## 2026-08-31 09:57:41 IST — A9 Explicit active institution selection

- **Checklist item:** A9 — Explicit active institution selector for multi-organization staff accounts.
- **Run start:** 2026-08-31 09:57:41 IST.
- **Implementation start (first relevant commit):** 2026-08-31 10:01:49 IST — `6dcd059d2a98e627f671da0838ddb4a167da17fe` (`feat(a9): track explicit active institution in auth context`).
- **Implementation end (final functional/release-gate commit):** 2026-08-31 10:09:13 IST — `280f1816139699ed6613bb1bb58af7f1f752d0a8` (`ci(a9): enforce active institution regression in release gate`).
- **Observable elapsed engineering span:** 7m 24s from first to final relevant functional commit.
- **Verification:** GitHub Actions release-gate run `33357842874`, job 2026-08-31 10:09:36–10:11:16 IST, duration 1m 40s — **PASS**. The dedicated 15-point A9 active-institution regression, TypeScript, lint, every required regression suite, production build and final release-gate enforcement all passed.
- **Implementation result:** Auth now loads all active organization memberships and requires a visible explicit choice when staff belong to multiple institutions instead of silently taking the first membership. The choice is stored per signed-in user, revalidated against current memberships each session, can be switched visibly, and is propagated to same-origin Evidara APIs. School-platform and institution-analytics server routes independently validate the selected organization against active membership and reject ambiguous no-selection access with 409 or invalid cross-school selection with 403. Single-institution staff retain safe automatic selection.
- **Rework/failures:** No functional or CI verification failure occurred on the final A9 candidate. Rapid sequential commits caused expected GitHub concurrency cancellations of superseded runs. Vercel refused the latest automatic branch preview because the account hit its preview build-rate limit; this was an environment/quota condition rather than a code/build failure. Earlier A9 branch previews were READY, and the exact final candidate independently passed the repository production build in the complete GitHub release gate.
- **Deployment/health:** Production runtime error/fatal logs for the preceding 24 hours were clean. Permanent production was not changed or promoted; final real-school acceptance and remaining Phase 1 gates are still incomplete.
- **Next action:** A10 — scope every local autosave key by organization ID and ensure local drafts are cleared or safely scoped on logout/publish so one institution cannot inherit another institution's browser draft state.

## 2026-08-31 11:01:58 IST — A10 Local autosave tenant isolation (in progress)

- **Checklist item:** A10 — Local autosave/draft keys are tenant-scoped and cleared on logout/publish.
- **Run start:** 2026-08-31 11:01:58 IST.
- **Repository/CI/deployment inspection:** `phase1-hardening` remained at the latest verified A9 checkpoint before this log entry; production runtime error/fatal logs for the preceding 24 hours were clean, so no production incident work was required. Permanent production remains protected.
- **Implementation discovery:** The paper builder still derives `draftBase` from only user ID and workspace kind (`evidara-v8-paper:<user>:<kind>`), then appends paper/new ID. It removes the new-draft key after first persistence and removes the current key on publish, but the key does not contain `organizationId`; therefore a browser draft can collide across institutions for the same staff account. Auth sign-out clears session/profile/membership state but does not explicitly purge local paper drafts.
- **Verification status:** Not yet eligible for checklist completion. No functional A10 candidate has passed the complete release gate in this run.
- **Rework/failures:** None. The item is intentionally left unchecked rather than claiming isolation from existing publish cleanup alone.
- **Next action:** Change the paper draft namespace to include the validated active organization (or an explicit platform sentinel for Super Admin), purge/migrate unsafe legacy keys, clear the signed-in user's Evidara paper drafts on logout, add an A10 regression covering cross-school collision/logout/publish cleanup, and only then update the release checklist after the complete gate passes.
