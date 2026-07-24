# Evidara V10 Analytics Phase 2

Phase 2 extends the live Phase 1 student analytics foundation with teacher-level aggregate analytics and a controlled Super Admin demo-data laboratory.

## Migration order

Apply after migration 35:

1. `supabase/36_v10_analytics_phase_2.sql`
2. `supabase/36a_v10_analytics_phase_2_safety.sql`
3. `supabase/36b_v10_analytics_phase_2_attempt_limit_hotfix.sql`

The safety migration must be applied immediately after migration 36. It gives generated sections a batch-unique identity and ensures teacher status counts represent distinct students rather than repeated attempts.

Migration 36b corrects only analytics-demo paper inserts to the valid maximum attempt limit of 100. It preserves the normal `question_papers_attempt_limit_check` boundary for genuine papers.

## Demo account

Default target:

`sales.student@demo.evidara.app`

The account must already exist in Supabase Auth and must have opened Evidara at least once so a profile exists.

## Generated evidence

Super Admin can generate one isolated batch with:

- 10,000 response rows
- 25,000 response rows
- 50,000 response rows

The generator creates:

- five subjects
- one hundred reusable questions
- thirty published question papers
- three published products
- a current version and entitlement for every product
- varied submitted attempts
- one response for every paper question in every generated attempt
- varied percentage, correctness, unanswered, response-time and integrity values

### Product calculation cases

1. **Demo Foundation Complete Series** — all 10 papers completed; product percentile should unlock.
2. **Demo NEET Incomplete Series** — 7 of 10 papers completed; percentage, accuracy and pacing remain visible while product percentile stays locked.
3. **Demo Mixed Mastery Series** — all 10 papers completed with multi-subject evidence.

## Teacher dashboard

Teachers see only sections assigned through `teacher_section_assignments`.

The dashboard includes:

- assigned students
- active students
- completed tests
- average performance
- accuracy
- participation
- improving students
- students needing attention
- strong students
- subject performance
- performance and accuracy trends
- section comparison
- review queues
- student profile drill-down

The status queue is designed for teaching follow-up and is not a permanent student label.

## Reset safeguards

Reset is restricted to Super Admin.

The interface asks twice:

1. A first warning lists the complete generated scope.
2. A second warning requires the exact target email and the exact phrase `RESET DEMO ANALYTICS`.

The RPC independently validates both values.

Reset removes only rows carrying the generated batch identity:

- exam responses
- exam attempts
- generated products and product versions
- generated entitlements
- product-paper relationships
- generated papers, sections and paper questions
- generated questions and options
- generated subjects
- the generated academic section
- a generated organization or membership only when the batch originally created it

For an existing student membership, its previous section is restored.

Genuine products, papers, tests, attempts, responses, schools, students and memberships are outside the deletion query.

## Performance boundary

The default 25,000-row dataset creates 250 attempts and 25,000 responses. The student trend view therefore remains usable while the database has enough evidence to validate aggregate formulas and query performance.

Phase 3 remains the school-wide management dashboard with grade, section, teacher and subject comparisons across the full institution.
