# Evidara Implementation Tracker

**Started:** 7 August 2026  
**Current approved scope:** Phase 1 — Replace demo screens with live product truth  
**Status legend:** `[ ]` not started, `[-]` in progress, `[x]` complete, `[!]` blocked or requires a separate approval

## Scope guardrails

- [x] Read `docs/EVIDARA_CURRENT_STATE_AUDIT.md` and use its Phase 1 definition as the scope boundary.
- [x] Do not deploy.
- [x] Do not access or alter production Supabase data.
- [x] Do not expose or copy secret values into source, logs, documentation, or responses.
- [x] Preserve working question-bank, paper-builder, live-exam, analytics, commerce, entitlement, and authentication behavior.
- [x] Make small, independently reviewable increments rather than replacing every dashboard in one change set.
- [x] Use migration files for any schema or RPC changes; do not run schema SQL manually against production.
- [x] Phase 0's `profiles` role-escalation finding now has a database-layer source correction and automated authorization coverage.
- [!] The correction has not been applied to production or any remote Supabase project. Production must still be treated as vulnerable until the new migration is applied through the approved deployment process and the SQL authorization suite passes in an isolated non-production database.
- [ ] Do not mark Phase 1 complete until every production-visible demo screen is live, removed, or explicitly labelled as demo/sandbox.

## Phase 0 Security Blocker — Profile Authorization

**Scope:** Profile role-escalation security only  
**Source status:** Database-layer correction complete  
**Environment status:** Not applied or runtime-verified against any Supabase environment

### Investigation checklist

- [x] Reconstructed the effective `profiles` table from the complete historical SQL sequence.
- [x] Confirmed effective columns: `id`, `full_name`, `phone`, `role`, `avatar_url`, `created_at`, `updated_at`, and `username`.
- [x] Inspected every authored RLS policy affecting `profiles`.
- [x] Confirmed `profiles_select_own_or_admin` permits own-row or Super Admin reads.
- [x] Confirmed the historical `profiles_update_own_or_admin` policy permits an authenticated owner to update any column in their row, including `role`.
- [x] Inspected profile creation and role-changing functions: `handle_new_user`, all effective `create_school` definitions, `assign_evidara_role`, `assign_evidara_role_by_email`, `assign_evidara_school_role_by_email`, and the role-audit trigger/function.
- [x] Inspected all runtime profile writes in the Next.js routes and maintenance scripts.
- [x] Confirmed the browser application currently reads profiles but has no direct personal-profile update form.
- [x] Confirmed the Access Control API directly changed `profiles.role` with the service client before this correction.
- [x] Confirmed school student invitation and demo bootstrap paths also included profile role values in service-client upserts.
- [x] Confirmed public `create_school` changed a student caller to legacy `institute_owner`, which the application normalizes to `school_admin`.
- [x] Confirmed organization scope, organization ownership/membership, module permissions, and student-school membership are stored outside `profiles`; the broad profile policy did not directly expose those tables, but changing `profiles.role` unlocked role-based authorization throughout the application.
- [x] Approved ordinary self-edit fields: `full_name`, `phone`, `avatar_url`, and `username`.
- [x] Classified `id`, `role`, `created_at`, and `updated_at` as protected identity/authorization/system fields.

### Vulnerability and root cause

- **Vulnerability:** An authenticated user could submit an update against their own `profiles` row and set `role` to `school_teacher`, `school_admin`, `evidara_admin`, or `super_admin`. A second self-escalation path existed in `create_school`, which changed the caller to `institute_owner`/application-level `school_admin` without administrative approval.
- **Root cause:** The historical RLS policy enforced row ownership only. PostgreSQL RLS does not restrict columns, and the authenticated role retained broad table-level `UPDATE`. The public school-registration RPC also combined registration with immediate global-role and active-owner assignment.
- **Impact:** Because Next.js APIs and workspaces use `profiles.role` for authorization, changing this field could unlock platform or school administrative behavior. Frontend route checks could not mitigate the database flaw.

### Migration created

- [x] `supabase/migrations/20260807111613_secure_profiles_authorization.sql`
- [x] Historical SQL files were not edited, replayed, renamed, or restructured.
- [x] Broad `UPDATE` privileges are revoked from `PUBLIC`, `anon`, and `authenticated`.
- [x] Authenticated users receive column-specific `UPDATE` only for `full_name`, `phone`, `avatar_url`, and `username`.
- [x] The broad update policy is replaced with `profiles_update_own_personal_fields`, which permits only own-row updates.
- [x] `guard_profiles_client_role_change_v13` independently rejects direct `anon`/`authenticated` role changes if a future migration accidentally broadens column grants.
- [x] `assign_evidara_role_for_actor_v13` is executable only by `service_role`, revalidates that the human actor is currently `super_admin`, validates the target role, and supplies the human actor/source to the role-audit trigger.
- [x] `audit_evidara_profile_role_change` continues to record old/new role values and now records the authenticated Super Admin for Access Control API changes.
- [x] `create_school` now creates a pending registration and inactive prospective-owner membership without changing the caller's profile role.

### Security behavior before and after

| Behavior | Before | After migration |
|---|---|---|
| User edits own personal fields | Allowed through broad profile update | Allowed only for the four approved columns |
| User changes own `role` directly | Allowed by authored policy/grants | Denied by column privilege and role-change trigger |
| User changes another profile | Denied by RLS except broad Super Admin policy | Denied for authenticated clients; policy is strictly self-row-only |
| Student registers a school | Immediately became active owner/legacy school admin | Registration remains pending; profile role unchanged and owner membership inactive |
| Access Control role change | Direct service-client table update | Service-only RPC, current-Super-Admin recheck, actor-attributed audit |
| School student invitation | Service upsert forced target role to `student` | Profile name is updated/created without overwriting an existing role |
| Demo bootstrap role assignment | Service upsert wrote role directly before RPCs | Profile upsert omits role; existing authorized role RPCs perform assignment |

### Files changed

