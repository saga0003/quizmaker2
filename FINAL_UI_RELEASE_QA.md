# Evidara V16 UI Verified Release — QA Notes

This package preserves the user's redesigned Evidara UI and adds release/deployment hardening around it.

## Local test workflow
- Add a real `.env` or `.env.local` beside `package.json`.
- Run `TEST_EVIDARA.bat`.
- On a clean extraction, dependencies are installed automatically with `npm ci`.
- Environment values are validated without printing secrets.
- The BAT then runs `npm run qa:final`, which performs TypeScript checking, ESLint, all regression smoke suites, and a production Next.js build.
- The local dev server is opened only after the release gate passes.
- Port 3000 is verified using Evidara's `/api/health` release response, not merely by checking that a port is open.

## Vercel readiness changes
- `vercel.json` is configured for Next.js with `npm ci` + `npm run build`.
- Git-triggered Vercel deployment is no longer explicitly blocked.
- `.gitignore` excludes `.env`, `.env.local`, `.vercel`, `node_modules`, `.next`, and caches.
- `.env.example` contains safe placeholders only.
- `PUBLISH_EVIDARA.bat` runs the same release gate before allowing a production deployment.
- Production environment variables must still be configured in Vercel Project Settings; local `.env` files are intentionally not a production secret store.

## Compatibility fixes
- Local validation accepts either `.env` or `.env.local`.
- Browser key validation accepts the current Supabase publishable key or legacy anon key.
- Server code/readiness accepts the current `SUPABASE_SECRET_KEY` or legacy `SUPABASE_SERVICE_ROLE_KEY` consistently.
- Partial R2 configuration is rejected; completely absent R2 is reported clearly as file-upload functionality not configured.
- A stale Cloudflare-Workers deployment-readiness message was corrected to the actual Vercel + Supabase + optional R2 architecture.

## Validation completed in packaging environment
- 238 TypeScript/TSX files parsed successfully with the TypeScript parser.
- Local and `@/` alias imports resolve against the source tree.
- All imported third-party packages are declared in `package.json`.
- `package.json` and `package-lock.json` root dependency declarations match.
- All JavaScript `.mjs` scripts pass Node syntax checks.
- All 12 regression smoke suites pass, including institution analytics, authorization, student resources, commerce/referrals, Vercel, V14, V15 SEO, and V16 NEET PYQ import.
- No real `.env`/`.env.local` is included and no obvious embedded Supabase/JWT/AWS-style secret was detected.

## Packaging-environment limitation
The packaging sandbox could not download npm dependencies because DNS access to `registry.npmjs.org` returned `EAI_AGAIN`. Therefore the dependency-backed `next build` could not be executed inside this sandbox. This is why `TEST_EVIDARA.bat`, `VERIFY_EVIDARA.bat`, and `PUBLISH_EVIDARA.bat` all run the full `qa:final` gate on the real machine before local use or deployment.
