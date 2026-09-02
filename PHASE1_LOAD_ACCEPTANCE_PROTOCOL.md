# Evidara Phase 1 — Load Acceptance Protocol

Status: execution-ready protocol for checklist L1–L6. This document does **not** by itself satisfy any L item.

## Acceptance rule

Load acceptance must run against a dedicated non-production acceptance tenant/environment that matches the release candidate closely enough to exercise the real application/database paths. Synthetic data is expected for scale testing; production student data must not be copied into the load tenant.

No L item receives a checkmark until its target dataset/workload has actually run, measurements are captured, correctness checks pass, and the complete Phase 1 release gate remains green on the exact release candidate.

Permanent production remains protected until R1–R18, L1–L6 and production sign-off are complete.

## Hard safety controls

Before any load command:

- Record the exact `phase1-hardening` SHA and matching READY preview/acceptance deployment.
- Confirm the complete Phase 1 release gate is green on that candidate or a docs-only descendant of the exact green functional tree.
- Use a dedicated acceptance institution and synthetic identities only.
- Require an explicit `EVIDARA_LOAD_ACCEPTANCE=YES_I_UNDERSTAND_NON_PRODUCTION_ONLY` acknowledgement.
- Refuse known permanent production hosts/domains and refuse a target URL that cannot be positively identified as preview/acceptance.
- Never embed service-role keys, passwords, access tokens or student data in repository files, workflow logs or screenshots.
- Keep concurrency generators bounded and abort on sustained error growth rather than continuing to overload a failing dependency.
- Capture server/database health before, during and after the run.
- Delete or archive synthetic load tenants according to the Phase 1 retention policy after sign-off.

## Evidence bundle

Store raw load output outside the public repository when it contains identifiers or credentials. Repository-safe evidence may contain only aggregate measurements and hashes/references.

Suggested bundle:

- `00-load-manifest.md` — date, SHA, deployment ID, Supabase project/ref, dataset seed/version, operators.
- `01-dataset-summary.json` — exact L1–L3 row counts, generation seed and integrity hashes.
- `02-search-results.md` — L2 search latency/response-size/correctness samples.
- `03-start-load.json` — L4 aggregate timings/errors/correctness.
- `04-save-load.json` — L5 aggregate timings/errors/idempotency/conflict evidence.
- `05-submit-load.json` — L6 aggregate timings/errors/receipt/idempotency evidence.
- `06-db-observability.md` — connection/CPU/latency/lock/error evidence available from Supabase/Vercel.
- `load-acceptance-results.csv` — item, pass/fail, evidence reference, timestamp, notes.

## Global measurements

For every workload capture at minimum:

- attempted operations;
- successful operations;
- rejected/failed operations by category;
- p50, p95 and p99 end-to-end latency;
- maximum observed latency;
- HTTP/RPC status distribution where applicable;
- duplicate/idempotency anomalies;
- database/API/runtime errors during the window;
- recovery state after the workload ends.

A run is invalid if the harness itself drops results, silently retries without accounting, or cannot distinguish intended authorization rejection from infrastructure/application failure.

## L1 — 2,000 students/institution test dataset

Target: one dedicated acceptance institution with **2,000 synthetic student memberships/accounts** representing realistic programme/grade/section distribution.

Pass criteria:

- Exactly 2,000 active synthetic students belong to the acceptance institution.
- Licence configuration intentionally permits 2,000 seats; no seat bypass is used.
- No duplicate student membership/account identifiers are created.
- Student list/search/pagination does not require downloading all 2,000 rows into the browser before first useful render.
- Server/database counts equal generated/imported counts.

Evidence: deterministic dataset manifest + database-side exact count + representative paginated response measurement.

## L2 — 50,000 questions/institution searchable without full-browser load

Target: **50,000 synthetic questions** owned by the acceptance institution, distributed across multiple subjects/chapters/topics/difficulties/statuses.

Pass criteria:

- Database-side exact question count is 50,000 for the load tenant.
- Search/filter/pagination uses bounded server/database requests; the UI does not fetch all 50,000 rows into browser memory.
- Representative searches include broad text, exact taxonomy, subject/chapter/topic, difficulty and status combinations.
- Search correctness is verified against known deterministic fixture markers.
- p95 search latency and response size remain operationally acceptable for the intended school workflow; any threshold used for sign-off is recorded before the final run rather than chosen after results are known.

Evidence: exact count, query/response-size samples, p50/p95/p99 latency and known-result correctness checks.

## L3 — 1,000 papers dataset