- `supabase/migrations/20260807111613_secure_profiles_authorization.sql`
- `supabase/tests/profile_authorization_rls.sql`
- `src/app/api/access-control/route.ts`
- `src/app/api/school-platform/route.ts`
- `src/components/InstituteRegistrationForm.tsx`
- `scripts/bootstrap-sales-demo.mjs`
- `scripts/profile-authorization-smoke.mjs`
- `package.json`
- `docs/EVIDARA_IMPLEMENTATION_TRACKER.md`

### Authorization tests created

- [x] Student cannot directly become `school_teacher`.
- [x] Student cannot directly become `school_admin`.
- [x] Student cannot directly become `evidara_admin`.
- [x] Student cannot directly become `super_admin`.
- [x] School Teacher cannot promote themselves.
- [x] School Admin cannot promote themselves to a platform role.
- [x] A normal user cannot alter another user's profile.
- [x] Approved personal fields remain editable on the user's own profile.
- [x] A normal user cannot invoke the checked role-assignment RPC successfully.
- [x] An authenticated Super Admin can still use the existing checked role RPC and produces an audit row.
- [x] The Access Control service-only RPC revalidates the Super Admin actor and produces an actor-attributed audit row.
- [x] School registration no longer changes a student role and leaves prospective ownership inactive.
- [x] `authenticated` has no execute privilege on the service-only API role RPC; `service_role` does.

### Tests performed and results

- [x] `npm run qa:profile-authz` — passed 25/25 safe source-contract and required-case coverage checks.
- [x] `npm run typecheck -- --incremental false` — passed with no TypeScript errors.
- [x] `npm run lint` — passed with 0 errors and the same 8 pre-existing warnings recorded in the audit.
- [x] `npm run build` — passed with Next.js 16.2.10; 54/54 pages generated.
- [x] `npm run qa:smoke` — passed 12/12 current V13.2 deployment checks.
- [x] `npm run qa:analytics` — passed 45/45 current V13.2 analytics checks.
- [!] `node scripts/v7-smoke.mjs` — historical checker failed 9 obsolete V7.1.1 version/file-layout assertions; unrelated to this change.
- [!] `node scripts/v12-smoke.mjs` — 90 checks passed and 11 obsolete V12 version/retired-feature assertions failed; unrelated to this change.
- [!] `supabase/tests/profile_authorization_rls.sql` was not executed because this workspace has no Supabase CLI, Docker, `psql`, or local PostgreSQL service. It was not pointed at a remote or production database.

### Remaining limitations and release decision

- [!] No production data was accessed or changed, and the migration was not applied to any database.
- [!] The repository did not contain `supabase/migrations/` or Supabase CLI tooling before this task. Because no CLI was installed and package installation was avoided, the timestamped migration directory/file was created locally without running `supabase migration new`.
- [!] The source correction uses independent PostgreSQL privileges, RLS, and a trigger rather than UI checks; however, the deployment environment remains vulnerable until the migration is applied.
- [!] Before treating the blocker as operationally resolved, apply the migration to an isolated non-production Supabase database and run `supabase/tests/profile_authorization_rls.sql` successfully, then promote the same migration through the approved deployment process.
- [!] Phase 1 Increment 2 must not be deployed ahead of this migration. Local Increment 2 development may resume only if the source-fixed/environment-pending distinction is retained and no release is attempted.

## Phase 1 outcome

Every visible dashboard must use authorized live data or an honest loading, error, empty, or unavailable state. Authentication recovery must return users to a working password-update flow. No screen may represent hard-coded or synthetic values as the signed-in user's real data.

## Increment 1 — Authentication recovery and live student results

This is the first approved, reviewable implementation slice.

### Authentication recovery

- [x] Inspect password-reset request, callback, session-recovery event handling, and password-update form.
- [x] Change reset-email redirect to the actual `/reset-password` route.
- [x] Preserve PKCE/callback behavior for ordinary sign-in and other auth callbacks.
- [x] Ensure the reset page handles missing/expired recovery sessions with an honest recovery action.
- [x] Ensure successful password update gives a clear next step and does not expose auth tokens.
- [x] Confirm authentication errors are user-readable without leaking internal values.

### Student results

- [x] Inspect the existing live result RPC/client contract and current demo `StudentResultsView`.
- [x] Replace hard-coded result cards/table with the existing authorized current-user result source.
- [x] Add explicit loading, error, empty, and success states.
- [x] Do not fall back to demo or synthetic attempts when the student has no results.
- [x] Retain the current Evidara visual language and workspace navigation contract.
- [x] Ensure the student can refresh/retry a failed result request.
- [x] Keep all result reads scoped to the authenticated user through the existing RLS/RPC contract.

### Increment 1 verification

- [x] Run lint and fix errors introduced by this increment.
- [x] Run TypeScript checks and fix errors introduced by this increment.
- [x] Run a production build and fix errors introduced by this increment.
- [x] Review the final diff/file list for accidental secrets or out-of-scope changes.
- [x] Record verification evidence and changed files in this tracker.

## Increment 2 — Live student dashboard and resources

- [x] Define the smallest authorized student dashboard read model from existing attempts, entitlements, purchases, and analytics.
- [x] If a new database function is required, create it as a timestamped migration file and document its grants/RLS behavior.
- [x] Replace `src/data/demo-data.ts` dashboard values with live data.
- [x] Show an onboarding/empty state when no attempts exist; never substitute benchmark/demo students.
- [x] Reconnect student resources to institution-published resources already supported by the school-platform domain.
- [x] Enforce current-user and active-membership scope for resource reads.
- [x] Add loading, error, empty, and retry states to dashboard/resources.
- [x] Verify desktop and narrow-width rendering for the changed screens without expanding into the Phase 2 navigation redesign.
- [x] Run lint, TypeScript checks, and a production build.

## Increment 3 — Post-test completion truth

- [x] Inspect the `LiveExam` submit/result transition and existing post-test self-classification RPC/component.
- [x] Connect `src/components/evidara/post-test-error-classification.tsx` only after the authoritative submit RPC succeeds.
- [x] Preserve successful submission if classification is skipped, paused, retried, unavailable, or fails.
- [x] Prevent classification from changing marks or authoritative answer data through the existing isolated reflection-table RPC contract.
- [x] Remove any production synthetic analytics fallback from the real-student path while retaining explicitly labelled isolated benchmark SQL for test use.
- [x] Add honest no-data states for analytics overview, topic confidence, recommendations, and question intelligence.
- [x] Run lint, TypeScript checks, a production build, required existing smoke checks, and the new Increment 3 focused smoke check.

