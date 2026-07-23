# Evidara V8 Papers — Latest QA Report

Validated commit: `f3167b820ffa57c34eea4d1f6548e20cd1eda2fd`
Recorded at: 2026-07-23T08:10:50Z

| Gate | Status |
|---|---:|
| Install | 0 |
| ESLint | 0 |
| TypeScript | 0 |
| Base smoke | 0 |
| Phase 1 smoke | 0 |
| Phase 2 smoke | 0 |
| Phase 3 smoke | 0 |
| Next.js build | 0 |
| Cloudflare build | 0 |

## v8-install.txt
```text
npm warn deprecated intersection-observer@0.10.0: The Intersection Observer polyfill is no longer needed and can safely be removed. Intersection Observer has been Baseline since 2019.
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated glob@9.3.5: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated recharts@2.15.4: 1.x and 2.x branches are no longer active. Bump to Recharts v3 to receive latest features and bugfixes. See https://github.com/recharts/recharts/wiki/3.0-migration-guide

added 1054 packages in 22s
```

## v8-lint.txt
```text

> evidara-school-platform@8.0.0-phase3 lint
> eslint


/home/runner/work/quizmaker2/quizmaker2/src/components/commerce/AdminProductManager.tsx
  20:2  warning  Unused eslint-disable directive (no problems were reported from 'react-hooks/set-state-in-effect')

/home/runner/work/quizmaker2/quizmaker2/src/components/papers/QuestionGenerationStudio.tsx
  282:722  warning  Expected an assignment or function call and instead saw an expression  @typescript-eslint/no-unused-expressions

✖ 2 problems (0 errors, 2 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.

```

## v8-typecheck.txt
```text

> evidara-school-platform@8.0.0-phase3 typecheck
> tsc --noEmit

```

## v8-smoke.txt
```text

> evidara-school-platform@8.0.0-phase3 qa:smoke
> node scripts/v8-papers-smoke.mjs

V8 Phase 3 base smoke checks passed.
```

## v8-phase1.txt
```text

> evidara-school-platform@8.0.0-phase3 qa:phase1
> node scripts/v8-phase1-integration-smoke.mjs

V8 Phase 1 integration smoke passed under the Phase 3 preview release boundary.
```

## v8-phase2.txt
```text

> evidara-school-platform@8.0.0-phase3 qa:phase2
> node scripts/v8-phase2-management-smoke.mjs

V8 Phase 2 management smoke passed under the Phase 3 preview release boundary.
```

## v8-phase3.txt
```text

> evidara-school-platform@8.0.0-phase3 qa:phase3
> node scripts/v8-phase3-generation-smoke.mjs

V8 Phase 3 question and generation smoke passed.
Server-side filtering, cross-page selection, exact availability, hybrid locks, blueprints, shortage blocking and generation history are wired.
```

## v8-next-build.txt
```text
  Generating static pages using 2 workers (17/69) 
  Generating static pages using 2 workers (34/69) 
  Generating static pages using 2 workers (51/69) 
✓ Generating static pages using 2 workers (69/69) in 887ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /admin
├ ○ /admin/achievements
├ ○ /admin/benchmarks
├ ○ /admin/papers
├ ○ /admin/papers/generation
├ ○ /admin/papers/new
├ ○ /admin/papers/preview
├ ○ /admin/products
├ ○ /admin/questions
├ ○ /admin/questions/import
├ ○ /admin/questions/new
├ ○ /admin/questions/review
├ ○ /admin/readiness
├ ○ /admin/segments
├ ○ /admin/subscriptions
├ ƒ /api/access-control
├ ƒ /api/achievements
├ ƒ /api/admin/readiness
├ ƒ /api/benchmarks
├ ƒ /api/certificates
├ ƒ /api/config
├ ƒ /api/health
├ ƒ /api/question-taxonomy
├ ƒ /api/questions/review
├ ƒ /api/school-platform
├ ○ /auth/callback
├ ○ /contact
├ ○ /data-guide
├ ○ /deployment-check
├ ○ /login
├ ○ /metric-guide
├ ○ /privacy
├ ○ /products
├ ○ /refund-policy
├ ○ /reset-password
├ ○ /school
├ ○ /school/achievements
├ ○ /school/benchmarks
├ ○ /school/benchmarks/publish
├ ○ /school/papers
├ ○ /school/papers/generation
├ ○ /school/papers/new
├ ○ /school/papers/preview
├ ○ /school/questions
├ ○ /school/questions/import
├ ○ /school/questions/new
├ ○ /school/register
├ ○ /school/resources
├ ○ /school/segments
├ ○ /school/students
├ ○ /school/subscription
├ ○ /setup-check
├ ○ /student
├ ○ /student/achievements
├ ○ /student/analytics
├ ○ /student/benchmarks
├ ○ /student/purchases
├ ○ /student/resources
├ ○ /student/results
├ ○ /student/segment
├ ○ /student/tests
├ ○ /student/tests/take
├ ○ /terms
├ ○ /trial
├ ○ /verify/certificate
└ ƒ /verify/certificate/[code]


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand

```

## v8-cloudflare-build.txt
```text
├ ○ /admin/products
├ ○ /admin/questions
├ ○ /admin/questions/import
├ ○ /admin/questions/new
├ ○ /admin/questions/review
├ ○ /admin/readiness
├ ○ /admin/segments
├ ○ /admin/subscriptions
├ ƒ /api/access-control
├ ƒ /api/achievements
├ ƒ /api/admin/readiness
├ ƒ /api/benchmarks
├ ƒ /api/certificates
├ ƒ /api/config
├ ƒ /api/health
├ ƒ /api/question-taxonomy
├ ƒ /api/questions/review
├ ƒ /api/school-platform
├ ○ /auth/callback
├ ○ /contact
├ ○ /data-guide
├ ○ /deployment-check
├ ○ /login
├ ○ /metric-guide
├ ○ /privacy
├ ○ /products
├ ○ /refund-policy
├ ○ /reset-password
├ ○ /school
├ ○ /school/achievements
├ ○ /school/benchmarks
├ ○ /school/benchmarks/publish
├ ○ /school/papers
├ ○ /school/papers/generation
├ ○ /school/papers/new
├ ○ /school/papers/preview
├ ○ /school/questions
├ ○ /school/questions/import
├ ○ /school/questions/new
├ ○ /school/register
├ ○ /school/resources
├ ○ /school/segments
├ ○ /school/students
├ ○ /school/subscription
├ ○ /setup-check
├ ○ /student
├ ○ /student/achievements
├ ○ /student/analytics
├ ○ /student/benchmarks
├ ○ /student/purchases
├ ○ /student/resources
├ ○ /student/results
├ ○ /student/segment
├ ○ /student/tests
├ ○ /student/tests/take
├ ○ /terms
├ ○ /trial
├ ○ /verify/certificate
└ ƒ /verify/certificate/[code]


○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand


┌──────────────────────────────┐
│ OpenNext — Generating bundle │
└──────────────────────────────┘

Bundling middleware function...
Bundling static assets...
Bundling cache assets...
Building server function: default...
Applying code patches: 2.626s
# copyPackageTemplateFiles
[35m⚙️ Bundling the OpenNext server...
[0m
[35mWorker saved in `.open-next/worker.js` 🚀
[0m
OpenNext build complete.
```

## v8-deployment.txt
```text
Vercel deploymentEnabled: {"*":false,"evidara-v8-papers":true}
```

