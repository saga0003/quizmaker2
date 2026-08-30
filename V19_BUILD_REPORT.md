# Evidara V19 Build Report

## Consolidated release

- Release: `19.0.0`
- Base: latest V18 PYQ/Paper Engine with V18.1, V18.2, V18.3 and V18.4 corrections merged.
- Includes V15 dynamic SEO, V14 roles/resources/self-assessment, V18 PYQ paper identity, JSON/LaTeX paper creation, duplicate review, product PYQ filtering, and V18.4 filtered review navigation.

## V19 source-fidelity PYQ layer

- Super Admin can select the extracted V19 NEET archive root once.
- Evidara uploads physically cropped prompt/solution assets to R2 and imports the questions directly to the normal Question Bank as `in_review`.
- Prompt and solution assets are physically different files. A learner-facing prompt asset does not contain off-crop answer/solution page content.
- Native extracted text remains for search/edit/taxonomy/analytics. It is not rendered a second time over the source-fidelity visual.
- Native KaTeX remains available only for genuine math content and is sized/text-styled to sit naturally with Evidara UI text.
- V19 SEO publication gate additionally requires complete prompt + solution asset URLs for source-fidelity questions.

## Live Supabase cleanup before V19 import

- Previous 2,620 imported NEET/AIPMT PYQs removed from the main Question Bank.
- Previous 2,620 NEET staging rows removed.
- Previous 14 empty NEET staging batches removed.
- 14 official PYQ source-paper identities retained.
- Main platform Question Bank returned to 220 pre-PYQ questions before the V19 import.

## NEET V19 archive QA

- 14 papers
- 2,620 questions
- 2,620/2,620 prompt visuals
- 2,620/2,620 solution visuals
- 6,171 physically cropped 144-DPI PNG assets
- 2,602 extracted answer keys
- 2,592 extracted textual solutions
- 2,568 questions with four extracted text options
- 291 questions explicitly flagged for taxonomy review rather than force-mapped
- Original source material retained in the companion archive: 21 `.tex` files and 1,411 `.tikz` files

## Source verification

- V18 PYQ/Paper Engine static suite: 41/41 passed.
- V19 Source-Fidelity PYQ Engine static suite: 25/25 passed.
- Full regression smoke chain passes after updating legacy release assertions for V19.
- All 242 application `.ts`/`.tsx` files pass TypeScript syntax transpilation.
- A fresh dependency install/full Next production build could not be executed in this environment because dependencies are intentionally not bundled and this environment has previously had package-mirror limitations. `TEST_EVIDARA.bat` performs `npm ci`, typecheck, lint, regression and production build on the target machine before starting the app.