## Increment 4 — Live institution student lifecycle

- [x] Compare active `SchoolStudentsView` with `src/components/school/StudentLifecycleManager.tsx` and the `/api/school-platform` contract.
- [x] Reuse the existing live lifecycle behavior rather than duplicating it.
- [x] Preserve invitations, roster updates, promotion, revocation, and active-membership rules.
- [x] Replace the active hard-coded school roster with live authorized data.
- [x] Add loading, error, empty, retry, and permission-denied states.
- [x] Ensure teachers see only their permitted student/section scope.
- [x] Avoid broadening `profiles` RLS to solve display-name lookup; use a scoped server DTO/RPC if necessary.
- [x] Create a migration file for the required scoped roster and checked lifecycle functions.
- [x] Run lint, TypeScript checks, a production build, existing smoke suites, and the focused Increment 4 smoke suite.

## Increment 5 — Live institution resources and subscription

- [ ] Compare active demo views with `ResourceLibrary.tsx` and `SubscriptionCenter.tsx`.
- [ ] Reconnect authorized resource publishing/listing to the active workspace.
- [ ] Reconnect subscription state, plan, dates, seats, and status to live data.
- [ ] Keep commerce entitlement and seat-assignment behavior unchanged.
- [ ] Ensure teacher and institution-admin actions differ according to current permissions.
- [ ] Add loading, error, empty, retry, and permission-denied states.
- [ ] Remove legacy ScholarOS labels from the reconnected screens only where they are encountered in this scope.
- [ ] Run lint, TypeScript checks, and a production build.

## Increment 6 — Live institution dashboard

- [ ] Define an authorized institution dashboard snapshot from existing organization, membership, test, paper, question, subscription, and analytics data.
- [ ] Create a timestamped migration for a database function/view if needed.
- [ ] Ensure any view uses `security_invoker = true` or remains in a non-exposed/private schema.
- [ ] Restrict the snapshot by active membership, organization, role, and teacher section assignment.
- [ ] Replace hard-coded institution summary metrics and activity.
- [ ] Include data freshness and honest no-data states.
- [ ] Do not report fake uptime/system health in an institution dashboard.
- [ ] Run lint, TypeScript checks, and a production build.

## Increment 7 — Live platform command center and subscriptions

- [ ] Inventory reusable live commerce/analytics/readiness sources, including `AdminLiveStats` and product analytics.
- [ ] Define a minimal, authorized platform dashboard read model.
- [ ] Create a timestamped migration for any new aggregate function/view.
- [ ] Restrict the endpoint to current platform-admin roles while leaving the Phase 4 role redesign out of scope.
- [ ] Replace hard-coded institution/user/test/revenue/uptime values.
- [ ] Replace demo subscription/revenue rows and charts with live records or an honest unavailable state.
- [ ] Surface data freshness and partial-source failures rather than claiming all systems are operational.
- [ ] Keep detailed readiness behind authenticated platform administration.
- [ ] Run lint, TypeScript checks, and a production build.

## Increment 8 — Phase 1 consolidation

- [ ] Search active App Router imports for remaining production-visible `demo`, `mock`, hard-coded revenue, hard-coded school counts, synthetic fallback, and fake system-status values.
- [ ] Remove `src/data/demo-data.ts` from production imports; retain it only for an explicitly isolated demo/test mode or delete it when unused.
- [ ] Confirm that no active production screen silently falls back to synthetic analytics.
- [ ] Confirm all changed screens have loading, error, empty, success, and permission-denied behavior where applicable.
- [ ] Confirm every new database object is delivered only through migration files.
- [ ] Confirm no existing working question, paper, exam, commerce, analytics, or entitlement flow regressed.
- [ ] Run full lint, TypeScript, production build, and existing Phase 1-relevant smoke checks.
- [ ] Record final Phase 1 changed files, migrations, verification evidence, known limitations, and deferred Phase 2+ work.

## Expected files by Phase 1 area

### Authentication recovery

- `src/components/evidara/login-page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/auth/callback/page.tsx`
- `src/context/AuthProvider.tsx` only if recovery-event handling requires it

### Student truth

- `src/components/evidara/student-dashboard.tsx`
- `src/components/evidara/student-views.tsx`
- `src/components/evidara/live-student-tests.tsx`
- `src/components/papers/LiveExam.tsx`
- `src/components/evidara/post-test-error-classification.tsx`
- `src/components/analytics-v12/student-analytics-v12.tsx`
- `src/app/student/tests/take/page.tsx`
- `src/data/demo-data.ts`

### Institution truth

- `src/components/evidara/school-views.tsx`
- `src/components/school/StudentLifecycleManager.tsx`
- `src/components/school/ResourceLibrary.tsx`
- `src/components/school/SubscriptionCenter.tsx`
- `src/components/school/useSchoolPlatform.ts`
- `src/lib/schoolPlatform.ts`
- `src/app/api/school-platform/route.ts`
- `src/components/institution-analytics/institution-analytics-workspace.tsx`

### Platform truth

- `src/components/evidara/admin-views.tsx`
- `src/components/commerce/AdminLiveStats.tsx`
- `src/components/commerce/ProductAnalyticsDashboard.tsx`
- `src/app/api/admin/readiness/route.ts`
- `src/components/readiness/SystemReadinessDashboard.tsx`

### Potential Phase 1 migrations/endpoints

- `supabase/migrations/<generated_timestamp>_authorized_dashboard_snapshots.sql`
- `supabase/migrations/<generated_timestamp>_scoped_student_directory.sql`
- `src/app/api/dashboard/student/route.ts`
- `src/app/api/dashboard/institution/route.ts`
- `src/app/api/dashboard/platform/route.ts`

