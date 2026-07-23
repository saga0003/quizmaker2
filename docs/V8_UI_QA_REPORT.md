# Evidara V8 Responsive UI — QA Report

Validated commit: `a82ee3630b61e85417e83f61c0e802d6cca2b13d`
Validated branch: `evidara-v8-papers`
Recorded at: 2026-07-23T09:35:04Z
Overall result: **false**

| Gate | Status |
|---|---:|
| Locked install | 0 |
| ESLint | 0 |
| TypeScript | 2 |
| Base smoke | 0 |
| Phase 1 smoke | 0 |
| Phase 2 smoke | 0 |
| Phase 3 smoke | 0 |
| Responsive UI smoke | 0 |
| Next.js build | 1 |
| Cloudflare/OpenNext build | 1 |
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
✓ Compiled successfully in 9.8s
  Running TypeScript ...
Failed to type check.

./src/components/papers/QuestionGenerationStudio.tsx:284:28
Type error: 'supabase' is possibly 'null'.

  [90m282 |[0m     [36mif[0m (!supabase || !paperId || !selectedPaper) [36mreturn[0m;
  [90m283 |[0m     [36mconst[0m timer = window.setTimeout([36masync[0m () => {
[31m[1m>[0m [90m284 |[0m       [36mconst[0m result = [36mawait[0m supabase.rpc([32m"paper_question_availability_v8"[0m, {
  [90m    |[0m                            [31m[1m^[0m
  [90m285 |[0m         p_organization_id: kind === [32m"admin"[0m ? [36mnull[0m : organizationId,
  [90m286 |[0m         p_programme_code: selectedPaper.programme_code || [36mnull[0m,
  [90m287 |[0m         p_subject_id: subjectId === [32m"all"[0m ? [36mnull[0m : subjectId,
Next.js build worker exited with code: 1 and signal: null
node:internal/errors:983
  const err = new Error(message);
              ^

Error: Command failed: npm run build
    at genericNodeError (node:internal/errors:983:15)
    at wrappedFn (node:internal/errors:537:14)
    at checkExecSyncError (node:child_process:916:11)
    at Object.execSync (node:child_process:988:15)
    at buildNextjsApp (file:///home/runner/work/quizmaker2/quizmaker2/node_modules/@opennextjs/aws/dist/build/buildNextApp.js:15:8)
    at build (file:///home/runner/work/quizmaker2/quizmaker2/node_modules/@opennextjs/cloudflare/dist/cli/build/build.js:63:9)
    at async buildCommand (file:///home/runner/work/quizmaker2/quizmaker2/node_modules/@opennextjs/cloudflare/dist/cli/commands/build.js:40:5) {
  status: 1,
  signal: null,
  output: [ null, null, null ],
  pid: 2666,
  stdout: null,
  stderr: null
}

Node.js v22.23.1
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

added 1054 packages in 19s
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
✓ Compiled successfully in 9.5s
  Running TypeScript ...
Failed to type check.

./src/components/papers/QuestionGenerationStudio.tsx:284:28
Type error: 'supabase' is possibly 'null'.

  [90m282 |[0m     [36mif[0m (!supabase || !paperId || !selectedPaper) [36mreturn[0m;
  [90m283 |[0m     [36mconst[0m timer = window.setTimeout([36masync[0m () => {
[31m[1m>[0m [90m284 |[0m       [36mconst[0m result = [36mawait[0m supabase.rpc([32m"paper_question_availability_v8"[0m, {
  [90m    |[0m                            [31m[1m^[0m
  [90m285 |[0m         p_organization_id: kind === [32m"admin"[0m ? [36mnull[0m : organizationId,
  [90m286 |[0m         p_programme_code: selectedPaper.programme_code || [36mnull[0m,
  [90m287 |[0m         p_subject_id: subjectId === [32m"all"[0m ? [36mnull[0m : subjectId,
Next.js build worker exited with code: 1 and signal: null
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

src/components/papers/QuestionGenerationStudio.tsx(284,28): error TS18047: 'supabase' is possibly 'null'.
```

## ui.txt
```text

> evidara-school-platform@8.0.0-ui-refresh qa:ui
> node scripts/v8-ui-responsive-smoke.mjs

V8 responsive UI smoke passed.
V7 visual continuity, mobile drawer navigation, tablet rails, touch targets, card-based management, scroll-safe modals and deployment lock are present.
```
