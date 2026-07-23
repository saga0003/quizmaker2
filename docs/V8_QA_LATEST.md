# Evidara V8 Papers — Latest QA Report

Validated commit: `a60b6e453cfb0513e1b224a09d67b8a5c3ac7a11`
Recorded at: 2026-07-23T07:58:58Z

| Gate | Status |
|---|---:|
| Install | missing |
| ESLint | 127 |
| TypeScript | 1 |
| Base smoke | 1 |
| Phase 1 smoke | 0 |
| Phase 2 smoke | 0 |
| Phase 3 smoke | 0 |
| Next.js build | 127 |
| Cloudflare build | 127 |

## v8-install.txt
```text
npm warn deprecated intersection-observer@0.10.0: The Intersection Observer polyfill is no longer needed and can safely be removed. Intersection Observer has been Baseline since 2019.
npm warn deprecated node-domexception@1.0.0: Use your platform's native DOMException instead
npm warn deprecated glob@9.3.5: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
npm warn deprecated recharts@2.15.4: 1.x and 2.x branches are no longer active. Bump to Recharts v3 to receive latest features and bugfixes. See https://github.com/recharts/recharts/wiki/3.0-migration-guide
```

## v8-lint.txt
```text

> evidara-school-platform@8.0.0-phase2 lint
> eslint

sh: 1: eslint: not found
```

