# Evidara V18 — PYQ Paper Engine Build

This package is the consolidated Evidara source workspace as of **14 August 2026**. It combines the last full V14 build with every subsequent correction and feature overlay supplied for this project.

## Included build chain

1. **Evidara V14 Fixed** — full application base.
2. **V14 Correction Patch** — student results, self-assessment caps/multi-select, voucher and complimentary entitlement corrections.
3. **V15 Dynamic SEO Patch** — public product/question/paper/topic pages, dynamic sitemap, robots, metadata and publication gates.
4. **V16 NEET PYQ Import Patch** — private Super Admin staging import, PYQ Review Queue and promotion into the normal Question Bank review workflow.

The application release metadata is now **18.0.0 / Evidara V18**.

## Existing live Supabase project

Confirmed project: `xzfozpnzvznqrvcsoail`.

For that existing project, the supplied build notes state that the V14 correction migration, V15 SEO migrations and V16 NEET PYQ staging migration were already applied. The V14 correction notes also state that `create-razorpay-order` was already deployed as Edge Function version 7. Do not blindly re-run migrations against that existing project.

For a **new/fresh Supabase project**, configure the environment first and then apply the migrations in `supabase/migrations/` in timestamp order and deploy the required Edge Functions.

## Local setup

1. Copy `.env.example` to `.env` or `.env.local` and insert the real keys locally. Never commit either real environment file.
2. Run `npm ci`.
3. Run `npm run qa:v16` for the integrated static smoke suite.
4. Run `npm run qa:final` for TypeScript + integrated smoke validation.
5. Run `TEST_EVIDARA.bat` on Windows (it installs dependencies automatically on first run), or run `npm ci` followed by `npm run dev` on another supported shell.
6. Before production publishing, run the normal verification/build flow and test Student, Teacher, School Admin, Evidara Admin and Super Admin roles.

## NEET PYQ archive import

Go to **Super Admin → Questions → Evidara Question Bank → Import NEET PYQ Archive** and select the prepared `NEET_2016_2026_ALL_BATCHES.json` archive.

The importer streams the archive in chunks and is retry-safe. Imported questions enter the **PYQ Review Queue** only. They are not automatically approved or published. Promotion creates normal Evidara questions in **In Review**, after which chapter/topic mapping, visual/equation correction and final approval continue through the standard Question Bank workflow.

## SEO publication safety

V15 SEO behavior remains intact. Question pages are public only when the question satisfies the database publication gate, including approval, a correct answer and a detailed solution. The NEET staging importer does not bypass this gate.

## Deployment target

The codebase is configured for **Vercel + Supabase**. The canonical site example is `https://evidara.natscix.com`. Update environment values if the production domain changes.

## Build history

Historical patch application notes are retained in `docs/build-history/`. Historical reports such as `V14_BUILD_REPORT.md` and `V15_SEO_BUILD_REPORT.md` are intentionally preserved for audit/reference.


## V18 PYQ paper engine

V18 adds first-class previous-year paper identity to questions. A single reusable question can be linked to one or more official paper occurrences (exam, year, variant, code and original question number) without duplicating the question.

Platform admins can:
- import the prepared NEET/AIPMT archive with V17 taxonomy mapping and V18 paper identity;
- review/promote questions through the existing Question Bank governance flow;
- rebuild an exact official PYQ paper after all source positions are linked and approved;
- import a complete JSON or LaTeX paper, reuse exact duplicates automatically, and review near duplicates side-by-side;
- select/filter PYQ papers by year and variant while building a product bundle.
