# Evidara Current-State Audit

**Audit date:** 7 August 2026  
**Project snapshot:** Evidara v13.2.0 local workspace  
**Audit type:** read-only source, configuration, migration, and static-quality review

## 1. Executive verdict

Evidara is a substantial, working application foundation rather than an empty prototype. It already has a strong question-bank and paper-building domain model, authenticated Supabase-backed APIs, student test delivery, analytics engines, Razorpay purchase flows, product entitlements, organization membership, and Cloudflare R2 uploads. The local TypeScript and lint checks pass, and the previous Next.js production build artifacts are present.

It is **not ready for a public production launch in its current state**. The immediate blocker is an authorization flaw in the authored database policy for `profiles`: an authenticated user can update their own profile row and, because the policy does not protect individual columns, can change their own `role`. If the migration is applied as authored, that permits self-promotion to `super_admin`. This must be fixed and independently tested before any other release work.

The second major issue is product truthfulness. The current workspace combines live data-backed modules with hard-coded demo dashboards and does not consistently label the demo data. The student dashboard, student results, student resources, school dashboard, school students, school subscription, admin command center, and admin subscription reporting are not all live even though adjacent modules are. The marketing homepage also contains placeholder links, unverified customer claims, hard-coded pricing, and capabilities that are retired, future, or not fully wired.

The recommended direction is to retain the current Next.js App Router, Supabase, R2, question-bank, paper-builder, exam, analytics, and commerce foundations, while redesigning authorization, workspace routing, dashboard data sources, parent access, mobile navigation, migration management, storage governance, and the public website. Referral functionality does not currently exist and should be introduced only after payment, refund, role, and ledger controls are hardened.

### Release classification

| Area | Current classification | Reason |
|---|---|---|
| Build/type safety | Mostly healthy | TypeScript passes; lint passes with warnings; fresh build was not run during this no-modification audit |
| Authentication | Implemented but incomplete | Supabase PKCE sessions work; recovery redirect and server-side route protection need correction |
| Authorization | **Critical blocker** | A user can potentially change their own role through the `profiles` update policy |
| Question bank and papers | Strong foundation | Rich live functionality with review, import, taxonomy, paper construction, and exam delivery |
| Dashboards | Mixed/live-demo hybrid | Several visible screens use hard-coded data while others are live |
| Payments | Good foundation, needs operational hardening | Razorpay verification, webhook idempotency, entitlements, vouchers, and seats exist; refunds and strict origin controls do not |
| Supabase migrations | Broad schema, weak lifecycle discipline | 70 ordered SQL files exist outside the standard timestamped migration structure; live applied state was not inspected |
| R2 | Implemented, governance incomplete | Server-side signed upload exists; access, validation, audit, deletion, and lifecycle controls are missing |
| Mobile UX | Public pages are better than authenticated app | Active sidebar/layout is desktop-first and unsuitable for narrow screens |
| Deployment | Vercel-ready but operationally manual | Vercel is the effective target; CI/source-control workflow is absent from this workspace |

## 2. Audit scope and limitations

The review covered the application source under `src`, all route handlers and pages, configuration files, package metadata, scripts, public assets, Supabase SQL and Edge Functions, environment-variable names, deployment files, and generated route/build metadata. There are 230 files under `src` and 70 top-level Supabase SQL files in this snapshot.

The following constraints were observed:

- No application code was edited.
- No package was installed or upgraded.
- No database command was run and no production/staging Supabase project was queried.
- No payment provider, R2 bucket, Vercel project, or other production data was accessed.
- No deployment was performed.
- Secret values from `.env.local` were not copied into this report.
- A fresh `next build` was not run because it would write to `.next`, which would violate the no-modification requirement. Existing build artifacts are evidence of an earlier build, not proof that a clean build of this exact snapshot will succeed today.
- The source migrations were analysed as authored. Their presence does not prove that the same policies, tables, functions, or versions are applied to a live database.
- Generated dependencies in `node_modules`, binary build artifacts, and the contents of the backup ZIP were not treated as application source.

## 3. Project and application structure

### Top-level structure

```text
evidara-vercel-ready/
├─ src/
│  ├─ app/                 Next.js App Router pages, layouts, and route handlers
│  ├─ components/          Active Evidara UI plus older/orphaned feature components
│  ├─ config/              Public site configuration
│  ├─ context/             Supabase authentication provider
│  ├─ data/                Demo product, dashboard, and trial data
│  ├─ hooks/               Module access, mobile, and toast hooks
│  ├─ lib/                 Domain clients, imports/exports, roles, Supabase, R2, reports
│  ├─ store/               Client application/workspace state
│  └─ types/               Analytics, question, paper, and commerce types
├─ supabase/
│  ├─ 01_...sql–50_...sql  70 manually ordered schema/hardening/demo SQL files
│  ├─ functions/           Razorpay and readiness Edge Functions
│  └─ .env.functions.example
├─ scripts/                Environment checks, deploy helpers, legacy smoke tests
├─ public/                 Logo/icons, robots.txt, and a Cloudflare-style `_headers`
├─ sample-import/          Question import examples
├─ backups/                Historical archive material
├─ .next/                  Existing generated Next.js build output
├─ .vercel/                Local Vercel project link metadata
├─ next.config.ts
├─ package.json
├─ tsconfig.json
└─ vercel.json
```

### Architectural shape

The effective application is a large client-side workspace mounted by `src/app/page.tsx`. After authentication, it switches between admin, institution, teacher, and student views using client state and a `?view=` query parameter. Many nominal routes such as `/admin`, `/school/students`, and `/student/results` redirect back to that root workspace. The principal exception is the live exam at `/student/tests/take` and the dedicated readiness page at `/admin/readiness`.

This gives the current application two overlapping architectures:

1. The active v13.2 workspace in `src/components/evidara`, which mixes live and demo views.
2. Older route/component modules in `src/components/questions`, `src/components/papers`, and `src/components/school`, several of which contain useful live implementations but are no longer reachable from the App Router.

A static import-reachability review found approximately 64 TypeScript/TSX source files not reachable from the current App Router entries. This is not proof that every one is safe to delete—ambient declarations and future entry points can appear unreachable—but it confirms substantial duplication and retired code.

## 4. Next.js version and router

- `next` is `16.2.10`.
- React and React DOM are `19.2.4`.
- TypeScript is version 5 with `strict: true`, although `noImplicitAny` is explicitly disabled and `skipLibCheck` is enabled.
- The application uses the **App Router** under `src/app`.
- There is no `src/pages` application and generated route metadata identifies the app type as `app`.
- Development and production builds are forced through Webpack in the package scripts.
- `trailingSlash: true` and `images.unoptimized: true` are enabled.

The App Router choice should be retained. The issue is not the router itself; it is that most authenticated functionality has been collapsed into one client route rather than using nested layouts, server-side authorization, route-level loading/error states, and code splitting.

## 5. Pages, routes, and homepage

### Public-facing pages currently present

| Route | Current purpose | Assessment |
|---|---|---|
| `/` | Marketing page when signed out; application workspace when signed in | Functional concept, but oversized client entry and misleading/demo content |
| `/products` | Product storefront | Live commerce foundation |
| `/trial` | Trial test | Exists, but separate from the homepage's stated 14-day onboarding promise |
| `/school/register` | Institution registration | Implemented |
| `/contact` | Contact page | Exists; depends on incomplete site configuration |
| `/privacy`, `/terms`, `/refund-policy` | Legal pages | Structurally present; organization/contact placeholders make them not launch-ready |
| `/data-guide`, `/metric-guide` | Product/data documentation | Public; decide whether these are customer help or internal material |
| `/deployment-check`, `/setup-check` | Configuration diagnostics | Should not be public production pages |
| `/login` | Redirects to the root login view | Redundant route wrapper |
| `/reset-password`, `/auth/callback` | Authentication recovery/callback | Recovery routing is inconsistent and likely incomplete |