## v8-typecheck.txt
```text
src/app/verify/certificate/page.tsx(1,31): error TS2307: Cannot find module 'next' or its corresponding type declarations.
src/components/AuthForm.tsx(4,27): error TS2307: Cannot find module 'next/navigation' or its corresponding type declarations.
src/components/AuthForm.tsx(75,48): error TS2339: Property 'signUp' does not exist on type 'SupabaseAuthClient'.
src/components/AuthForm.tsx(81,48): error TS2339: Property 'signInWithPassword' does not exist on type 'SupabaseAuthClient'.
src/components/AuthForm.tsx(92,39): error TS2339: Property 'signInWithOAuth' does not exist on type 'SupabaseAuthClient'.
src/components/DashboardShell.tsx(3,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/DashboardShell.tsx(4,29): error TS2307: Cannot find module 'next/navigation' or its corresponding type declarations.
src/components/InstituteRegistrationForm.tsx(8,220): error TS2339: Property 'getUser' does not exist on type 'SupabaseAuthClient'.
src/components/InstituteRegistrationForm.tsx(11,1492): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/Navbar.tsx(2,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/PerformanceChart.tsx(2,100): error TS2307: Cannot find module 'recharts' or its corresponding type declarations.
src/components/ProtectedPage.tsx(4,27): error TS2307: Cannot find module 'next/navigation' or its corresponding type declarations.
src/components/SetupBanner.tsx(3,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/TrialTest.tsx(16,3243): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/achievements/AchievementBadge.tsx(3,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/achievements/AchievementBadge.tsx(6,20): error TS2307: Cannot find module './Achievements.module.css' or its corresponding type declarations.
src/components/achievements/AdminAchievementGovernance.tsx(6,20): error TS2307: Cannot find module './Achievements.module.css' or its corresponding type declarations.
src/components/achievements/CertificateViewer.tsx(3,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/achievements/CertificateViewer.tsx(8,20): error TS2307: Cannot find module './Achievements.module.css' or its corresponding type declarations.
src/components/achievements/SchoolAchievementWorkspace.tsx(3,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/achievements/SchoolAchievementWorkspace.tsx(7,20): error TS2307: Cannot find module './Achievements.module.css' or its corresponding type declarations.
src/components/achievements/StudentAchievementWorkspace.tsx(3,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/achievements/StudentAchievementWorkspace.tsx(8,20): error TS2307: Cannot find module './Achievements.module.css' or its corresponding type declarations.
src/components/analytics/StudentIntelligence.tsx(3,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/analytics/StudentIntelligence.tsx(5,92): error TS2307: Cannot find module 'recharts' or its corresponding type declarations.
src/components/benchmarks/StudentBenchmarkWorkspace.tsx(4,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/commerce/AdminProductManager.tsx(44,406): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/commerce/AdminVoucherManager.tsx(384,14): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/commerce/ProductStore.tsx(4,27): error TS2307: Cannot find module 'next/navigation' or its corresponding type declarations.
src/components/commerce/ProductStore.tsx(5,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/commerce/ProductStore.tsx(183,12): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/commerce/PurchaseHistory.tsx(9,3037): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/evidara/access-control-view.tsx(105,47): error TS2339: Property 'getSession' does not exist on type 'SupabaseAuthClient'.
src/components/evidara/admin-views.tsx(15,8): error TS2307: Cannot find module 'recharts' or its corresponding type declarations.
src/components/evidara/landing-page.tsx(5,19): error TS2307: Cannot find module 'next/image' or its corresponding type declarations.
src/components/evidara/login-page.tsx(4,19): error TS2307: Cannot find module 'next/image' or its corresponding type declarations.
src/components/evidara/login-page.tsx(67,45): error TS2339: Property 'signInWithPassword' does not exist on type 'SupabaseAuthClient'.
src/components/evidara/login-page.tsx(92,45): error TS2339: Property 'signInWithOAuth' does not exist on type 'SupabaseAuthClient'.
src/components/evidara/login-page.tsx(123,45): error TS2339: Property 'resetPasswordForEmail' does not exist on type 'SupabaseAuthClient'.
src/components/evidara/school-views.tsx(13,8): error TS2307: Cannot find module 'recharts' or its corresponding type declarations.
src/components/evidara/student-dashboard.tsx(37,8): error TS2307: Cannot find module 'recharts' or its corresponding type declarations.
src/components/evidara/student-views.tsx(62,8): error TS2307: Cannot find module 'recharts' or its corresponding type declarations.
src/components/legal/LegalLayout.tsx(1,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/papers/PaperManagementDashboard.tsx(4,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/papers/PaperPreview.tsx(3,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/papers/QuestionGenerationStudio.tsx(4,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/papers/QuestionPaperBuilder.tsx(10,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/questions/QuestionBank.tsx(4,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/questions/QuestionEditor.tsx(4,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/questions/QuestionImporter.tsx(4,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/questions/QuestionReviewQueue.tsx(4,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/readiness/SystemReadinessDashboard.tsx(220,14): error TS2322: Type '{ jsx: true; children: string; }' is not assignable to type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
  Property 'jsx' does not exist on type 'DetailedHTMLProps<StyleHTMLAttributes<HTMLStyleElement>, HTMLStyleElement>'.
src/components/segments/StudentSegmentEvidence.tsx(1,18): error TS2307: Cannot find module 'next/link' or its corresponding type declarations.
src/components/ui/calendar.tsx(9,60): error TS2307: Cannot find module 'react-day-picker' or its corresponding type declarations.
src/components/ui/chart.tsx(4,36): error TS2307: Cannot find module 'recharts' or its corresponding type declarations.
src/components/ui/form.tsx(14,8): error TS2307: Cannot find module 'react-hook-form' or its corresponding type declarations.
src/context/AuthProvider.tsx(3,10): error TS2305: Module '"@supabase/supabase-js"' has no exported member 'Session'.
src/context/AuthProvider.tsx(3,19): error TS2305: Module '"@supabase/supabase-js"' has no exported member 'User'.
src/context/AuthProvider.tsx(33,19): error TS2339: Property 'getSession' does not exist on type 'SupabaseAuthClient'.
src/context/AuthProvider.tsx(37,46): error TS2339: Property 'onAuthStateChange' does not exist on type 'SupabaseAuthClient'.
src/context/AuthProvider.tsx(50,62): error TS2339: Property 'signOut' does not exist on type 'SupabaseAuthClient'.
src/lib/achievementClient.ts(76,40): error TS2339: Property 'getSession' does not exist on type 'SupabaseAuthClient'.
src/lib/benchmarkClient.ts(76,40): error TS2339: Property 'getSession' does not exist on type 'SupabaseAuthClient'.
src/lib/server/supabaseServer.ts(1,50): error TS2305: Module '"@supabase/supabase-js"' has no exported member 'User'.
src/lib/server/supabaseServer.ts(3,21): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/server/supabaseServer.ts(5,3): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/server/supabaseServer.ts(6,3): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/server/supabaseServer.ts(8,20): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/server/supabaseServer.ts(58,45): error TS2339: Property 'getUser' does not exist on type 'SupabaseAuthClient'.
src/lib/supabase.ts(3,13): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/supabase.ts(4,14): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/supabase.ts(4,66): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/store/use-app-store.ts(130,39): error TS2339: Property 'signOut' does not exist on type 'SupabaseAuthClient'.
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

> evidara-school-platform@8.0.0-phase2 build
> next build

sh: 1: next: not found
```

## v8-cloudflare-build.txt
```text

> evidara-school-platform@8.0.0-phase2 cf:build
> opennextjs-cloudflare build

sh: 1: opennextjs-cloudflare: not found
```

## v8-deployment.txt
```text
Vercel deploymentEnabled: false
```

