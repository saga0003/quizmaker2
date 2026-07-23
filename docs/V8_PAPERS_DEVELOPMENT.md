# Evidara V8 Papers — Development Checkpoint

## Release boundary

- V7 Questions is frozen on `evidara-v7-final` at commit `9c049256a2a75c8f634690d7aab918db33dd9c64`.
- V8 development happens only on `evidara-v8-papers`.
- Draft PR: `#19 Evidara V8.0 — Test Paper Builder`.
- Vercel Git deployment is disabled globally in `vercel.json`.
- No V8 Supabase migration runs automatically.
- The PR remains draft and unmerged.
- No Cloudflare or production deployment is performed by the V8 QA workflow.

## Migration order

Apply only in a separate V8 test Supabase project after the repository work is accepted for manual testing:

1. `supabase/32_v8_paper_builder_foundation.sql`
2. `supabase/33_v8_paper_generation_engine.sql`
3. `supabase/34_v8_paper_review_publish_export.sql`
4. `supabase/35_v8_safe_autosave_templates_workflow.sql`

These migrations extend the existing Question Bank and V4 paper schema. They do not replace or duplicate Question Bank data.

## Implemented in the current V8 checkpoint

### Version and repository isolation

- package release changed to `8.0.0`
- V7 final branch preserved separately
- V8 branch and draft PR created from the frozen V7 commit
- dedicated V8 smoke tests and GitHub Actions workflow
- Vercel deployment guard enforced in both repository configuration and QA

### Programmes and subjects

- Foundation Grade 7
- Foundation Grade 8
- Foundation Grade 9
- Foundation Grade 10
- NEET
- JEE Main
- JEE Advanced
- KCET
- extensible programme catalogue and allowed-subject mapping
- Physics, Chemistry, Mathematics, Biology and Logical Reasoning support through the existing taxonomy

### Paper definition builder

- step-based workflow for Details, Programme, Sections, Questions, Blueprint, Arrangement, Marks and Rules, and Preview
- partial draft saving
- delayed autosave with saved, unsaved and failed states
- non-destructive UUID-based section and question upserts
- blueprint and generation-history preservation during later autosaves
- unique paper code generation
- manual paper creation
- automatic paper creation
- hybrid paper creation with locked manual questions
- paper-level and section-level settings
- optional sections and attempt-count rules
- duration, reading time, grace time and stored auto-submit rule
- positive, negative, unanswered and numerical-tolerance settings
- shuffle rules and locked-position preservation
- question-reuse controls

### Question Bank integration

- approved Question Bank is the only source of paper questions
- server-side filtering and pagination
- programme, subject, chapter, topic, difficulty, question type, language and search filters
- usage counts and unused-question preference
- visible-page bulk selection
- manual question addition and reassignment between sections
- per-question marks and negative-mark overrides
- mandatory, question lock and position lock controls

### Blueprint generation

- blueprint rows per section
- requested-versus-available counts
- shortage detection before generation
- deterministic random seed stored with each generation run
- full-paper generation
- section regeneration
- blueprint-row regeneration
- locked-question preservation
- unrelated questions protected during row-only regeneration
- one generated-question replacement using the same eligibility rule
- generation audit history

### Draft duplication and versions

- duplicate entire paper
- duplicate settings only
- duplicate settings and sections
- duplicate settings, sections and blueprint
- duplicate settings, sections and selected questions
- every copy receives a new code
- every duplicate begins as Draft
- published dates, schedules and access codes are not copied
- create a new editable version from an existing paper
- published version snapshots stored immutably
- visible version history in the lifecycle workspace

### Templates

- save a paper as a reusable template
- template copy scopes match the duplication scopes
- create a new paper from a template
- template-created papers always begin as Draft
- archive templates without altering papers already created from them

### Review and publication lifecycle

- submit for academic review
- review records stored in Supabase
- comments can target the whole paper, a section or a paper question
- resolve review comments
- approve, request changes or reject
- unresolved comments block approval
- critical validation failures block publication
- remaining warnings require an acceptance reason
- publication creates a reusable paper-definition snapshot only
- publication does not create a product, price, bundle, purchase, student entitlement, access code, test attempt, result or analytics record

### Validation

- missing programme
- missing subjects
- missing sections
- missing questions
- missing duration
- missing paper code
- compulsory empty sections
- unapproved Question Bank references
- missing options for non-numerical questions
- missing correct answers
- blueprint shortages
- section attempt-count mismatches
- missing solution warnings
- missing topic warnings
- missing estimated-time warnings
- duration-pressure warning

### Preview, exports and audit

- complete paper preview
- printable question-paper HTML
- printable answer-key HTML
- printable solutions HTML
- Excel-compatible question list
- question-list CSV
- answers-and-solutions CSV
- blueprint CSV
- validation JSON
- complete JSON backup
- print current preview
- searchable and filterable paper audit history

## Intentionally ignored or deferred

The supplied AI prompt contained ideas outside the V8 Papers module or unsuitable for the current architecture. They are intentionally not included here:

- Product Builder, bundles and pricing
- GST, coupons, invoices and payment gateways
- purchases and subscriptions
- student entitlement or assignment
- agent codes and invigilation codes
- student test-taking interface
- live examination delivery
- results and student analytics
- school sales and commerce workflows
- AI-written questions or automatic content generation
- a new duplicate Question Bank
- decorative UI instructions that conflict with the existing Evidara design system
- server-side PDF generation dependency; printable HTML is provided instead
- automatic migration execution against the live Supabase database
- Vercel, Cloudflare or production deployment

These belong to later modules or require an explicit product decision.

## Automated validation result

GitHub Actions run `29980250123` passed:

- locked dependency installation
- ESLint
- TypeScript
- V8 Papers smoke contracts
- Next.js production build
- Cloudflare/OpenNext build
- Vercel-disabled assertion
- final quality gates
- non-deployment boundary

## Remaining before the V8 Papers module can be declared final

- apply migrations 32–35 to a separate Supabase V8 test environment
- execute end-to-end database tests with real Question Bank records
- role-test Super Admin, Evidara Admin, School Admin and School Teacher
- confirm school users cannot see another school's paper or template
- confirm students cannot query paper-builder records or answer snapshots
- test large Question Bank pagination and blueprint availability using production-sized data
- test duplicate, template, version, review, publish and export workflows in the browser
- verify migration rollback and backup procedure
- fix any failures found during that manual test cycle

No deployment or merge should occur until the user explicitly confirms that the Papers module is complete.