These files are possibilities, not authorization to add unnecessary layers. Existing secure RPCs/APIs should be reused before creating new database objects.

## Change log

### 7 August 2026 — Tracker initialization

- [x] Created this tracker before editing application code.
- [x] Increment 1 selected as the first small, reviewable Phase 1 slice.
- [x] Application files changed:
  - `src/components/evidara/login-page.tsx`
  - `src/app/reset-password/page.tsx`
  - `src/components/evidara/student-views.tsx`
- [x] Documentation file changed: `docs/EVIDARA_IMPLEMENTATION_TRACKER.md`.
- [x] Database migrations added: none; Increment 1 reused existing PKCE auth and `list_my_attempt_results()` contracts.
- [x] Deployment performed: no.

### 7 August 2026 — Increment 1 complete

- [x] Password-reset emails now redirect to `/reset-password/`.
- [x] The reset page verifies that an authenticated recovery session exists before allowing an update.
- [x] Invalid, expired, unavailable, updating, and successful recovery states are explicit.
- [x] Raw recovery tokens and Supabase error details are not rendered.
- [x] The active student Results view no longer imports `demoResults`.
- [x] Submitted results load from `list_my_attempt_results()`, whose existing function filters by `student_id = auth.uid()`.
- [x] Live results include submitted time, score, percentage, answer accuracy, question counts, elapsed time, and configured result mode.
- [x] Loading, error, no-results, success, refresh, and cloud-unavailable states are explicit.
- [x] No production Supabase data or authentication email was accessed during implementation.
- [x] The required production build regenerated `.next/**`; these are generated artifacts, not manually edited source files.
- [x] Increment 2 and all later Phase 1 increments remain unstarted.

### 7 August 2026 — Increment 2 complete

#### Files changed

- [x] Application and data-access files:
  - `src/components/evidara/student-dashboard.tsx`
  - `src/components/evidara/student-views.tsx`
  - `src/components/school/ResourceLibrary.tsx`
  - `src/components/school/useSchoolPlatform.ts`
  - `src/app/api/school-platform/route.ts`
- [x] Database migration:
  - `supabase/migrations/20260807120348_secure_student_resource_access.sql`
- [x] Verification and package files:
  - `scripts/student-live-dashboard-resources-smoke.mjs`
  - `package.json`
- [x] Documentation:
  - `docs/EVIDARA_IMPLEMENTATION_TRACKER.md`
- [x] Generated `.next/**` files were produced by the required builds only and are not manual source changes.

#### Database and live contracts

- [x] Migration added: `20260807120348_secure_student_resource_access.sql`.
- [x] The migration was required because the historical `resources_metadata_read` policy exposed all columns, including `content_url`, on every active `academic_resources` row to any authenticated client.
- [x] The migration removes broad authenticated table SELECT, makes `student_can_access_resource(uuid, uuid)` internal-only, rejects arbitrary-student checks, and retains authenticated access through the self-scoped `list_my_eligible_resources()` contract.
- [x] Existing RPCs reused for the dashboard:
  - `list_available_papers()` — published, open, entitlement/organization-authorized papers with current-user attempt usage.
  - `list_my_attempt_results()` — attempts filtered by `student_id = auth.uid()`.
  - `list_my_entitlements_v12()` — current-user entitlements and active student seat assignments only.
- [x] Existing API reused for resources: authenticated `GET /api/school-platform/`.
- [x] New API endpoints or RPC names added: none. The migration hardens two existing resource functions rather than introducing a parallel resource architecture.
- [x] No migration was applied to production or any remote Supabase project, and no production data was accessed.

#### Demo/synthetic data removed

- [x] The active student Dashboard no longer imports `demoStudent`, `demoStudentStats`, `demoStudentTrend`, `demoTests`, or `demoResults`.
- [x] Removed synthetic readiness, percentile, segment, hard-coded counts, fabricated trend, fake result percentiles, and fabricated revision recommendations from the active dashboard.
- [x] The active student Resources view no longer imports or renders `demoResources`.
- [x] Student resource mode explicitly disables the school hook's local demo fallback; unavailable cloud data produces an honest error/retry state.

#### Dashboard metrics now shown

- [x] Available startable tests from the existing eligible-paper RPC.
- [x] Submitted-test count from real submitted attempts.
- [x] Average performance only when submitted results exist.
- [x] Score/answer-accuracy trend only after at least two real submitted attempts.
- [x] Recent submitted results with score, percentage, counts, and submitted time.
- [x] Active individual or school-seat product entitlements, expiry, and remaining attempt allowance where the contract provides it.
- [x] Strongest subjects, weak areas, rank, percentile, streaks, readiness, and recommendations are intentionally absent because this increment has no reliable authorized contract for those claims.

#### Student resource authorization path

- [x] The browser sends the current Supabase bearer session to the existing school-platform API.
- [x] A client-supplied `organizationId` is honored only for a platform admin; ordinary students cannot choose organization scope.
- [x] Student fallback organization lookup now requires `student_id = auth.uid()` and `status = active`, ordered deterministically by academic year/update time.
- [x] The student snapshot requires the current user's active membership and returns a permission error when none exists.
- [x] Resources are filtered server-side by membership status, grade, board, assigned track, and active institution subscription before `contentUrl` is serialized.
- [x] The migration prevents authenticated clients from bypassing the API/RPC eligibility path with a direct `academic_resources` SELECT or another student's id.
- [x] `profiles` RLS was not broadened and teacher/admin-only profile or roster fields were not added to the student DTO.

#### UX and responsive verification

- [x] Dashboard and Resources include honest loading, partial-error/unavailable, empty, and retry/refresh behavior.
- [x] No-attempt onboarding explains the next useful actions without substituting demo evidence.
- [x] Resource URLs accept only HTTP(S) or same-origin relative links before rendering an Open action.
- [x] At 1440×900, Dashboard and Resources rendered without horizontal overflow or framework error overlays.
- [x] At 390×844, Dashboard and Resources rendered without horizontal overflow; these two student views use the sidebar's existing 68 px collapsed state rather than redesigning authenticated navigation.

#### Increment 2 limitations and next gate

