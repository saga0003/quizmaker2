# Evidara V8 Responsive UI — QA Report

Validated commit: `d8558378e2ea8df2086a35502eb3efd94322ed23`
Validated branch: `evidara-v8-papers`
Recorded at: 2026-07-23T09:39:50Z
Overall result: **true**

| Gate | Status |
|---|---:|
| Locked install | 0 |
| ESLint | 0 |
| TypeScript | 0 |
| Base smoke | 0 |
| Phase 1 smoke | 0 |
| Phase 2 smoke | 0 |
| Phase 3 smoke | 0 |
| Responsive UI smoke | 0 |
| Next.js build | 0 |
| Cloudflare/OpenNext build | 0 |
| Vercel deployment lock | 0 |

## base.txt
```text

> evidara-school-platform@8.0.0-ui-refresh qa:smoke
> node scripts/v8-papers-smoke.mjs

V8 UI refresh base smoke checks passed with Vercel locked.
```

## cloudflare.txt
```text

> evidara-school-platform@8.0.0-ui-refresh cf:build
> opennextjs-cloudflare build


┌─────────────────────────────┐
│ OpenNext — Cloudflare build │
└─────────────────────────────┘

App directory: /home/runner/work/quizmaker2/quizmaker2
Next.js version : 16.2.10
@opennextjs/cloudflare version: 1.20.1
@opennextjs/aws version: 4.0.2
workerd compatibility_date: 2026-07-20

┌─────────────────────────────────┐
│ OpenNext — Building Next.js app │
└─────────────────────────────────┘


> evidara-school-platform@8.0.0-ui-refresh build
> next build

▲ Next.js 16.2.10 (Turbopack)
- Experiments (use with caution):
  · cpus: 2

  Creating an optimized production build ...
✓ Compiled successfully in 10.1s
  Running TypeScript ...
  Finished TypeScript in 17.0s ...
  Collecting page data using 2 workers ...
  Generating static pages using 2 workers (0/69) ...
  Generating static pages using 2 workers (17/69) 
  Generating static pages using 2 workers (34/69) 
  Generating static pages using 2 workers (51/69) 
✓ Generating static pages using 2 workers (69/69) in 900ms
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


┌──────────────────────────────┐
│ OpenNext — Generating bundle │
└──────────────────────────────┘

Bundling middleware function...
Bundling static assets...
Bundling cache assets...
Building server function: default...
Applying code patches: 2.656s
# copyPackageTemplateFiles
[35m⚙️ Bundling the OpenNext server...
[0m
[35mWorker saved in `.open-next/worker.js` 🚀
[0m
OpenNext build complete.
```

## deployment-lock.txt
```text
Vercel is fully disabled and npm run qa remains the future deployment gate.
```

## install.txt
```text
npm warn deprecated intersection-observer@0.10.0: The Intersection Observer polyfill is no longer needed and can safely be removed. Intersection Observer has been Baseline since 2019.
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated glob@9.3.5: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated recharts@2.15.4: 1.x and 2.x branches are no longer active. Bump to Recharts v3 to receive latest features and bugfixes. See https://github.com/recharts/recharts/wiki/3.0-migration-guide

added 1054 packages in 23s
```

## lint.txt
```text

> evidara-school-platform@8.0.0-ui-refresh lint
> eslint

```

## next-build.txt
```text

> evidara-school-platform@8.0.0-ui-refresh build
> next build

⚠ No build cache found. Please configure build caching for faster rebuilds. Read more: https://nextjs.org/docs/messages/no-cache
▲ Next.js 16.2.10 (Turbopack)
- Experiments (use with caution):
  · cpus: 2

  Creating an optimized production build ...
✓ Compiled successfully in 9.7s
  Running TypeScript ...
  Finished TypeScript in 16.2s ...
  Collecting page data using 2 workers ...
  Generating static pages using 2 workers (0/69) ...
  Generating static pages using 2 workers (17/69) 
  Generating static pages using 2 workers (34/69) 
  Generating static pages using 2 workers (51/69) 
✓ Generating static pages using 2 workers (69/69) in 895ms
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

## phase1.txt
```text

> evidara-school-platform@8.0.0-ui-refresh qa:phase1
> node scripts/v8-phase1-integration-smoke.mjs

V8 Phase 1 integration smoke passed under the responsive UI refresh boundary.
```

## phase2.txt
```text

> evidara-school-platform@8.0.0-ui-refresh qa:phase2
> node scripts/v8-phase2-management-smoke.mjs

V8 Phase 2 management smoke passed under the responsive UI refresh boundary.
```

## phase3.txt
```text

> evidara-school-platform@8.0.0-ui-refresh qa:phase3
> node scripts/v8-phase3-generation-smoke.mjs

V8 Phase 3 question and generation smoke passed under the responsive UI boundary.
Server-side filtering, cross-page selection, exact availability, hybrid locks, blueprints, shortage blocking and generation history remain wired.
```

## typecheck.txt
```text

> evidara-school-platform@8.0.0-ui-refresh typecheck
> tsc --noEmit

```

## ui.txt
```text

> evidara-school-platform@8.0.0-ui-refresh qa:ui
> node scripts/v8-ui-responsive-smoke.mjs

V8 responsive UI smoke passed.
V7 visual continuity, mobile drawer navigation, tablet rails, touch targets, card-based management, scroll-safe modals and deployment lock are present.
```
