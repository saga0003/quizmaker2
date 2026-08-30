# Evidara V16 — Local Test and Vercel Deployment

## Local Windows test
1. Extract the ZIP.
2. Put your real `.env` **or** `.env.local` beside `package.json`.
3. Double-click `TEST_EVIDARA.bat`.
4. On the first run, the BAT installs dependencies with `npm ci` automatically.
5. Before starting the server it runs the complete release gate: TypeScript, ESLint, all regression smoke suites, and a production `next build`.
6. Only after that gate passes does Evidara open at `http://localhost:3000`.

Your real environment file is excluded by `.gitignore` and must never be committed.

## Production environment on Vercel
Configure the same production secrets in **Vercel Project Settings → Environment Variables**. The local `.env` file is intentionally not treated as a deployable secret store.

At minimum configure:
- `NEXT_PUBLIC_APP_URL` — production Evidara origin, for example `https://evidara.natscix.com`
- `NEXT_PUBLIC_SITE_URL` — same canonical production origin unless intentionally different
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (preferred) or legacy `SUPABASE_SERVICE_ROLE_KEY`

For file/resource uploads also configure all six R2 variables shown in `.env.example`.

## Deploy
You can deploy through your linked Vercel project/Git workflow, or run `PUBLISH_EVIDARA.bat` after local testing. The publish BAT runs TypeScript, lint, V16 smoke tests, and a production Next.js build before asking for explicit confirmation.