- [!] The resource migration has source/static verification only. This workspace has no Supabase CLI or isolated local database, so it must be applied and exercised in an isolated non-production Supabase environment before release.
- [!] The existing `academic_resources` model has no `organization_id`. It supports centrally published resources authorized through a student's institution membership/subscription, but it cannot prove that a resource was authored by that individual institution. Institution-owned publishing remains a Phase 1 Increment 5 design concern; this increment does not invent ownership metadata.
- [x] Increment 2 deferred the separate student-analytics benchmark fallback; Increment 3 has now removed that fallback from the real-student path.
- [!] The overall authenticated navigation is still scheduled for the later navigation phase. Increment 2 only invokes its existing collapsed mode on the two changed narrow-width student screens.
- [!] Phase 0 and Increment 2 migrations remain unapplied. Nothing in this source increment is authorized for deployment until both receive isolated database verification and the approved migration workflow.
- [x] Phase 1 Increment 3 is safe to begin as local source work. It is not safe to deploy Increment 2 or later work yet.

### 7 August 2026 — Increment 3 complete in source

#### Files changed

- [x] Application files:
  - `src/components/papers/LiveExam.tsx`
  - `src/components/evidara/post-test-error-classification.tsx`
  - `src/components/evidara/student-views.tsx`
  - `src/components/analytics-v12/student-analytics-v12.tsx`
  - `src/components/analytics-v12/analytics-v12.css`
- [x] Database authorization test:
  - `supabase/tests/post_test_reflection_authorization.sql`
- [x] Verification and package files:
  - `scripts/phase1-increment3-smoke.mjs`
  - `scripts/v13-2-analytics-smoke.mjs`
  - `scripts/institution-analytics-smoke.mjs`
  - `package.json`
- [x] Documentation:
  - `docs/EVIDARA_IMPLEMENTATION_TRACKER.md`
- [x] Generated `.next/**` files were produced by the required build only and are not manual source changes.

#### Database migrations and contracts

- [x] New migration added: none. The existing database contract already supplies the required independent authorization and idempotency, so a duplicate database function was not introduced.
- [x] Existing RPCs reused:
  - `submit_exam_attempt(uuid)` — finalizes authoritative answers, marks, score, counts, and submitted status before any reflection UI can render.
  - `list_post_test_reflection_queue_v13(uuid)` — accepts the attempt identifier but independently requires `student_id = auth.uid()` and `status = submitted` inside its `SECURITY DEFINER` function.
  - `save_exam_response_reflection_v13(uuid, smallint, student_error_classification, text)` — derives the attempt from the response, independently requires the authenticated owner and submitted status, validates enum/confidence values, and upserts on unique `response_id`.
  - `list_my_attempt_results()` — continues to supply the live Results history and result-mode metadata scoped to `auth.uid()`.
  - `get_student_analytics_v12(...)` and `get_topic_reflection_analytics_v13(...)` — continue to supply authorized live aggregate evidence.
- [x] New RPC/API/function names added: none.
- [x] Reflection writes remain confined to `exam_response_self_classifications`; neither reflection RPC updates `exam_attempts`, `exam_responses`, answers, correctness, marks, or scores.
- [x] No migration was applied, no remote Supabase project was contacted, and no production data was read or changed.

#### Exact submission-to-classification flow

1. The student starts an authorized attempt through the existing exam-start contract.
2. Answers continue to save through `save_exam_response(...)` while the attempt is in progress.
3. `LiveExam` calls `submit_exam_attempt(...)`; submission errors retain the exam state and never open reflection.
4. On success, the returned authoritative score, percentage, correct, incorrect, and unanswered counts are committed to result state first.
5. The result summary and Results navigation render independently of reflection.
6. The optional reflection component then requests the authorized submitted-attempt queue. The student may save, skip an item, finish for now, retry a load/save, or navigate away without changing the result.
7. Previously saved rows are loaded from the same queue, prefilled, and resumed at the first incomplete item; saves use the existing unique-response upsert.
8. The live Results view provides a per-attempt `Continue reflection` action for safe later resumption.

#### Analytics truth changes

- [x] Removed the active component's embedded `demoPayload()` and the no-Supabase demo-student path.
- [x] Removed the automatic `get_v13_benchmark_analytics(...)` call that replaced a real student's zero-evidence response with Benchmark Student 5000.
- [x] The isolated benchmark schema/bridge remains present and explicitly labelled `demo_mode` for deliberate test usage; it is no longer called from the real-student analytics component.
- [x] Zero completed tests now show `Not enough data yet` rather than zero-valued performance cards, a synthetic percentile, benchmark cohort, trend, readiness, or recommendation.
- [x] Removed hard-coded 10/15/1-question practice prescriptions. Topic practice appears only from an existing evidence-backed priority; otherwise the UI asks for more tests.
- [x] Topic reflection copy distinguishes recorded classifications from unavailable data and states that mistake reasons are never inferred.
- [x] Question Intelligence continues to show only live topic aggregates and explicitly withholds question rows because the current authorized data contract does not provide them; no synthetic question rows or statuses are substituted.

#### Authorization verification

- [x] Focused static checks confirm attempt ownership, submitted status, enum typing, confidence constraints, unique-response upsert, and reflection-only writes in the existing V13 SQL.
- [x] `supabase/tests/post_test_reflection_authorization.sql` transactionally covers another student's response/attempt denial, unsubmitted-attempt denial, invalid classification rejection, idempotent retry, safe resume, and immutable attempt score/response answer.
- [!] The SQL test was created but not executed because this workspace has no Supabase CLI, `supabase/config.toml`, or isolated local database. It must be run against a disposable non-production Supabase environment before release.

#### Browser and responsive results

