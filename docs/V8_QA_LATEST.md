# Evidara V8 Papers — Latest QA Report

Validated commit: `758a7b16ab7b8cd48161de3a414d04546e7ed2f5`
Recorded at: 2026-07-23T08:04:04Z

| Gate | Status |
|---|---:|
| Install | 0 |
| ESLint | 0 |
| TypeScript | 0 |
| Base smoke | 1 |
| Phase 1 smoke | 0 |
| Phase 2 smoke | 1 |
| Phase 3 smoke | 0 |
| Next.js build | 0 |
| Cloudflare build | 0 |

## v8-install.txt
```text
npm warn deprecated intersection-observer@0.10.0: The Intersection Observer polyfill is no longer needed and can safely be removed. Intersection Observer has been Baseline since 2019.
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated glob@9.3.5: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated recharts@2.15.4: 1.x and 2.x branches are no longer active. Bump to Recharts v3 to receive latest features and bugfixes. See https://github.com/recharts/recharts/wiki/3.0-migration-guide

added 1054 packages in 19s
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

node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: V8 package version must be 8.0.0
+ actual - expected

+ '8.0.0-phase3'
- '8.0.0'
        ^

    at file:///home/runner/work/quizmaker2/quizmaker2/scripts/v8-papers-smoke.mjs:41:8 {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: '8.0.0-phase3',
  expected: '8.0.0',
  operator: 'strictEqual',
  diff: 'simple'
}

Node.js v22.23.1
```

## v8-phase1.txt
```text

> evidara-school-platform@8.0.0-phase3 qa:phase1
> node scripts/v8-phase1-integration-smoke.mjs

V8 Phase 1 integration smoke passed.
Admin and School Papers route to QuestionPaperList.
Legacy LivePaperCatalogue is disconnected from the main Papers navigation.
Vercel deployment remains disabled.
```

## v8-phase2.txt
```text

> evidara-school-platform@8.0.0-phase3 qa:phase2
> node scripts/v8-phase2-management-smoke.mjs

node:internal/modules/run_main:123
    triggerUncaughtException(
    ^

AssertionError [ERR_ASSERTION]: Papers must use the Phase 2 management dashboard.
    at file:///home/runner/work/quizmaker2/quizmaker2/scripts/v8-phase2-management-smoke.mjs:10:8
    at ModuleJob.run (node:internal/modules/esm/module_job:343:25)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:681:26)
    at async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:117:5) {
  generatedMessage: false,
  code: 'ERR_ASSERTION',
  actual: 'import Link from "next/link";\n' +
    'import { Sparkles } from "lucide-react";\n' +
    'import { PaperManagementDashboard } from "@/components/papers/PaperManagementDashboard";\n' +
    '\n' +
    'export function QuestionPaperList({ kind }: { kind: "admin" | "school" }) {\n' +
    '  const generationRoute = kind === "admin" ? "/admin/papers/generation/" : "/school/papers/generation/";\n' +
    '  return (\n' +
    '    <div className="space-y-4">\n' +
    '      <section className="flex flex-col gap-4 rounded-xl border border-[#B7DCD5] bg-[#EDF7F5] p-4 md:flex-row md:items-center md:justify-between">\n' +
    '        <div className="flex items-start gap-3">\n' +
    '          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#0E5A5A] text-white">\n' +
    '            <Sparkles size={19} />\n' +
    '          </div>\n' +
    '          <div>\n' +
    '            <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0E5A5A]">V8 Phase 3</span>\n' +
    '            <h2 className="mt-1 font-bold text-[#14232B]">Question Bank & Generation Studio</h2>\n' +
    '            <p className="mt-1 text-xs leading-relaxed text-[#587077]">\n' +
    '              Select approved questions across pages, lock hybrid questions, build exact blueprints, resolve shortages and reproduce generation runs by seed.\n' +
    '            </p>\n' +
    '          </div>\n' +
    '        </div>\n' +
    '        <Link href={generationRoute} className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0E5A5A] px-4 text-sm font-semibold text-white hover:bg-[#0A4747]">\n' +
    '          <Sparkles size={16} /> Open Phase 3 Studio\n' +
    '        </Link>\n' +
    '      </section>\n' +
    '      <PaperManagementDashboard kind={kind} />\n' +
    '    </div>\n' +
    '  );\n' +
    '}\n',
  expected: /PaperManagementDashboard as QuestionPaperList/,
  operator: 'match',
  diff: 'simple'
}

Node.js v22.23.1
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
✓ Generating static pages using 2 workers (69/69) in 885ms
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
Applying code patches: 2.663s
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

