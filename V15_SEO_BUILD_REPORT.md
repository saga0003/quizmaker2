# Evidara V15 Dynamic SEO Engine

## Automatic publication model
- Products: every `published` product has a public `/products/[slug]/` landing page. Admin/Super Admin can edit SEO title, description, keywords, audience copy, outcomes and FAQs in the product editor.
- Questions: the database trigger marks a question SEO-published only when it is an Evidara/platform question, has been approved, has a non-empty correct answer, and has a detailed solution. Incomplete questions remain draft/no-public-page automatically.
- Papers: published public previous-year/model/mock papers are listed automatically at `/question-papers/` and have `/question-papers/[slug]/` pages.
- Topic hubs: solved-question inventory automatically forms `/practice/[exam]/[subject]/[chapter]/[topic]/` landing pages.
- Crawling: dynamic `sitemap.xml`, `robots.txt`, canonicals, Open Graph metadata and structured data are included.

## Current live database state when built
- 220 questions were present; all remained SEO draft because none were approved at build time.
- This is intentional. Approving a complete question later causes the SEO trigger to publish its page automatically.
- Product pages are generated from the live published product catalogue.

## Verification
- `npm run typecheck -- --incremental false`: passed.
- `npm run lint`: 0 errors, 6 existing unrelated warnings.
- `node scripts/v15-seo-smoke.mjs`: 16/16 passed.
- Existing V14/Phase 1 smoke suites were run and passed before packaging.
- Full Next production build could not run in this environment because the internal package mirror returned 404 while Next attempted to download `@next/swc-linux-x64-gnu@16.2.10`.

## Live Supabase
Migrations were applied to the confirmed project `xzfozpnzvznqrvcsoail`.