### Homepage findings

`src/components/evidara/landing-page.tsx` is a substantial responsive marketing page with a hero, feature sections, school logos/names, pricing, calls to action, and footer. It looks closer to a polished homepage than most of the authenticated workspace.

However:

- “Trusted by 60+ schools across India,” named institutions, prices, and other commercial claims are hard-coded and are not backed by content or configuration in the repository.
- The login messaging mentions proctored exams and achievement certificates while the privacy page describes proctoring as future functionality and the achievement/certificate modules appear retired from the active application.
- The “14-day free trial” call to action leads to login, not a clear trial registration and activation flow.
- Footer About, Blog, Help, Documentation, and social links use `#` placeholders.
- Legal entity and support-phone values in `src/config/site.ts` are explicit production placeholders.
- The support email still uses the legacy ScholarOS identity.
- The configured public website URL points to an old Vercel project URL rather than a final Evidara domain.
- The layout loads Google fonts through manual `<link>` tags instead of the Next.js font system.

The homepage should not be discarded. Its structure and visual direction are worth retaining, but all claims, links, prices, capabilities, legal identity, and CTAs need a verified source of truth.

## 6. Existing dashboards and workspaces

### Student workspace

| View | Data state | Notes |
|---|---|---|
| Dashboard | Demo | Uses `src/data/demo-data.ts`; should not appear as the student's real performance |
| Tests | Live | Fetches available tests and starts attempts through Supabase RPCs |
| Results | Demo | Does not use the existing live attempt-result capability |
| Analytics | Live with synthetic fallback | Strong v12/v13 analytics, but benchmark/demo fallback can appear in real flows |
| Resources | Demo | Hard-coded resources rather than institution-published resources |
| Store | Live | Product catalogue and purchase flow |
| Purchases | Live | Purchase/entitlement history |

### Institution and teacher workspace

| View | Data state | Notes |
|---|---|---|
| Dashboard | Demo | Hard-coded school summary |
| Institution analytics | Live | Role-aware API and analytics workspace |
| Questions/review | Live | School/master scope and review flow |
| Papers | Live | Live catalogue and v8 paper builder |
| Students | Demo in active workspace | A live lifecycle manager exists elsewhere but is unreachable |
| Resources | Demo in active workspace | A live resource library exists elsewhere but is unreachable |
| Store/entitlements/seats | Live | Product access and seat allocation exist |
| Subscription | Demo in active workspace | A Supabase-backed subscription component exists but is unreachable |
| Access control | Live | User role/password/module management API-backed |

Teachers share the institution workspace. Their question and analytics scopes have some role-aware restrictions, but they do not have a dedicated teacher home, class/section workflow, assignment workflow, or clearly bounded navigation experience. Database support for academic sections and teacher assignments exists but is not fully represented in the active UI.

### Platform administration workspace

| View | Data state | Notes |
|---|---|---|
| Command center | Demo | Shows hard-coded statistics and “all systems operational”/uptime claims |
| Analytics | Live | Institution-level analytics API |
| Questions and papers | Live | Master content governance |
| Products and vouchers | Live | Product configuration and voucher management |
| Commerce reporting | Live foundation | Product analytics/reporting components exist |
| Subscriptions/revenue | Demo | Hard-coded subscriptions and revenue chart |
| Accounts/access | Live | Role and password management API |
| Readiness | Live foundation | API plus dedicated readiness page, subject to Edge Function deployment gap |

No visible dashboard should present demo revenue, school totals, performance, or infrastructure status as live. Until a real data source is wired, the screen should either be removed from production navigation or clearly marked as a sandbox.

## 7. Authentication and user roles

### Current implementation

- Supabase browser authentication uses a singleton client, PKCE flow, and persisted sessions.
- `src/context/AuthProvider.tsx` reads the current session and then loads the user's `profiles` row.
- `src/components/evidara/auth-bridge.tsx` maps the database role into the client workspace store.
- Canonical roles in the application are `super_admin`, `evidara_admin`, `school_admin`, `school_teacher`, and `student`.
- Legacy aliases such as `admin`, `platform_admin`, institution-owner variants, teacher/reviewer/invigilator variants are normalized in `src/lib/roles.ts`.
- `ProtectedPage` and the root view router perform client-side gating.
- Sensitive Next.js route handlers generally revalidate a bearer token with Supabase and then create a service-role client only after role/organization checks.

### Problems

1. **Critical database authorization flaw:** `01_version_1_schema.sql` allows an authenticated user to update their own entire `profiles` row. The `USING`/`WITH CHECK` expressions preserve row ownership but do not prevent changing the `role` column. Later role migrations expand roles without replacing this policy or restricting column-level updates.
2. Client route guards are useful for presentation but are not a secure authorization boundary. There is no Next.js Proxy/middleware or centralized server-only data-access layer protecting workspace routes.
3. Module-access settings currently hide navigation/modules in the client. The database helper `evidara_module_enabled` is defined but is not used by the application or policies, so disabling a module is not equivalent to revoking its data/action permissions.
4. Password reset initiated from the login page redirects to `/`, while the actual password-update form lives at `/reset-password`. The recovery experience is likely to return users to the wrong screen.
5. “Remember me” is cosmetic; Supabase session persistence is not changed by it.
6. Super-admin can set a temporary password directly. There is no forced change, explicit session revocation, short expiry, or guaranteed secure notification path.
7. Profile-loading errors are not surfaced robustly. A missing or inaccessible profile can result in an ambiguous application state.
8. There is no MFA requirement for super-admin or other high-privilege users.

## 8. Functionality by user type

### Super-admin and platform admin

Implemented capabilities include master questions, master papers, taxonomy and assessment settings, products, versions, vouchers, commerce analytics, cross-institution analytics, account roles, temporary passwords, module settings, and system readiness. The underlying breadth is good.

Incomplete or misleading areas are the command-center metrics, subscription/revenue screens, operational-health claims, absence of a unified audit explorer, no refund/reversal workflow, no referral administration, and no clear separation between a rare break-glass super-admin and a normal platform operator.

### Student

Students can authenticate, discover and enter tests, run a live exam, save responses/events, submit an attempt, consume product entitlements/attempt limits, view analytics, browse products, and view purchases. The central assessment engine is real.

The active dashboard, results screen, and resources screen are demo implementations. A post-test error/self-classification component exists but is not reachable after submission. The question-intelligence migrations are therefore ahead of the active student experience. Achievements and certificates exist in the schema history but are not active product features.

### Teacher

Teachers have a normalized role, institution membership, scoped analytics, and restrictions around drafting/reviewing questions. The current UI treats them mainly as a limited school user. There is no coherent teacher dashboard for assigned sections, students needing intervention, assigned papers, review queue, resource publishing, or upcoming assessments.

### Parent/guardian

There is **no parent role, parent account, parent portal, or guardian-to-student authorization model**. `parent_name` and `parent_phone` are contact fields in student membership data, not authenticated relationships. A parent feature cannot be safely added as a visual-only role; it requires consented, revocable database links between a guardian identity and one or more students.