- [x] The in-app browser used a local Next.js dev preview with Supabase environment values forced to non-secret placeholders, so no remote/production database could be contacted.
- [x] At 1440×900, the result/reflection state rendered at 860 px maximum width with no horizontal overflow or framework overlay; the full action row remained reachable by normal vertical scrolling.
- [x] At 390×844, the result cards collapsed to two columns, confidence/reason choices collapsed to one column, and Skip/Finish/Save actions remained full-width and reachable. Document width equalled viewport client width, with no horizontal overflow.
- [x] The real local homepage and test route loaded meaningful content with no browser console errors or Next.js error overlay under the no-cloud configuration.
- [!] An authenticated end-to-end submission was intentionally not performed because that requires a non-production Supabase project with fixture users/attempts. The changed submitted state was visually checked with a temporary local-only fixture using the app's compiled CSS; the fixture was removed immediately after verification.

#### Increment 3 limitations and next gate

- [!] Never-visited questions without an `exam_responses` row are not returned by the historical reflection queue. This increment does not override the authoritative submit function or synthesize response records merely to fill the queue.
- [!] Question-level intelligence rows remain unavailable until an authorized backend contract returns real response-level details. Aggregate topic evidence remains live; the UI states this limitation instead of fabricating rows.
- [!] Phase 0 and Increment 2 migrations, plus the new reflection SQL authorization test, still require isolated non-production database execution before any deployment.
- [x] Phase 1 Increment 4 is safe to begin as local source work. Increment 3 is not authorized for deployment, and Increment 4 work must remain within its approved institution-student-lifecycle scope.

### 7 August 2026 — Increment 4 complete in source

#### 1. Files changed

- [x] Application and data-contract files:
  - `src/app/api/school-platform/route.ts`
  - `src/components/evidara/school-views.tsx`
  - `src/components/school/StudentLifecycleManager.tsx`
  - `src/components/school/useSchoolPlatform.ts`
  - `src/lib/schoolPlatform.ts`
- [x] Database migration and isolated authorization test:
  - `supabase/migrations/20260807150537_secure_institution_student_lifecycle.sql`
  - `supabase/tests/institution_student_lifecycle_authorization.sql`
- [x] Verification and package files:
  - `scripts/phase1-increment4-smoke.mjs`
  - `package.json`
- [x] Documentation:
  - `docs/EVIDARA_IMPLEMENTATION_TRACKER.md`
- [x] Generated `.next/**` output came only from the required production build and is not a manual source change.

#### 2. Demo and hard-coded roster data removed

- [x] The routed `SchoolStudentsView` no longer reads `demoSchoolStudents`; it renders the live `StudentLifecycleManager`.
- [x] The active manager explicitly sets `allowDemo: false`. Failed or unavailable cloud reads cannot substitute demonstration students.
- [x] Removed active fake roster counts, scores, assessment counts, segments, search results, promotions, and revocations. The live roster shows only total, active, invited/pending, revoked, and completed counts derived from the authorized response.
- [x] Demonstration students still used by separate out-of-scope segmentation views were not represented as lifecycle records or removed as part of this increment.

#### 3. Existing lifecycle behavior reused

- [x] Reused `student_school_memberships`, `academic_sections`, `teacher_section_assignments`, `student_promotion_events`, and `student_promotion_blocks` rather than adding a parallel roster model.
- [x] Reused the historical promotion/revocation rules through checked V13 wrappers, preserving grade advancement, academic-year transition, permanent revocation locks, promotion events, and active-membership semantics.
- [x] Reused `lookup_auth_user_by_email_v12`, Supabase Admin invitation, the existing `/api/school-platform` endpoint, `useSchoolPlatform`, and the existing institution workspace navigation.
- [x] Student membership is authorized before the safe `full_name` profile upsert, preventing a rejected cross-role or permanently blocked membership request from first changing that profile name.

#### 4. New scoped DTO, RPC, and API behavior

- [x] No second API endpoint was added. `/api/school-platform` now derives staff scope from active `organization_members` membership and calls the authenticated scoped database functions.
- [x] New RPCs:
  - `list_school_student_lifecycle_v13(uuid)`
  - `add_school_student_membership_v13(uuid, uuid, text, smallint, text, text, text[], text, text)`
  - `update_school_student_tracks_v13(uuid, text[])`
  - `school_roster_promote_student_v13(uuid, text)`
  - `school_roster_revoke_student_v13(uuid, text)`
  - `school_roster_promote_all_v13(uuid, text, text)`
  - `school_roster_revoke_all_v13(uuid, text, text)`
- [x] The roster DTO returns lifecycle identifiers and approved display/lifecycle metadata only. It does not serialize student user UUIDs, email addresses, profile roles, permission fields, auth metadata, or profile security timestamps.
- [x] Invitation state is reduced to an explicit lifecycle label. Parent name/phone are returned only to authorized institution/platform managers and are stripped from teacher responses.

#### 5. Roles allowed and denied

- [x] Active organization `owner` and `admin` members can read and manage their complete own-organization roster.
- [x] `evidara_admin` and `super_admin` can manage an explicitly selected organization through the existing platform-admin path.
- [x] Active `teacher` members can read only students whose normalized section is actively assigned to that teacher. Teacher roster access is read-only.
- [x] Students, inactive staff memberships, unassigned teachers, arbitrary organization identifiers, and cross-organization membership identifiers are denied.
- [x] Direct authenticated membership `INSERT`, `UPDATE`, and `DELETE` privileges are revoked. Checked manager RPCs are the lifecycle mutation boundary.
- [x] Authenticated execution was revoked from the legacy teacher-permissive lifecycle RPCs. New RPCs are granted only to `authenticated`, with authorization revalidated inside each function.

#### 6. Institution scoping

- [x] School staff do not choose their organization in the browser. The API derives it from the actor's active organization membership; only existing platform administrators may supply an organization identifier.
- [x] The roster function uses `auth.uid()`, resolves an active staff membership, validates the organization, and rejects arbitrary or cross-organization scope.
- [x] Every lifecycle mutation loads the target membership and independently verifies that the caller is a strict manager of the same organization before changing state.

#### 7. Teacher section scoping

- [x] Teacher visibility requires all three conditions: an active organization staff membership, an active `teacher_section_assignments` row, and a student membership linked to that exact normalized `academic_sections` row.
- [x] Updated membership and promotion-event read policies use the same active-assignment boundary; teachers no longer receive the organization-wide roster through the former broad staff path.
- [x] The UI clearly labels teacher access as assigned-section and read-only, and hides invitation, track-edit, promotion, revocation, and bulk lifecycle controls.

