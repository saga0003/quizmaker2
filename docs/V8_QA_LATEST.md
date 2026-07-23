# Evidara V8 Papers — Latest QA Report

Validated commit: `e11d371dd6bfee81a66e6943211b37c77723886c`
Recorded at: 2026-07-23T08:00:48Z

| Gate | Status |
|---|---:|
| Install | missing |
| ESLint | 127 |
| TypeScript | 1 |
| Base smoke | 1 |
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

added 1054 packages in 24s
```

## v8-lint.txt
```text

> evidara-school-platform@8.0.0-phase2 lint
> eslint

sh: 1: eslint: not found
```

## v8-typecheck.txt
```text

> evidara-school-platform@8.0.0-phase2 typecheck
> tsc --noEmit

src/app/layout.tsx(2,8): error TS2882: Cannot find module or type declarations for side-effect import of 'katex/dist/katex.min.css'.
src/app/layout.tsx(3,8): error TS2882: Cannot find module or type declarations for side-effect import of './globals.css'.
src/app/layout.tsx(4,8): error TS2882: Cannot find module or type declarations for side-effect import of './evidara-brand.css'.
src/app/layout.tsx(5,8): error TS2882: Cannot find module or type declarations for side-effect import of './evidara-metrics.css'.
src/app/layout.tsx(6,8): error TS2882: Cannot find module or type declarations for side-effect import of './evidara-tables.css'.
src/app/layout.tsx(7,8): error TS2882: Cannot find module or type declarations for side-effect import of './evidara-segments.css'.
src/app/layout.tsx(8,8): error TS2882: Cannot find module or type declarations for side-effect import of './evidara-benchmarks.css'.
src/components/InstituteRegistrationForm.tsx(11,1492): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/TrialTest.tsx(16,3243): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/achievements/AchievementBadge.tsx(6,20): error TS2307: Cannot find module './Achievements.module.css' or its corresponding type declarations.
src/components/achievements/AdminAchievementGovernance.tsx(6,20): error TS2307: Cannot find module './Achievements.module.css' or its corresponding type declarations.
src/components/achievements/CertificateViewer.tsx(8,20): error TS2307: Cannot find module './Achievements.module.css' or its corresponding type declarations.
src/components/achievements/SchoolAchievementWorkspace.tsx(7,20): error TS2307: Cannot find module './Achievements.module.css' or its corresponding type declarations.
src/components/achievements/StudentAchievementWorkspace.tsx(8,20): error TS2307: Cannot find module './Achievements.module.css' or its corresponding type declarations.
src/components/commerce/AdminProductManager.tsx(44,406): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/commerce/AdminVoucherManager.tsx(384,14): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/commerce/ProductStore.tsx(183,12): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/commerce/PurchaseHistory.tsx(9,3037): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/readiness/SystemReadinessDashboard.tsx(220,14): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
```

## v8-smoke.txt
```text

> evidara-school-platform@8.0.0-phase2 qa:smoke
> node scripts/v8-papers-smoke.mjs

node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: V8 package version must be 8.0.0
+ actual - expected

+ '8.0.0-phase2'
- '8.0.0'
        ^

    at file:///home/runner/work/quizmaker2/quizmaker2/scripts/v8-papers-smoke.mjs:41:8 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: '8.0.0-phase2',
  expected: '8.0.0',
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v22.23.1
```

## v8-phase1.txt
```text

> evidara-school-platform@8.0.0-phase2 qa:phase1
> node scripts/v8-phase1-integration-smoke.mjs

V8 Phase 1 integration smoke passed.
Admin and School Papers route to QuestionPaperList.
Legacy LivePaperCatalogue is disconnected from the main Papers navigation.
Vercel deployment remains disabled.
```

## v8-phase2.txt
```text

> evidara-school-platform@8.0.0-phase2 qa:phase2
> node scripts/v8-phase2-management-smoke.mjs

V8 Phase 2 management smoke passed.
Draft duplication, versioning, archive, restore and recoverable deletion contracts are present.
Vercel remains disabled pending Phase 3 acceptance.
```

## v8-phase3.txt
```text
Phase 3 QA not registered yet.
```

## v8-next-build.txt
```text
  Generating static pages using 2 workers (17/69) 
  Generating static pages using 2 workers (34/69) 
  Generating static pages using 2 workers (51/69) 
✓ Generating static pages using 2 workers (69/69) in 927ms
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
Applying code patches: 2.680s
# copyPackageTemplateFiles
[35m⚙️ Bundling the OpenNext server...
[0m
[35mWorker saved in `.open-next/worker.js` 🚀
[0m
OpenNext build complete.
```

## v8-deployment.txt
```text
Vercel deploymentEnabled: false
```