Target: **1,000 synthetic papers** in the acceptance institution, with realistic states and bounded question counts.

Pass criteria:

- Database-side exact paper count is 1,000 for the load tenant.
- Paper listing/search/pagination is bounded and remains responsive.
- Opening one paper does not cause unrelated paper/question datasets to be fully downloaded.
- Existing draft/published/assignment authorization remains intact at scale.

Evidence: exact count, list/search measurements and representative paper-open network/database summary.

## L4 — 500 near-concurrent test starts

Target: **500 near-concurrent start attempts** using distinct synthetic students assigned to the same load-test paper/window unless the scenario deliberately partitions cohorts.

Workload shape:

- Ramp from 0 to 500 virtual students over a short recorded interval (for example 20–60 seconds), then stop creating new starts.
- Each synthetic student uses its own valid identity/session; do not share one privileged token across students.
- A small controlled retry subset intentionally repeats the start request to verify authoritative idempotency.

Pass criteria:

- Exactly one authoritative active attempt exists per successfully started student.
- Duplicate/retry requests do not create duplicate attempts.
- Authorization/licence/audience rules remain enforced.
- No sustained production-like 5xx/error surge occurs in the acceptance deployment.
- Database/API remain healthy after the ramp and recover to baseline.
- Latency/error measurements are captured and reviewed against a predeclared operational threshold.

Evidence: start workload summary, authoritative attempt count, duplicate-count query, Vercel/Supabase health evidence.

## L5 — 500 concurrent answer-save patterns

Target: **500 concurrent student answer-save streams** against active load-test attempts.

Workload shape:

- Use a realistic mixture of first answer, changed answer, rapid repeated save, numeric/text where supported, and delayed retry after an intentionally simulated network failure.
- Maintain a deterministic expected final answer per synthetic student/question so authoritative read-back can be compared after load.
- Do not treat client acknowledgement as correctness; verify persisted authoritative state.

Pass criteria:

- Final authoritative responses match the deterministic expected state for every sampled/verified attempt.
- Retry/idempotency behavior does not duplicate or corrupt responses.
- Stale/conflicting saves follow the defined server contract rather than silently overwriting newer confirmed state.
- Submission remains blocked where required while saves are unresolved.
- Error/latency metrics are captured and database/runtime health returns to baseline.

Evidence: workload summary, deterministic expected-vs-authoritative verification, anomaly count and runtime/database health.

## L6 — 500 submissions in finishing window

Target: **500 near-concurrent final submissions** from valid active attempts, concentrated in a realistic finishing window.

Workload shape:

- Prepare attempts/answers before the submission ramp so L6 measures finalization/scoring pressure rather than setup work.
- Ramp final submissions over a short recorded finishing interval.
- Retry a controlled subset after successful receipt to verify idempotent authoritative submission behavior.

Pass criteria:

- Every successful attempt has one authoritative submission/scoring outcome and durable receipt.
- Retried submissions return the same authoritative outcome rather than double-scoring or duplicating finalization.
- No response evidence is lost between final save and submission.
- Aggregate result counts equal authoritative submitted-attempt counts.
- Analytics/result visibility remains consistent with release mode.
- Runtime/database health returns to baseline after the finishing window.

Evidence: submission workload summary, receipt/idempotency checks, authoritative submitted count, result count and Vercel/Supabase health.

## Failure handling

If any L item fails:

1. Stop increasing load.
2. Preserve aggregate evidence and exact candidate SHA.
3. Classify the failure as harness, application, database, dependency, quota/plan or configuration.
4. Repair the root cause without weakening tenant/auth/licence/scoring guarantees.
5. Add/extend a permanent regression where the failure is reproducible as code/data-contract behavior.
6. Re-run the complete Phase 1 release gate.
7. Recreate or reset the affected synthetic acceptance data if correctness may have been contaminated.
8. Re-run the failed L item from the beginning; do not carry a partial pass forward.

## Completion matrix

| Item | Result | Evidence reference | Dataset/workload ID | Timestamp | Notes |
|---|---|---|---|---|---|
| L1 | Pending | | | | |
| L2 | Pending | | | | |
| L3 | Pending | | | | |
| L4 | Pending | | | | |
| L5 | Pending | | | | |
| L6 | Pending | | | | |

## Post-load release rule

After L6 passes, re-run the **complete** Phase 1 release gate on the exact candidate SHA. Any code or migration fix discovered during load acceptance invalidates earlier final-candidate evidence until the full gate is green again. Only then proceed to production sign-off Z2–Z8; do not promote production merely because the load suite passed.
