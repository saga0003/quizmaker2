# Evidara V8 Papers — Latest QA Report

Validated commit: `d7c5cdf57feea81805c5bfd18eb298a773b4d5e6`
Recorded at: 2026-07-23T08:01:10Z

| Gate | Status |
|---|---:|
| Install | 1 |
| ESLint | 127 |
| TypeScript | 1 |
| Base smoke | 1 |
| Phase 1 smoke | 0 |
| Phase 2 smoke | 1 |
| Phase 3 smoke | 0 |
| Next.js build | 127 |
| Cloudflare build | 127 |

## v8-install.txt
```text
npm error code ETARGET
npm error notarget No matching version found for @radix-ui/react-progress@^1.2.9.
npm error notarget In most cases you or one of your dependencies are requesting
npm error notarget a package version that doesn't exist.
npm error A complete log of this run can be found in: /home/runner/.npm/_logs/2026-07-23T08_01_03_118Z-debug-0.log
```

## v8-lint.txt
```text

> evidara-school-platform@8.0.0-phase3 lint
> eslint

sh: 1: eslint: not found
```

## v8-typecheck.txt
```text
src/components/ui/resizable.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/resizable.tsx(4,34): error TS2307: Cannot find module 'lucide-react' or its corresponding type declarations.
src/components/ui/resizable.tsx(5,37): error TS2307: Cannot find module 'react-resizable-panels' or its corresponding type declarations.
src/components/ui/resizable.tsx(14,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/scroll-area.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/scroll-area.tsx(4,38): error TS2307: Cannot find module '@radix-ui/react-scroll-area' or its corresponding type declarations.
src/components/ui/scroll-area.tsx(14,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/select.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/select.tsx(4,34): error TS2307: Cannot find module '@radix-ui/react-select' or its corresponding type declarations.
src/components/ui/select.tsx(5,59): error TS2307: Cannot find module 'lucide-react' or its corresponding type declarations.
src/components/ui/select.tsx(12,10): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/separator.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/separator.tsx(4,37): error TS2307: Cannot find module '@radix-ui/react-separator' or its corresponding type declarations.
src/components/ui/separator.tsx(15,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/sheet.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/sheet.tsx(4,33): error TS2307: Cannot find module '@radix-ui/react-dialog' or its corresponding type declarations.
src/components/ui/sheet.tsx(5,23): error TS2307: Cannot find module 'lucide-react' or its corresponding type declarations.
src/components/ui/sheet.tsx(10,10): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/sidebar.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/sidebar.tsx(4,22): error TS2307: Cannot find module '@radix-ui/react-slot' or its corresponding type declarations.
src/components/ui/sidebar.tsx(5,35): error TS2307: Cannot find module 'class-variance-authority' or its corresponding type declarations.
src/components/ui/sidebar.tsx(6,31): error TS2307: Cannot find module 'lucide-react' or its corresponding type declarations.
src/components/ui/sidebar.tsx(130,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/skeleton.tsx(3,44): error TS2503: Cannot find namespace 'React'.
src/components/ui/skeleton.tsx(5,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/slider.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/slider.tsx(4,34): error TS2307: Cannot find module '@radix-ui/react-slider' or its corresponding type declarations.
src/components/ui/slider.tsx(27,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/sonner.tsx(3,26): error TS2307: Cannot find module 'next-themes' or its corresponding type declarations.
src/components/ui/sonner.tsx(4,49): error TS2307: Cannot find module 'sonner' or its corresponding type declarations.
src/components/ui/sonner.tsx(10,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/sonner.tsx(18,14): error TS2503: Cannot find namespace 'React'.
src/components/ui/switch.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/switch.tsx(4,34): error TS2307: Cannot find module '@radix-ui/react-switch' or its corresponding type declarations.
src/components/ui/switch.tsx(13,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/table.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/table.tsx(9,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/tabs.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/tabs.tsx(4,32): error TS2307: Cannot find module '@radix-ui/react-tabs' or its corresponding type declarations.
src/components/ui/tabs.tsx(13,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/textarea.tsx(1,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/textarea.tsx(7,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/toast.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/toast.tsx(4,34): error TS2307: Cannot find module '@radix-ui/react-toast' or its corresponding type declarations.
src/components/ui/toast.tsx(5,40): error TS2307: Cannot find module 'class-variance-authority' or its corresponding type declarations.
src/components/ui/toast.tsx(6,19): error TS2307: Cannot find module 'lucide-react' or its corresponding type declarations.
src/components/ui/toast.tsx(16,3): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/toaster.tsx(17,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/toggle-group.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/toggle-group.tsx(4,39): error TS2307: Cannot find module '@radix-ui/react-toggle-group' or its corresponding type declarations.
src/components/ui/toggle-group.tsx(5,35): error TS2307: Cannot find module 'class-variance-authority' or its corresponding type declarations.
src/components/ui/toggle-group.tsx(26,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/toggle.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/toggle.tsx(4,34): error TS2307: Cannot find module '@radix-ui/react-toggle' or its corresponding type declarations.
src/components/ui/toggle.tsx(5,40): error TS2307: Cannot find module 'class-variance-authority' or its corresponding type declarations.
src/components/ui/toggle.tsx(39,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/components/ui/tooltip.tsx(3,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/components/ui/tooltip.tsx(4,35): error TS2307: Cannot find module '@radix-ui/react-tooltip' or its corresponding type declarations.
src/components/ui/tooltip.tsx(13,5): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/context/AuthProvider.tsx(3,31): error TS2307: Cannot find module '@supabase/supabase-js' or its corresponding type declarations.
src/context/AuthProvider.tsx(4,73): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/context/AuthProvider.tsx(20,56): error TS2503: Cannot find namespace 'React'.
src/context/AuthProvider.tsx(54,10): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found. Make sure you have types for the appropriate package installed.
src/hooks/use-mobile.ts(1,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/hooks/use-module-access.ts(3,46): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/hooks/use-toast.ts(4,24): error TS2307: Cannot find module 'react' or its corresponding type declarations.
src/lib/server/supabaseServer.ts(1,62): error TS2307: Cannot find module '@supabase/supabase-js' or its corresponding type declarations.
src/lib/server/supabaseServer.ts(3,21): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/server/supabaseServer.ts(5,3): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/server/supabaseServer.ts(6,3): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/server/supabaseServer.ts(8,20): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/supabase.ts(1,46): error TS2307: Cannot find module '@supabase/supabase-js' or its corresponding type declarations.
src/lib/supabase.ts(3,13): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/supabase.ts(4,14): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/supabase.ts(4,66): error TS2591: Cannot find name 'process'. Do you need to install type definitions for node? Try `npm i --save-dev @types/node` and then add 'node' to the types field in your tsconfig.
src/lib/utils.ts(1,39): error TS2307: Cannot find module 'clsx' or its corresponding type declarations.
src/lib/utils.ts(2,25): error TS2307: Cannot find module 'tailwind-merge' or its corresponding type declarations.
src/store/use-app-store.ts(3,24): error TS2307: Cannot find module 'zustand' or its corresponding type declarations.
tailwind.config.ts(1,29): error TS2307: Cannot find module 'tailwindcss' or its corresponding type declarations.
tailwind.config.ts(2,32): error TS2307: Cannot find module 'tailwindcss-animate' or its corresponding type declarations.
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

> evidara-school-platform@8.0.0-phase3 build
> next build

sh: 1: next: not found
```

## v8-cloudflare-build.txt
```text

> evidara-school-platform@8.0.0-phase3 cf:build
> opennextjs-cloudflare build

sh: 1: opennextjs-cloudflare: not found
```

## v8-deployment.txt
```text
Vercel deploymentEnabled: false
```

