# Evidara V8 Papers — Development Checkpoint

## Release boundary

- V7 Questions is frozen on `evidara-v7-final`.
- V8 development happens only on `evidara-v8-papers`.
- Vercel Git deployment is disabled.
- No V8 Supabase migration runs automatically.
- PR #19 remains draft and unmerged.

## Migration order

1. `supabase/32_v8_paper_builder_foundation.sql`
2. `supabase/33_v8_paper_generation_engine.sql`
3. `supabase/34_v8_paper_review_publish_export.sql`
4. `supabase/35_v8_safe_autosave_templates_workflow.sql`

These migrations extend the existing Question Bank and V4 paper schema. They do not create pricing, products, purchases, student entitlement, agent codes, result processing or analytics.

## Current V8 capabilities

- separate Foundation Grade 7, 8, 9 and 10 programmes
- paper details, programme, subject and section builder
- manual Question Bank selection with server-side filters and pagination
- automatic and hybrid blueprint generation
- exact shortages, locked-question preservation and deterministic seeds
- full, section and blueprint-row regeneration
- generated-question replacement backend and UI
- non-destructive draft autosave preserving blueprints
- marks, duration, shuffling and question-reuse rules
- paper preview and validation
- tracked review comments and decisions
- approval-before-publication lifecycle
- immutable published version snapshots
- draft-only duplication and new versions
- save as template and build a draft from template
- printable HTML, Excel-compatible, CSV and JSON exports
- complete paper audit history

## Safety guarantees

A duplicated paper, paper created from a template, or new paper version always starts as Draft. Publishing a paper definition never creates a product, price, bundle, student entitlement, access code or examination attempt.

## Validation status

The GitHub workflow runs lint, TypeScript, V8 smoke contracts, the Next.js production build and the Cloudflare/OpenNext build. It also fails whenever Vercel deployment is enabled.

Manual Supabase migration and role testing will be documented only after all Papers features are complete.
