# Evidara V10 Analytics Phase 2

Phase 2 extends the live Phase 1 student analytics foundation with teacher-level aggregate analytics, a controlled Super Admin demo-data laboratory and the corrected student analytics presentation.

## Migration order

Apply after migration 35:

1. `supabase/36_v10_analytics_phase_2.sql`
2. `supabase/36a_v10_analytics_phase_2_safety.sql`
3. `supabase/36b_v10_analytics_phase_2_attempt_limit_hotfix.sql`
4. `supabase/36c_v10_analytics_student_calculation_ui_fix.sql`

Migration 36a gives generated sections a batch-unique identity and ensures teacher status counts represent distinct students rather than repeated attempts.

Migration 36b corrects only analytics-demo paper inserts to the valid maximum attempt limit of 100. It preserves the normal `question_papers_attempt_limit_check` boundary for genuine papers.

Migration 36c corrects student analytics so each paper contributes only its latest submitted attempt. It also uses one latest attempt per comparison student per paper, adds group average, Top 10%, Top 5% and highest-score references, and prevents repeated attempts from inflating test counts, question counts or subject evidence.

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
2. **Demo NEET Incomplete Series** — 7 of 10 papers completed; percentage, accuracy and time management remain visible while product percentile stays locked.
3. **Demo Mixed Mastery Series** — all 10 papers completed with multi-subject evidence.

A product containing 10 papers now reports a maximum of 10 completed tests in its summary. Multiple attempts on one paper do not increase the completed-test count. The latest submitted attempt is used for percentage, accuracy, time management, subject evidence and comparison calculations.

## Corrected student analytics UI

- Analytics products moved from the left rail into a top dropdown.
- Date-band, Last 3 and Last 5 controls removed.
- Test history is displayed as a clean horizontally navigable timeline without a native scrollbar.
- Every KPI information icon explains the exact calculation in simple language.
- “Cohort” wording is replaced with “comparison students” and “group average”.
- Accuracy shows correct, answered and unanswered counts separately.
- Time-management values remain on one line.
- Radar, subject bars and percentage trends show group average, Top 10%, Top 5% and highest-score references.
- Percentile trends show average percentile, Top 10%, Top 5% and highest-percentile guide lines.
- Trend controls wrap inside their own card instead of overflowing the screen.
- Charts use a compact two-column layout with the trend chart spanning the full width.

### Acceptance checks

- Selecting a 10-test product displays 10 completed tests, not the total number of attempts.
- Accuracy equals correct answers divided by correct plus incorrect answers; unanswered questions remain separate.
- The time-management value, including `/ 10`, remains on one line.
- No native horizontal scrollbar is visible in the timeline.
- Product selection does not consume a permanent left column.
- Trend selectors remain inside the trend card on desktop, tablet and mobile widths.
- Group average, Top 10%, Top 5% and highest score appear in the comparison summary and percentage charts when enough comparison students exist.

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

The default 25,000-row dataset creates 250 attempts and 25,000 responses. The latest-attempt query reduces the student-facing calculation to one result per distinct paper while retaining the larger evidence volume for database and comparison testing.

Phase 3 remains the school-wide management dashboard with grade, section, teacher and subject comparisons across the full institution.