### Institution

Organization registration, organization membership, student lifecycle, subscriptions, resources, analytics, questions, papers, products, entitlements, seat assignment, and module settings are represented across the code and database. The problem is integration: the active institution workspace uses demo components for several areas while older live Supabase-backed components in `src/components/school` are no longer routed.

The direct browser query in `src/components/commerce/SchoolProductAccess.tsx` also conflicts with the narrow profile RLS policy, so a school administrator may receive seat/membership records without being able to resolve student names. That should be replaced with a scoped RPC or authenticated server endpoint.

## 9. Supabase integration, tables, migrations, and RLS

### Current integration

- Browser client: `src/lib/supabase.ts`.
- Server client: `src/lib/server/supabaseServer.ts`.
- Authentication and most live application data use Supabase.
- Route handlers typically authenticate the user and use the service role on the server for privileged operations.
- Supabase Edge Functions handle Razorpay order creation, payment verification, webhooks, and readiness.

### Schema coverage

The 70 SQL files create a broad domain model, including:

- profiles, organizations, memberships, module settings, and audit logs;
- products, versions, coupons, vouchers, orders, payments, entitlements, webhook events, seats, and attempt usage;
- question taxonomy, questions, options, reviews, versions, imports, collections, and deletion audit;
- papers, sections, paper questions, attempts, responses, events, and post-test classifications;
- school subscriptions, student memberships, resources, promotion/revocation controls, sections, and teacher assignments;
- analytics events, goals, interventions, benchmarks, demo cohorts, and v13 benchmark bridges;
- achievement and certificate tables from retired/unused product work.

The source contains RLS-enabling/policy statements for all 66 detected public tables. The two detected v13 views use `security_invoker = true`, which is the correct direction for making views observe underlying RLS. This is source-level coverage only; the actual deployed policy state was not checked.

### Migration problems

- The SQL files sit directly under `supabase/` with hand-authored sequence prefixes rather than standard `supabase/migrations/<timestamp>_name.sql` files.
- There is no `supabase/config.toml` describing a reproducible local Supabase project.
- The workflow appears to rely on manually running SQL and hotfix scripts. This makes applied-state drift and partial execution more likely.
- `02_make_me_super_admin.sql` contains a manual bootstrap pattern and should not remain in an ordinary deployable migration stream.
- Several migrations create or reset demo cohorts, and `49_v13_2_benchmark_cleanup.sql` contains a hard-coded cleanup target.
- The v13 benchmark bridge can return synthetic benchmark data for a real student with no real attempts. Demo data should not be a production fallback.
- Older functions use `auth.role()` and broad function grants; all `SECURITY DEFINER` ownership, `search_path`, executable roles, and authorization checks need a single review.
- Module flags are not enforced in RLS or server action authorization.
- Historic Supabase Storage policy SQL coexists with the current R2 upload path, producing two asset architectures.