#### 8. Membership, section, and profile lookup behavior

- [x] New student membership resolves section name inside the authorized organization, grade, and academic year; the client cannot inject a section UUID from another organization.
- [x] Manager reads include active, revoked, and completed lifecycle records so the institution can administer historical status honestly. Teacher reads remain assignment-scoped.
- [x] Display names are selected inside the scoped `SECURITY DEFINER` roster DTO. `profiles` RLS was not broadened and the browser/API does not perform an unrestricted profile directory read.
- [x] Track updates accept only the existing supported track allowlist and generate an audit log row.

#### 9. Migration created

- [x] `supabase/migrations/20260807150537_secure_institution_student_lifecycle.sql`
- [x] The migration uses fixed empty `search_path` values, schema-qualified objects, `auth.uid()`, explicit organization/section checks, least-privilege execution grants, tightened membership/event RLS, and strict manager-only mutation wrappers.
- [x] No historical SQL file was replayed, renamed, restructured, or edited. The migration was not applied to production or any remote database.

#### 10. Tests created

- [x] `supabase/tests/institution_student_lifecycle_authorization.sql` creates disposable transaction-scoped fixtures and rolls them back.
- [x] It covers: School Admin complete own-organization roster; cross-organization denial; no organization-wide teacher roster; assigned-section teacher read; student denial; inactive-teacher denial; arbitrary-organization denial; cross-organization membership-ID mutation denial; and omission of privileged/unrelated profile and auth fields.
- [x] Additional assertions cover teacher mutation denial, teacher parent-data omission, membership RLS scope, manager track mutation and audit logging, legacy-RPC execute revocation, anonymous execute denial, and direct authenticated membership-DML revocation.
- [x] `scripts/phase1-increment4-smoke.mjs` supplies 36 safe source-contract checks and is exposed as `npm run qa:increment4`.

#### 11. Verification results

- [x] `npm run typecheck -- --incremental false` — passed with no TypeScript errors.
- [x] `npm run lint` — passed with 0 errors and 6 pre-existing warnings in unrelated files.
- [x] `npm run build` — passed with Next.js 16.2.10; 54/54 pages generated and route traces completed.
- [x] `npm run qa:smoke` — 12/12 checks passed.
- [x] `npm run qa:analytics` — 47/47 checks passed.
- [x] `npm run qa:profile-authz` — 25/25 checks passed.
- [x] `npm run qa:student-live` — 22/22 checks passed.
- [x] `npm run qa:increment3` — 29/29 checks passed.
- [x] `npm run qa:increment4` — 36/36 checks passed.
- [x] Local browser verification at 1440×900 and 390×844 found no body/document horizontal overflow in the populated roster, no browser console errors, and reachable mobile filters/cards/actions. The existing sidebar collapsed to its current icon rail without a navigation redesign. Permanent bulk revocation displayed an explicit confirmation dialog.

#### 12. Remaining limitations

- [!] `supabase/tests/institution_student_lifecycle_authorization.sql` was not executed because the workspace has no Supabase CLI, `supabase/config.toml`, or isolated local PostgreSQL/Supabase database. It was not pointed at production or any remote project.
- [!] The migration and its checked RPCs must be applied together with the application change in an isolated non-production environment before release; otherwise the live roster correctly reports an unavailable database contract.
- [!] No real invitation email, organization membership, student profile, or lifecycle row was read or changed during verification. Populated UI states were checked with a temporary local-only demo fixture, which was removed before the final test suite.
- [!] Phase 0, Increment 2, and Increment 4 migrations and all pending SQL authorization suites still require successful isolated non-production execution before any deployment approval.
- [!] Separate demo-backed institution segmentation/analytics views remain later-increment work. This increment changes only the active institution student-lifecycle route.

#### 13. Increment 5 gate

- [x] Phase 1 Increment 5 is safe to begin as local source work only. Increment 4 is complete in source and all runnable checks pass.
- [!] Increment 4 is not approved for deployment. Increment 5 must remain within live institution resources/subscription scope, and no deployment is safe until the pending migrations and SQL authorization tests pass in an isolated non-production environment.

## Verification log

### Increment 1

- [x] `npm run typecheck -- --incremental false` — passed with no TypeScript errors.
- [x] `npm run lint` — passed with 0 errors and the same 8 pre-existing warnings recorded in the audit.
- [x] `npm run build` — passed with Next.js 16.2.10; 54/54 static pages generated and route traces completed.
- [x] `npm run qa:smoke` — 12/12 Vercel configuration checks passed.
- [x] `npm run qa:analytics` — 45/45 analytics checks passed.

### Increment 1 limitations

- [!] An end-to-end recovery email was not requested because this implementation did not access production authentication data or email infrastructure. The flow was verified statically, by TypeScript/lint, and by the production build.
- [!] The existing result RPC returns its existing `result_mode` field but does not provide answer-review details or an explicit release timestamp. This increment does not invent either behavior; any result-release contract change must be delivered in a later migration-backed Phase 1 increment.

### Increment 2

- [x] `npm run typecheck -- --incremental false` — passed with no TypeScript errors.
- [x] `npm run lint` — passed with 0 errors and the same 8 pre-existing warnings in untouched files.
- [x] `npm run build` — passed with Next.js 16.2.10; 54/54 static pages generated and route traces completed.
- [x] `npm run qa:smoke` — 12/12 Vercel configuration checks passed.
- [x] `npm run qa:analytics` — 45/45 existing analytics checks passed.
- [x] `npm run qa:profile-authz` — 25/25 Phase 0 authorization smoke checks passed.
- [x] `npm run qa:student-live` — 22/22 focused dashboard/resource and authorization checks passed.
- [x] Local-only browser verification — Dashboard and Resources passed at 1440×900 and 390×844 with no horizontal overflow, console errors, or framework overlays. Supabase values were replaced with non-secret placeholders for this check, so the browser could not contact a remote project.

### Increment 2 limitations

- [!] Database SQL was not executed because no isolated local Supabase database or CLI is present, and production access was prohibited.
- [!] Live-session results, entitlements, memberships, and resource rows were not read during verification. Runtime behavior with real records must be tested in a non-production environment after the migrations are applied.

### Increment 3

- [x] `npm run typecheck -- --incremental false` — passed with no TypeScript errors.
- [x] `npm run lint` — passed with 0 errors. After removing two stale suppressions exposed by this increment, only 6 pre-existing warnings remain in unrelated files.
- [x] `npm run build` — passed with Next.js 16.2.10; 54/54 static pages generated and route traces completed.
- [x] `npm run qa:smoke` — 12/12 Vercel configuration checks passed.
- [x] `npm run qa:analytics` — 47/47 analytics checks passed, including real-student benchmark-fallback removal.
- [x] `npm run qa:profile-authz` — 25/25 Phase 0 authorization smoke checks passed.
- [x] `npm run qa:student-live` — 22/22 Increment 2 dashboard/resource checks passed.
- [x] `npm run qa:increment3` — 29/29 focused submission, reflection, authorization-contract, immutability, resume, and analytics-truth checks passed.
- [!] `supabase/tests/post_test_reflection_authorization.sql` — created but unexecuted; no isolated local Supabase runtime is available and production execution is prohibited.

## 7 August 2026 — Phase 1 Increments 5–8 consolidated local build

- [x] Increment 5: active institution Resources now uses the live ResourceLibrary with fail-closed cloud access.
- [x] Increment 5: active Subscription view now uses live SubscriptionCenter data; demo renewal, fake price, and ScholarOS renewal branding were removed.
- [x] Increment 5: added `20260807182000_scope_academic_resources.sql` to distinguish `platform` resources from `organization` resources; historical unowned resources remain platform resources rather than receiving guessed ownership.
- [x] Increment 5: institution managers can add URL-backed organization resources and deactivate only resources owned by their own institution through the existing authenticated school-platform API.
- [x] Increment 5: student resource authorization now includes platform-or-own-organization scope in the database predicate.
- [x] Increment 6: active institution dashboard now uses authorized live school-platform data for institution identity, active students, seats, subscription, resources, and sections. Fake assessment/revenue/activity values are omitted rather than invented.
- [x] Increment 7: added authenticated `/api/admin/platform-overview` restricted to current platform-admin roles.
- [x] Increment 7: command-center counts and verified paid-order revenue now load from live sources; hard-coded uptime and “all systems operational” claims were removed.
- [x] Increment 7: admin subscription list now uses real school subscription rows and live active-seat counts. Revenue is not falsely attributed to individual subscription rows.
- [x] Increment 8: active root no longer imports the legacy demo-heavy student views module; live Results/Resources are isolated in `student-live-views.tsx`.
- [x] Increment 8: removed unreferenced `src/data/demo-data.ts`, `src/data/demoProducts.ts`, `src/lib/demoAchievements.ts`, and `src/types/demo-cohorts.ts`.
- [x] Increment 8: removed obsolete public `deployment-check` / `setup-check` pages and old `SetupBanner` / V6.8 `qa-smoke.mjs` residue.
- [x] Focused TypeScript transpile/syntax verification passed for all files changed in Increments 5–8.
- [x] `qa:student-live` passed 22/22 after the fail-closed resource change.
- [x] `qa:increment3` passed 29/29.
- [x] `qa:increment4` passed 36/36.
- [x] New `qa:increment5-8` passed 18/18.
- [!] Full `npm ci`, lint, typecheck, and Next production build could not be rerun in this Chat sandbox because the configured package mirror returned HTTP 404 for `zwitch@2.0.4`. No dependency/version changes were made. Run the normal verification BAT on the user's Windows source where dependencies are available.
- [!] SQL authorization suites remain unexecuted. All pending migrations must be applied and tested in an isolated non-production Supabase environment before deployment.
- [!] No production/remote Supabase data was accessed and no deployment was performed.

## Post-Phase-1 — Public student commerce and referrals (7 August 2026)

- [x] Public homepage rewritten around truthful student + school journeys; removed invented school-count and hard-coded school-pricing claims.
- [x] Public `/products/` store retained as the direct student acquisition surface.
- [x] Google OAuth return flow preserves the requested store destination.
- [x] Independent Google users continue to default to the existing `student` role; institution membership remains optional.
- [x] Referral links (`?ref=CODE`) persist through sign-in and are claimed before a student's first paid individual purchase.
- [x] Added one-time referral attribution, self-referral prevention and a server-side qualifying-order rule.
- [x] Current referral program: first paid individual order >= ₹1,000; referrer + referred student each earn ₹100 Evidara credit.
- [x] Added student Refer & Earn workspace with referral link, credit balance, earned credit and referral counts.
- [x] Added Evidara credit checkout reservations. Credit is reserved for 30 minutes and debited only after the order becomes paid.
- [x] Credit cannot reduce a Razorpay payable order below ₹1.
- [x] Updated live `create-razorpay-order` Edge Function (version 6) to support optional Evidara credit.
- [x] Hardened `evidara_batch004_staging` with RLS and removed authenticated/anonymous direct privileges.
- [x] Removed RPC execution exposure from the auth trigger helper.
- [x] Removed anonymous execution from legacy admin commerce RPCs while preserving authenticated admin UI access.
- [x] Disabled superseded legacy direct role-assignment RPCs for normal authenticated clients; current V13 actor-audited role path remains authoritative.
- [x] Source QA: Phase 1 5–8 18/18; profile auth 25/25; student live 22/22; Increment 3 29/29; Increment 4 36/36; V13.2 deploy 12/12; analytics 47/47; public-student 18/18.
- [!] Full fresh `npm ci`/Next build could not run in the Chat sandbox because its internal npm mirror returns 404 for `zwitch@2.0.4`; run `VERIFY_EVIDARA.bat` on the Windows project before publishing source changes.
- [!] Supabase advisors still report historical SECURITY DEFINER and legacy-function warnings outside the public-commerce scope. They were not mass-revoked because some may be active internal/academic workflows and require call-site-by-call-site review.