Current Supabase guidance tracks migrations under `supabase/migrations`, tests them through local resets, and records applied migrations in `supabase_migrations.schema_migrations`. The project should move to that model after first reconciling the current source with the actual deployed schema—without applying anything blindly. See [Supabase database migrations](https://supabase.com/docs/guides/deployment/database-migrations).

The current Supabase changelog also matters for the eventual upgrade plan: the project already uses Node 22, satisfying the 2026 client-library minimum, but new public tables will no longer be automatically exposed to the Data API under the upcoming default. Every future table should explicitly opt in or remain in a non-exposed schema by design. See the [Supabase changelog](https://supabase.com/changelog).

## 10. Cloudflare and R2

### What exists

`src/lib/server/r2.ts` implements server-only AWS Signature V4 requests using Node crypto. `src/app/api/question-assets/upload/route.ts` validates an authenticated user/role and uploads question images to R2. Object keys are namespaced by purpose, date, user ID, and a generated UUID. The maximum upload size is 4 MB.

Six R2 variable names are present in `.env.local`, and the local structural R2 environment check passes. Those names are absent from `.env.example`.

### What does not exist

- No Cloudflare Workers/Pages hosting configuration is present.
- No `wrangler.toml`, OpenNext configuration, Cloudflare deployment script, or active Workers runtime exists.
- Vercel is the effective application hosting target.
- `@opennextjs/cloudflare` and `wrangler` are installed but unused.
- The current smoke test explicitly verifies that Cloudflare hosting configuration is absent.

### R2 concerns

- Uploaded asset metadata/ownership is not recorded in a dedicated database table.
- There is no application deletion workflow, orphan cleanup, retention/lifecycle policy, quota, or per-user rate limit.
- MIME validation trusts the client-provided type and does not verify file signatures/content.
- The allowlist includes SVG and several less common formats. Publicly served SVG can carry active content and should be rejected or sanitized.
- A school-staff role is sufficient at the route, without a clear active-membership and module-permission check.
- The public URL architecture may expose all assets permanently; there is no signed/private download path.
- The hand-written signing implementation adds maintenance and testing burden.
- Documentation still mentions optional Supabase Storage even though the current active upload route requires R2.

Cloudflare identifies `r2.dev` URLs as non-production and recommends a custom domain for production access controls, WAF, caching, and bot controls. The final design should use a custom asset domain and disable any parallel `r2.dev` access, or keep the bucket private and issue time-limited access. See [Cloudflare R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/) and [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

## 11. Question bank and testing

### Strong, implemented foundations

- Master and institution question scopes.
- Subjects, chapters, topics, and configurable assessment options.
- Multiple question types, options, scoring, explanations, LaTeX, and images.
- Question status and review workflows.
- CSV/XLSX import, ZIP/image support, validation, and export.
- R2-backed question image upload.
- Paper sections, question selection, marks, negative marking, schedules, statuses, access modes/codes, preview, product linkage, and attempt limits.
- Student test discovery/code entry, attempt start, live response saving, event capture, submit, result calculation, and entitlement consumption.
- Analytics evidence, institution analytics, topic confidence, and self-classification schema.

### Incomplete or disconnected

- The active student results page does not use the live result functions.
- Post-test error classification exists but is not connected to the exam-completion flow.
- Question collections have database and older UI support but are not in the active workspace.
- Achievements, badges, certificates, and benchmark modules are present in migrations/clients but not in the active product.
- Proctoring is limited to event/violation recording; it should not be marketed as a full secure proctoring product.
- Synthetic analytics/demo fallback can contaminate a real user's no-data state.
- The workbook/help copy still describes Supabase Storage while the active path is R2.

## 12. Payments, subscriptions, purchases, and refunds

### Implemented

- Product catalogue and versions.
- Product-to-paper linking.
- Razorpay order creation through an Edge Function.
- Server-side session, product/version, voucher/coupon, and organization checks.
- Payment signature verification plus provider-side payment amount/currency/capture verification.
- Webhook signature validation and idempotent webhook-event storage.
- Entitlement fulfilment, seat assignment, purchase history, and attempt usage.
- Voucher redemption including hardened zero-value/offline access handling.
- Institution subscription data model and older live subscription component.

### Gaps and risks

- The active school subscription and admin subscription dashboards are demo screens.
- There is no complete refund request, approval, provider refund, webhook reconciliation, entitlement reversal, or customer-status workflow despite a public refund policy.
- `APP_ORIGINS` can be empty and the purchase/verification functions then behave fail-open for origins. Production should fail closed.
- The deploy helper uses `--no-verify-jwt` for payment functions and relies on internal verification. That can be valid, but it increases the importance of immutable tests and strict origin/rate controls.
- The readiness Edge Function is present but is not included in the deployment helper.
- Edge Functions import `@supabase/supabase-js@2` without a fully pinned version.
- No rate limiting or abuse controls are evident around purchase creation, voucher attempts, or password/account administration.
- Referral discounts/bonuses do not exist.

## 13. Referral-related code

No referral-code, referral attribution, referral reward, affiliate, commission, or bonus-ledger implementation was found. Matches for “referral” were unrelated browser link attributes such as `noreferrer`.

This is preferable to inheriting a half-built financial subsystem: referrals can be designed cleanly around verified payment and reversal events. They should not be implemented as a coupon-only shortcut or by storing a referrer's code on the user profile.

## 14. Environment variables

### Root web application variables

Documented in `.env.example`:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_TELEMETRY_DISABLED`

Present by name in the local environment but missing from `.env.example`:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_ENDPOINT`
- `R2_PUBLIC_BASE_URL`

### Supabase Edge Function secrets

Represented in `supabase/.env.functions.example` or implicitly supplied by Supabase:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `APP_ORIGINS`

`.gitignore` correctly ignores `.env*` while explicitly retaining safe example files. The workspace itself is not currently recognized as a Git repository, so ignore rules alone are not an operational guarantee. The `.env.example` includes a specific Supabase project URL; it is not a secret, but a generic template or clearly labelled project-specific example would reduce accidental environment coupling.

`/api/health` and `/api/config` report configuration/deployment state publicly and inspect only one service-key variable name. They do not provide a complete or sufficiently private readiness picture. Public responses should be minimal; detailed checks belong behind platform-admin authorization.

## 15. Build, TypeScript, lint, and QA state

Read-only/static checks performed during this audit:

| Check | Result | Interpretation |
|---|---|---|
| `npm run typecheck -- --incremental false` | Pass | No TypeScript errors found without updating incremental state |
| `npm run lint` | Pass with 8 warnings | No lint error, but the rule set is permissive |
| Installed package tree | Pass | No missing/invalid top-level dependency reported |
| Analytics QA script | 45 checks passed | Static/string-presence checks, not runtime or database verification |
| v13.2 smoke script | 12 checks passed | Static/config checks, not an end-to-end test |
| Environment structure check | Pass | Required root variable names are populated locally |
| R2 environment structure check | Pass | Required R2 variable names are populated locally |
| Fresh production build | Not run | It would modify `.next`; a previous full build artifact exists |

Lint warnings include manual custom-font loading, unused lint-disable directives, and unused-expression warnings in taxonomy and institution analytics components.

The lint configuration disables several high-value protections, including broad unused-variable, explicit-`any`, hook dependency, immutability/purity, image, debugger/console, unreachable-code, and undefined-name rules. A green lint result therefore overstates code quality. These rules should be re-enabled gradually after the dead-code and compressed-component cleanup.

The older `scripts/qa-smoke.mjs` targets v6.8 assumptions and is obsolete; the package script no longer calls it. Numerous version-specific smoke and hotfix scripts remain, many of which only assert that strings/files exist.

## 16. Security concerns, prioritized

### Critical

1. **Self-service role escalation in `profiles`.** Replace the update policy and restrict role/organization/security-field changes to audited privileged functions. Do not rely only on the UI/API to prevent this.

### High

2. **Authorization is split between client navigation, API role checks, and RLS with no single policy layer.** Introduce a server-only authorization/DAL module and permission tests; enforce module and membership status on every privileged data/action path.
3. **R2 assets lack ownership/access governance.** Public active-content uploads, weak content validation, and no asset lifecycle create XSS, abuse, privacy, and cost risks.
4. **Database migration state is not reproducible.** Manual sequential SQL plus hotfix/demo scripts creates a high risk of environments having different policies/functions.

### Medium

5. The taxonomy administration API checks role/scope but does not consistently prove that supplied parent taxonomy IDs belong to the same permitted organization scope, allowing cross-tenant relationships if IDs are known.
6. Payment-function origin control is fail-open when `APP_ORIGINS` is empty.
7. Temporary admin-set passwords have no forced rotation/session-revocation workflow.
8. There is no rate-limit/abuse-control layer around administrative actions, uploads, code redemption, or purchase creation.
9. Public setup/config/health pages disclose operational state that should be private or minimized.
10. Security headers omit a Content Security Policy and modern cross-origin isolation/resource policies. `X-Frame-Options` is conditionally applied rather than backed by a consistent CSP `frame-ancestors` rule.
11. Client-only workspace protection allows authenticated UI code and route shells to load before secure data checks. APIs/RLS still protect many data paths, but this is fragile and inefficient.
12. No MFA or step-up verification is required for privileged administration, password resets, payment/refund, or role changes.
13. Direct browser profile queries conflict with intended institution access, encouraging future RLS broadening instead of scoped DTO/RPC design.

### Lower priority but important

14. Public legal/contact placeholders and unverified claims create compliance and trust risk.
15. Dependency versions in Deno/Edge imports are not fully pinned.
16. Manual deployment from a workspace without an active Git repository removes an important audit trail and rollback mechanism.

Supabase's current guidance reinforces that every exposed table needs RLS and only the permissions each Postgres role requires; user-editable metadata should not contain authorization data, and service keys must never be exposed to customers. See [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) and [column-level security](https://supabase.com/docs/guides/database/postgres/column-level-security).

## 17. Unused, duplicated, legacy, and incomplete code

### Likely unused or unreachable groups

- `src/components/AuthForm.tsx`, `PerformanceChart.tsx`, and `StatCard.tsx`.
- `src/components/commerce/AdminLiveStats.tsx`.
- `src/components/evidara/post-test-error-classification.tsx`.
- Much of `src/components/questions/*`, including the older management, collections, importer, editor, and review workspace.
- Older wrappers/pages in `src/components/papers/*` other than the live exam.
- `src/components/school/*`, despite containing live functionality that should be harvested before removal.
- Many generated `src/components/ui/*` controls not imported by the current application.
- `src/data/demoProducts.ts`, retired achievement clients/demo data, benchmark helpers, and older analytics types where no active import exists.

### Duplication and legacy residue

- `src/components/evidara/live-paper-catalogue.tsx` is only a re-export of the v8 implementation.
- Older paper builder/list components wrap or duplicate v8 behavior.
- The active school demo views duplicate older live school-platform components.
- Both Supabase Storage and R2 question-asset architectures appear in code/migrations/documentation.
- ScholarOS branding and support details remain in code and migrations.
- Versioned smoke scripts and hotfix/apply scripts from v7 through v13.2 remain together.
- Backup ZIPs, generated `.next`, `.tsbuildinfo`, local Vercel metadata, historic deployment reports, and installer scripts make this snapshot look like a release bundle rather than a clean source repository.

No dead-code deletion should happen before reachability is confirmed with tests and useful live functionality is ported. In particular, the school lifecycle/subscription/resource components should be used as migration references, not deleted first.

## 18. Mobile responsiveness and user experience

### What is good

- The marketing page and login view include mobile-specific menus/layout adjustments.
- Several data tables have horizontal overflow wrappers.
- Reusable UI controls and a coherent Evidara visual style exist.

### Problems

- The active authenticated `AppSidebar` has fixed 256 px/68 px widths, and the main content always applies a matching left margin. There is no mobile drawer/overlay breakpoint. On a phone, the sidebar can consume most of the viewport.
- The older `DashboardShell` has more responsive behavior but is not the active root shell.
- Many filters and data grids use desktop-first fixed widths/minimum widths.
- A single `/?view=...` workspace weakens deep linking, browser history, route semantics, server rendering, route-level loading/error UX, analytics, accessibility, and code splitting.
- The root client entry imports features for multiple roles, increasing initial JavaScript and hydration work.
- Demo performance/revenue/status data is not consistently labelled, which is a more serious UX issue than styling.
- Empty and no-data states can fall back to synthetic data rather than explaining what the user needs to do next.
- Resource screens expose “publishing soon” behavior rather than a complete workflow.
- Footer placeholder links and mismatched CTA journeys erode trust.
- Raw/unoptimized images and manual font links reduce performance opportunities.
- There is no clear mobile-specific exam/navigation audit, offline/interruption recovery UX, or accessibility verification beyond component defaults.

## 19. Deployment configuration

### Current state

- Vercel is the canonical host: `vercel.json`, `.vercel/project.json`, package deployment scripts, and project documentation all point there.
- Automatic Git deployment is disabled.
- `npm ci` and `npm run build` are configured for Vercel.
- The runtime documentation targets Node 22, which is appropriate for the current Supabase client support window.
- `.vercelignore` excludes local/generated material, documentation, sample imports, and Supabase sources from the web deployment bundle.
- The current workspace is not recognized as a Git repository.
- No CI workflow is present in the deployable snapshot.
- Cloudflare is used only for R2 storage; Cloudflare hosting dependencies are installed but not configured.

### Deployment risks

- Manual deployment without source control/CI reduces repeatability, review, rollback, and evidence of exactly what was released.
- Excluding `supabase/` from Vercel is reasonable for the web bundle, but database and Edge Function releases need their own versioned pipeline.
- R2 variables are absent from `.env.example` and deployment documentation.
- The readiness Edge Function is not deployed by the provided Edge deployment script.
- `.vercel/project.json` links this folder to a specific historic Vercel project name; final organization/project/domain ownership should be confirmed before release.
- `public/_headers` and Cloudflare comments are stale in a Vercel-only hosting model.
- `next.config.ts` includes a certificate verification header rule and trace include for a certificate API that is not present in the current route tree.

## 20. What is already working or well-founded

“Working” here means implemented and statically coherent in this snapshot, not verified against production data.

- Next.js 16 App Router application and public/authenticated page structure.
- Supabase browser/server clients and PKCE authentication foundation.
- Organization, membership, role-normalization, and audit foundations.
- Master/institution question bank, taxonomy, review, import/export, images, and assessment settings.
- Paper builder/catalogue, access codes, attempt limits, and live exam flow.
- Student attempt event/response storage and analytics engines.
- Institution analytics API and UI.
- Product catalogue, Razorpay order/verify/webhook flow, idempotency, entitlements, vouchers, seats, and purchase history.
- R2 server-side upload signing and namespaced object keys.
- System readiness foundation and local environment checks.
- Responsive marketing/login foundation.
- TypeScript check, package integrity check, lint command, and current static smoke scripts complete successfully.
- All detected public tables have RLS statements in the source migrations, and v13 views use security-invoker semantics.

## 21. What is incomplete

- Live data for student dashboard/results/resources.
- Live data for institution dashboard/students/resources/subscription in the active workspace.
- Live data for admin command center and subscriptions/revenue.
- Teacher-specific workflow and dashboard.
- Parent/guardian identity, consent, permissions, and portal.
- Refund lifecycle and entitlement/payment reversal.
- Referral program and bonus architecture.
- R2 asset registry, access policy, validation, deletion, and lifecycle.
- Server-side route/DAL authorization and permission-based access.
- Enforced module permissions beyond navigation hiding.
- Authentication recovery and forced temporary-password change.
- Production legal identity, support details, domain, real pricing, real proof, and complete footer.
- Mobile authenticated navigation.
- Reproducible Supabase local migrations and RLS tests.
- Version-controlled CI/CD for web, database, and Edge Functions.

## 22. What is broken or unsafe

- **The authored profile policy permits role self-escalation.**
- Several production-facing dashboard views display demo data as if it were real.
- The password-recovery redirect and reset page do not form a clear end-to-end recovery flow.
- Module access toggles are not a database/server authorization boundary.
- Student results and resource routes lead to demo views despite live data capabilities elsewhere.
- School student/subscription/resource routes lead to demo views while live components are orphaned.
- Synthetic benchmark fallback can appear in a real student's no-data state.
- Public legal/support configuration is still placeholder/legacy data.
- Public footer links are nonfunctional.
- The active authenticated shell is not viable on narrow mobile screens.
- Public diagnostic routes reveal setup/config state.
- The readiness function exists but is omitted from the function deployment helper.
- R2 accepts public active-content formats without robust content validation/governance.

## 23. What should be retained

- Next.js App Router and TypeScript.
- Supabase Auth/Postgres/RLS/Edge Functions as the primary application platform.
- Centralized role normalization as an interim compatibility layer.
- Question schema, taxonomy, review governance, importer/exporter, and R2 image workflow after hardening.
- v8 paper builder, live catalogue, LiveExam, attempt/entitlement enforcement, and analytics evidence model.
- Razorpay server verification, webhook idempotency, product versions, vouchers, entitlements, and seat-assignment model.
- Institution analytics and student analytics engines, after removing production demo fallback.
- The visual design language and general homepage section structure.
- The older live school lifecycle/subscription/resource logic as a source for reconnecting real data.
- Readiness checks, but only as authenticated operational tooling.

## 24. What should be redesigned

- Authorization: from hard-coded role checks and client hiding to scoped permission assignments, centralized server verification, RLS, and auditable privileged RPCs.
- Authenticated routing: from a single client `?view=` router to nested App Router layouts/routes with server protection and code splitting.
- Dashboards: from mixed demo/live components to explicit live read models and honest empty states.
- Institution/teacher experiences: distinct navigation and task-centered dashboards, backed by membership/section assignments.
- Parent access: a new consented guardian-student relationship model.
- Mobile application shell: drawer/overlay navigation, responsive filters/tables, and exam-specific mobile testing.
- Storage: one canonical R2 architecture with validated files, asset records, controlled delivery, deletion, and lifecycle.
- Migrations: reconcile current database, then use timestamped migrations, local resets, seed/demo separation, and policy tests.
- Operations: separate authenticated readiness/audit views from public health endpoints.
- Public website: claims and pricing from verified configuration/content, working links, clear role journeys, and real trial onboarding.
- Refunds and financial adjustments: ledger/reversal based rather than manual status edits.

## 25. What should be removed or archived

Remove only after replacement and regression verification:

- Unlabelled production demo dashboard data and synthetic production fallbacks.
- `02_make_me_super_admin.sql` from the ordinary migration stream; replace it with a controlled bootstrap/break-glass runbook.
- Demo cohort/reset/benchmark data from production migrations; keep it in development-only seeds or an isolated schema.
- Obsolete versioned smoke/hotfix/apply scripts after their behavior is represented by tests/migrations.
- Duplicate paper/question wrappers and confirmed unreachable UI components.
- Retired achievements/certificates/benchmark product code and tables if the product is definitively abandoned; otherwise move them behind an explicit roadmap flag and preserve data.
- Legacy ScholarOS branding, addresses, emails, comments, and documentation.
- Historic build artifacts/backups from the source repository; store release artifacts elsewhere.
- Unused Cloudflare hosting dependencies and stale Workers comments if Vercel remains canonical.
- Public deployment/setup diagnostic pages and detailed public configuration responses.
- Supabase Storage question-asset policies/documentation after existing objects are inventoried and migrated to the chosen R2 design.
- Placeholder `#` navigation links and unsupported marketing claims.

## 26. Required database changes

### Immediate security migration

1. Drop/replace the broad self-update policy on `profiles`.
2. Revoke authenticated update privileges on `role`, organization/security fields, and any other privileged columns.
3. Expose a narrowly scoped `update_own_profile` RPC or column-specific update privilege for safe fields such as display name/avatar.
4. Add a trigger that rejects role changes unless executed through an authorized audited path; do not trust API/UI checks alone.
5. Ensure only a privileged function/service process can change role assignments and that it writes before/after audit data.
6. Add automated RLS/permission tests proving a student cannot become any admin role or change organization scope.

### Authorization and tenancy

7. Replace a single global `profiles.role` as the long-term authority with scoped assignments, for example `permissions`, `roles`, `role_permissions`, and `user_role_assignments` containing organization scope, status, effective dates, and grantor.
8. Keep `profiles.role` temporarily only as a compatibility projection, then remove it as an editable authority.
9. Enforce active organization membership and module permission in RLS/functions for question, paper, analytics, resource, roster, asset, and commerce actions.
10. Add/verify indexes on every organization/user/status column used by RLS.
11. Add scoped server RPCs/DTOs for institution user directories and seat assignment rather than broad profile reads.
12. Validate taxonomy parent scope in database functions/constraints, not only route code.

### Parent and institution workflows

13. Add `guardian_student_links` with guardian user, student user, relationship, organization, invitation/consent status, granted scopes, created/accepted/revoked timestamps, and audit trail.
14. Add invitation tokens/events without storing reusable plaintext secrets.
15. Enforce that guardians can see only explicitly linked student summaries and never private teacher/admin data.

### Live dashboards and assets

16. Add stable dashboard snapshot RPCs/views for student, institution/teacher, and platform admin, returning only authorized aggregate data.
17. Add `question_assets` (or general `assets`) with owner, organization, purpose, object key, MIME detected by the server, size, checksum, access class, scan status, created/deleted timestamps, and references.
18. Add deletion/orphan-retention jobs and prevent deleting assets still referenced by questions.

### Finance, refunds, and referrals

19. Add refund requests, provider refund events, financial ledger entries, entitlement reversals, and idempotency constraints before advertising a managed refund flow.
20. Add referral tables only as described in section 30; all rewards must be transactionally tied to a qualified payment and reversible on refund/chargeback.

### Migration discipline

21. First pull/compare the real deployed schema in a safe non-production workflow; do not replay the 70 files blindly.
22. Establish `supabase/config.toml`, timestamped `supabase/migrations`, development-only `supabase/seed.sql`, and database policy tests.
23. Explicitly configure Data API exposure for every new table/schema in preparation for Supabase's changed defaults.
24. Move demo cohorts/benchmark data to development seeds or a non-exposed demo schema.

## 27. What the homepage should contain

1. A precise hero: what Evidara does, for whom, and the primary outcome, with separate “For schools” and “For students” paths.
2. A real interactive product preview or short workflow: build/import questions → assemble a paper → run a test → act on analytics.
3. Role-based value sections for institution leaders, teachers, students, and parents only when the parent product exists.
4. Verified capabilities only: question bank, papers/tests, analytics, product access, and institution operations. Do not call event logging “proctoring” or advertise certificates until those features are active.
5. Verified social proof: approved customer names/logos, measured outcomes, and attributed testimonials. Hide the section until proof is approved.
6. Clear pricing or “contact sales” based on the real commercial model, not hard-coded component values.
7. A real trial path with eligibility, duration, what is included, onboarding steps, and a destination that actually creates/activates the trial.
8. Security and privacy summary covering data ownership, tenant isolation, encryption, access controls, and support—without unsupported certifications.
9. Product screenshots using real safe demo data, clearly labelled.
10. FAQ covering setup, imports, supported question types, student access, billing, refunds, and data export.
11. Working contact/demo CTA and complete footer links for product, company, support, legal, status, and social channels.
12. Final legal entity, address, support contacts, canonical domain, metadata/Open Graph, sitemap, and analytics consent behavior.

## 28. What the super-admin dashboard should contain

The daily operational dashboard should be for a `platform_admin`; `super_admin` should be a rare break-glass role protected by MFA/step-up verification.

Recommended modules:

1. **Live overview:** active institutions/users, tests started/submitted, question/paper growth, captured revenue, entitlement issues, failed webhooks, and data freshness timestamps.
2. **Institutions:** lifecycle/status, plan, seats, owners/admins, modules, usage, renewal, support state, and safe impersonation only if explicitly audited and approved.
3. **Users and access:** scoped role assignments, invitations, suspensions, MFA posture, last sign-in, forced resets, and complete audit history.
4. **Content governance:** master question/paper review queues, taxonomy/settings, import errors, duplicate detection, asset quarantine, and publishing history.
5. **Commerce and finance:** products/versions, prices, coupons/vouchers, orders/payments, refunds, disputes, entitlements, invoices/reconciliation exports, and exception queues.
6. **Referrals:** programs, codes, qualified conversions, pending/available/reversed rewards, abuse review, and payouts/credits.
7. **System readiness:** web/database/function/R2/payment health, environment completeness, webhook lag, failed jobs, migration version, release version, and incidents—never hard-coded “operational” claims.
8. **Security and audit:** role changes, password resets, data exports/deletions, suspicious redemption/upload/payment activity, RLS test status, and immutable event search.
9. **Analytics:** platform trends and institution comparisons with privacy thresholds and no synthetic production fallback.
10. **Configuration:** feature/module policies, assessment options, public content/pricing, notification templates, retention policies, and integration settings, all versioned and audited.

## 29. Recommended roles and permissions

Use permissions as the enforcement unit and roles as bundles. Assignments must be scoped to the platform or an organization and may have expiry/status. Avoid proliferating hard-coded role comparisons throughout UI and SQL.

| Role | Scope | Representative permissions |
|---|---|---|
| `super_admin` | Platform, break-glass | All operations; MFA/step-up required; very few accounts |
| `platform_admin` | Platform | Institutions, users, configuration, readiness; no unrestricted secret/database access |
| `platform_support` | Platform | Read support-safe user/institution state, resend invitations, limited resets; no finance/content publishing |
| `platform_finance` | Platform | Orders, payments, refunds, vouchers, payouts, reports; no academic-content or role administration |
| `content_admin` | Platform | Master taxonomy, questions, papers, review/publish/import; no finance or global access control |
| `institution_owner` | One organization | Plan, billing, organization admins, modules, exports, top-level reporting |
| `institution_admin` | One organization | Students, teachers, sections, resources, papers, school question bank, analytics |
| `teacher` | Assigned organization/sections | Assigned students, create drafts/papers, run tests, resources, section analytics |
| `reviewer` | Assigned organization/content scope | Review/approve/reject questions/papers without unrelated roster/billing access |
| `invigilator` | Assigned assessments | Start/monitor assigned tests and record incidents; no content/billing administration |
| `student` | Self | Own tests, responses, results, analytics, purchases, resources, profile-safe fields |
| `parent_guardian` | Explicit linked students | Approved summary/results/attendance-like data and notifications; no raw answers/private notes unless separately granted |

Suggested permission names should be action-oriented, for example `question.create`, `question.review`, `paper.publish`, `assessment.invigilate`, `student.manage`, `analytics.section.read`, `billing.refund`, `role.assign`, and `system.readiness.read`. The UI may use permissions to hide actions, but APIs/functions/RLS must enforce the same permission independently.

## 30. Recommended referral-code and bonus architecture

### Product decision

Start with **non-cash Evidara credit** or a controlled discount reward, not cash payouts. Credits reduce tax/KYC/payout complexity and can be reversed in an internal ledger. Add cash affiliates only after finance and compliance processes exist.

### Core tables

- `referral_programs`: audience, status, start/end, attribution window, qualification event, reward type/value/caps, and version.
- `referral_codes`: program, owner user/organization, normalized unique opaque code, status, usage cap, expiry, and campaign metadata. Codes must not expose emails/phone numbers.
- `referral_sessions` or `referral_clicks`: privacy-minimized attribution token, code, campaign/UTM fields, first/last interaction, and expiry. Avoid raw long-term device fingerprints.
- `referral_attributions`: code, referred user/organization, first/last attribution, status (`pending`, `qualified`, `rejected`, `reversed`), qualification/rejection reason, and a unique program/referred-party constraint.
- `referral_events`: immutable signup, verification, first-paid-order, refund, chargeback, cancellation, and manual-review events with idempotency keys.
- `referral_rewards`: beneficiary, attribution, order/payment, snapshotted rule, reward type, amount in minor currency units/credits, status (`pending`, `approved`, `available`, `reversed`, `paid`), cooling-period date, and idempotency key.
- `credit_ledger`: append-only debit/credit entries and balance projection; never mutate a single bonus balance without a ledger.
- `referral_payouts` and `referral_payout_items`: only if cash payouts are later introduced.
- `referral_abuse_reviews`: rule hits, evidence references, reviewer, decision, and audit timestamps.

### Transaction flow

1. Visitor lands with a referral code; server validates it and stores a short-lived signed attribution token.
2. On account or institution creation, the server creates one attribution according to an explicit first-click/last-click policy.
3. No reward is created for signup alone unless the program explicitly defines a non-financial reward.
4. After Razorpay payment is independently verified and entitlement fulfilment succeeds, the payment webhook/transaction creates a pending reward with the exact rule snapshot and idempotency key.
5. Reward becomes available only after the refund/chargeback cooling period and any minimum net-revenue threshold.
6. Refund, chargeback, voucher cancellation, or fraud decision writes reversing ledger entries; history is never deleted.
7. RLS exposes users only to their own referral summary. Qualification, reward, reversal, and payout writes are server/service-only.

### Abuse controls

- Block self-referral by account, organization, verified contact, payment instrument/provider customer indicators, and other proportionate signals.
- Apply per-code, per-beneficiary, per-referred-party, and time-window caps.
- Require verified identity/contact and a qualified paid event.
- Prevent stacking unless the program explicitly allows it.
- Add manual review thresholds for unusually high velocity/value.
- Log admin adjustments with reason and before/after values.
- Publish program terms, expiry, eligibility, reward timing, reversal rules, and tax treatment.

### Integration points

- Add `referral_attribution_id` and a snapshot/reference on the order/payment fulfilment path rather than deriving rewards later from mutable user fields.
- Extend Razorpay verify/webhook functions and the fulfilment RPC in one transactionally tested change.
- Add a user/institution referral page, a finance exception queue, and a platform referral-program dashboard.

## 31. Recommended implementation order and exact likely files

Paths below are the exact current files most likely to change. Proposed new files are named explicitly; migration timestamps would be generated when implementation begins.

### Phase 0 — Security stop-ship remediation

**Outcome:** remove role escalation, centralize privileged authorization, and prove tenant/RLS isolation before release.

Likely current files:

- `supabase/01_version_1_schema.sql` — historical source correction/documentation only; do not rewrite an already-applied migration without a reconciliation plan.
- `supabase/25_role_access_control.sql`
- `supabase/26_v7_role_compatibility.sql`
- `supabase/44_v12_security_foundation.sql`
- `src/lib/roles.ts`
- `src/lib/accessControl.ts`
- `src/lib/server/supabaseServer.ts`
- `src/app/api/access-control/route.ts`
- `src/app/api/question-assets/upload/route.ts`
- `src/app/api/question-taxonomy/route.ts`
- `src/app/api/questions/review/route.ts`
- `src/app/api/assessment-settings/route.ts`
- `src/app/api/institution-analytics/route.ts`
- `src/app/api/school-platform/route.ts`
- `src/context/AuthProvider.tsx`
- `src/components/ProtectedPage.tsx`

Proposed new files:

- `supabase/config.toml`
- `supabase/migrations/<timestamp>_profiles_role_escalation_fix.sql`
- `supabase/migrations/<timestamp>_authorization_grants_and_function_hardening.sql`
- `supabase/tests/authorization_rls.sql`
- `src/lib/server/authorization.ts`

### Phase 1 — Replace demo screens with live product truth

**Outcome:** every visible dashboard is live or has an honest empty state; authentication recovery works.

Likely current files:

- `src/app/page.tsx`
- `src/components/evidara/student-dashboard.tsx`
- `src/components/evidara/student-views.tsx`
- `src/components/evidara/school-views.tsx`
- `src/components/evidara/admin-views.tsx`
- `src/components/evidara/live-student-tests.tsx`
- `src/components/analytics-v12/student-analytics-v12.tsx`
- `src/components/institution-analytics/institution-analytics-workspace.tsx`
- `src/components/school/StudentLifecycleManager.tsx`
- `src/components/school/ResourceLibrary.tsx`
- `src/components/school/SubscriptionCenter.tsx`
- `src/components/school/useSchoolPlatform.ts`
- `src/lib/schoolPlatform.ts`
- `src/app/api/school-platform/route.ts`
- `src/components/evidara/post-test-error-classification.tsx`
- `src/components/papers/LiveExam.tsx`
- `src/app/student/tests/take/page.tsx`
- `src/components/evidara/login-page.tsx`
- `src/app/reset-password/page.tsx`
- `src/app/auth/callback/page.tsx`
- `src/data/demo-data.ts`

Proposed new files:

- `supabase/migrations/<timestamp>_authorized_dashboard_snapshots.sql`
- `src/app/api/dashboard/student/route.ts`
- `src/app/api/dashboard/institution/route.ts`
- `src/app/api/dashboard/platform/route.ts`

### Phase 2 — Proper App Router workspaces and mobile shell

**Outcome:** nested, protected, code-split routes with a mobile drawer and role-specific navigation.

Likely current files:

- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/components/evidara/app-sidebar.tsx`
- `src/store/use-app-store.ts`
- `src/lib/workspaceRedirect.ts`
- `src/lib/workspaceViews.ts`
- `src/hooks/use-mobile.ts`
- `src/app/globals.css`
- `src/app/evidara-brand.css`
- `src/app/evidara-tables.css`
- Existing redirect wrappers under `src/app/admin/**`, `src/app/school/**`, and `src/app/student/**`

Proposed new route/layout files:

- `src/app/(workspace)/layout.tsx`
- `src/app/(workspace)/admin/layout.tsx`
- `src/app/(workspace)/school/layout.tsx`
- `src/app/(workspace)/teacher/layout.tsx`
- `src/app/(workspace)/student/layout.tsx`
- `src/app/(workspace)/**/loading.tsx`
- `src/app/(workspace)/**/error.tsx`
- `src/lib/server/workspace-session.ts`

### Phase 3 — Public website, legal identity, and onboarding

**Outcome:** an honest, complete public site with working trial/demo/contact journeys.

Likely current files:

- `src/components/evidara/landing-page.tsx`
- `src/components/evidara/login-page.tsx`
- `src/app/layout.tsx`
- `src/config/site.ts`
- `src/app/contact/page.tsx`
- `src/app/privacy/page.tsx`
- `src/app/terms/page.tsx`
- `src/app/refund-policy/page.tsx`
- `src/app/products/page.tsx`
- `src/app/trial/page.tsx`
- `src/app/school/register/page.tsx`
- `src/components/InstituteRegistrationForm.tsx`
- `public/robots.txt`
- `public/logo.svg`

Proposed new files as required:

- `src/app/sitemap.ts`
- `src/app/about/page.tsx`
- `src/app/help/page.tsx`
- `src/app/security/page.tsx`
- `src/app/demo/page.tsx`

### Phase 4 — Permission model, teacher workflow, and parent portal

**Outcome:** scoped roles/permissions and real guardian access.

Likely current files:

- `src/lib/roles.ts`
- `src/lib/accessControl.ts`
- `src/hooks/use-module-access.ts`
- `src/components/evidara/access-control-view.tsx`
- `src/components/evidara/app-sidebar.tsx`
- `src/app/api/access-control/route.ts`
- `src/app/api/institution-analytics/route.ts`
- `src/app/api/school-platform/route.ts`
- `src/components/evidara/school-views.tsx`
- `src/components/institution-analytics/institution-analytics-workspace.tsx`

Proposed new files:

- `supabase/migrations/<timestamp>_scoped_roles_permissions.sql`
- `supabase/migrations/<timestamp>_guardian_student_links.sql`
- `src/lib/permissions.ts`
- `src/app/api/guardian-links/route.ts`
- `src/app/(workspace)/teacher/**`
- `src/app/(workspace)/parent/**`
- `src/components/parent/ParentDashboard.tsx`
- `src/components/teacher/TeacherDashboard.tsx`

### Phase 5 — Payments, refunds, and referral credits

**Outcome:** auditable reversals and a server-awarded referral-credit system.

Likely current files:

- `supabase/functions/create-razorpay-order/index.ts`
- `supabase/functions/verify-razorpay-payment/index.ts`
- `supabase/functions/razorpay-webhook/index.ts`
- `supabase/functions/_shared/http.ts`
- `supabase/03_version_2_commerce.sql`
- `supabase/24_voucher_offline_payment_hardening.sql`
- `supabase/34_v9_product_catalogue.sql`
- `supabase/44_v12_security_foundation.sql`
- `src/components/commerce/ProductStore.tsx`
- `src/components/commerce/PurchaseHistory.tsx`
- `src/components/commerce/ProductAnalyticsDashboard.tsx`
- `src/components/commerce/AdminVoucherManager.tsx`
- `src/components/evidara/admin-views.tsx`
- `src/types/commerce.ts`
- `scripts/DEPLOY_EDGE_FUNCTIONS.ps1`
- `supabase/.env.functions.example`

Proposed new files:

- `supabase/migrations/<timestamp>_refund_and_financial_ledger.sql`
- `supabase/migrations/<timestamp>_referral_programs_and_rewards.sql`
- `supabase/functions/request-refund/index.ts`
- `src/app/api/referrals/route.ts`
- `src/components/referrals/ReferralDashboard.tsx`
- `src/components/referrals/AdminReferralPrograms.tsx`

### Phase 6 — R2 asset hardening

**Outcome:** validated, traceable, deletable, policy-controlled question assets.

Likely current files:

- `src/lib/server/r2.ts`
- `src/app/api/question-assets/upload/route.ts`
- `src/lib/questionAssetUpload.ts`
- `src/lib/imageFiles.ts`
- `src/components/evidara/question-image-field.tsx`
- `src/components/evidara/question-editor-dialog.tsx`
- `src/components/evidara/question-bulk-import-dialog-core.tsx`
- `src/lib/questionTemplateWorkbook.ts`
- `.env.example`
- `next.config.ts`

Proposed new files:

- `supabase/migrations/<timestamp>_asset_registry_and_policies.sql`
- `src/app/api/question-assets/[assetId]/route.ts`
- `src/lib/server/file-validation.ts`
- `scripts/r2-orphan-audit.mjs`

### Phase 7 — Cleanup, quality gates, and deployment pipeline

**Outcome:** a maintainable source repository with reproducible releases.

Likely current files:

- `package.json`
- `package-lock.json`
- `eslint.config.mjs`
- `tsconfig.json`
- `next.config.ts`
- `vercel.json`
- `.gitignore`
- `.vercelignore`
- `public/_headers`
- All scripts under `scripts/` after classification
- Confirmed unreachable components under `src/components/questions`, `src/components/papers`, `src/components/school`, and `src/components/ui`
- Legacy/demo clients and data under `src/lib` and `src/data`
- Historic root deployment/hotfix documentation and `backups/`

Proposed new files:

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-supabase.yml`
- `supabase/seed.sql`
- `tests/e2e/auth.spec.ts`
- `tests/e2e/roles.spec.ts`
- `tests/e2e/student-exam.spec.ts`
- `tests/e2e/commerce.spec.ts`
- `tests/e2e/mobile-navigation.spec.ts`

## 32. Acceptance gates before production

1. An automated test proves a student cannot update role, organization, privileged membership, or module permissions through any client/API path.
2. Every visible dashboard uses live authorized data or is removed/explicitly marked demo.
3. A clean clone can install, typecheck, lint, test, reset a local Supabase schema, and build without relying on generated artifacts.
4. Database migration history is reconciled and repeatable in an isolated environment.
5. Student, teacher, institution admin, platform admin, and break-glass super-admin permissions have positive and negative tests.
6. Parent features remain hidden until guardian consent/RLS tests pass.
7. Password recovery, forced temporary-password change, session revocation, and privileged MFA are verified end to end.
8. Payment creation, verification, webhook replay, voucher abuse, refund, reversal, and entitlement rollback are tested with provider test mode.
9. R2 rejects disallowed/spoofed content, records ownership, serves through the chosen controlled domain/path, and supports deletion/orphan cleanup.
10. No synthetic/demo data can appear in production user analytics without an explicit sandbox mode.
11. Public claims, pricing, customers, legal identity, support contacts, privacy terms, and refund terms are approved and accurate.
12. Authenticated navigation and test-taking are verified at common phone, tablet, and desktop widths, including keyboard/screen-reader basics.
13. Detailed readiness/configuration pages are platform-admin-only; public health responses reveal no sensitive configuration.
14. Vercel web deployment and Supabase database/Edge Function deployment are version-controlled, reviewed, and independently reversible.

## 33. Final recommendation

Do not begin with a visual homepage rebuild or referrals. Begin with the database authorization fix and a reproducible migration baseline. Next, remove the live/demo ambiguity and reconnect the already-built school and student functionality. Then split the authenticated workspace into proper protected routes and repair mobile navigation. Once the product truth, roles, payments, refunds, and storage controls are reliable, complete the public site and add referral credits as a ledger-backed financial feature.

That order preserves the strongest parts of Evidara while preventing polished UI or growth features from being layered on top of insecure authorization and misleading data.
