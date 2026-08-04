# Evidara V10 Analytics Phase 3

Phase 3 extends the approved Phase 2 branch with the whole-school command centre and a report-quality student analytics workspace.

## Migration order

Apply after migration 36g:

1. `supabase/37_v10_analytics_phase_3.sql`
2. `supabase/37a_v10_analytics_phase_3_review_hardening.sql`

No migration, merge, deployment or data generation runs automatically.

## Student analytics upgrades

- Removed the `Evidence-based next step` panel. Evidara does not create unsupported recommendations from incomplete or demonstration evidence.
- Performance Profile supports Percentage, Overall Accuracy and Time Score.
- Subject Comparison supports Percentage, Overall Accuracy and Time Score.
- Performance Profile, Subject Comparison and Performance Trends each provide independent controls for:
  - Your result
  - Average
  - Top 10%
  - Top 5%
  - Highest
- At least one comparison layer remains visible.
- Added a brand-coloured answer-distribution donut:
  - Correct: Evidara success green `#237A57`
  - Wrong: Evidara error red `#B54747`
  - Unanswered: Evidara amber `#F2B84B`

## Test marks and answer review

The end of the student report contains a completed-test selector and detailed table.

The selected test begins with:

- student percentage
- average percentage
- lowest percentage
- highest percentage
- Top 10% threshold
- Top 5% threshold
- position among test takers
- percentile

Each question row includes:

- question number and subject
- question text
- selected answer
- correct answer
- correct, wrong or unanswered status
- marks awarded and maximum marks
- time spent

Selecting a row expands:

- every option
- selected option highlighting
- correct option highlighting
- attached solution
- marked-for-review status

Access continues to follow the Phase 1 security boundary. A student can inspect only their own answers. Teachers can inspect students in assigned sections. School and platform administrators can inspect only students within their authorized scope.

## PDF export

The old browser `window.print()` action is removed from the Phase 3 student workspace.

`Download analytics PDF` creates a dedicated Evidara PDF containing:

- student and selected-product identity
- KPI cards
- answer distribution
- subject analysis
- subject marks table
- test result and benchmark table
- selected test question-review table

The school dashboard also exports a school analytics PDF with grade, section, subject and student tables.

## School Admin command centre

School Admin, Evidara Admin and Super Admin receive:

- school, academic-year, grade, section and product filters
- total and active students
- test participation
- average percentage
- overall accuracy
- average time-management score
- improving, strong and needs-attention counts
- grade comparison
- section comparison
- performance distribution
- answer distribution
- subject heatmap
- test-level benchmark monitoring
- teacher and class comparison
- student marks and subject table
- CSV export
- school PDF export
- academic follow-up tracker
- individual student drill-down

Teacher comparison is explicitly a class/section evidence view and not a permanent teacher rating.

## Calculation boundary

- one latest submitted result per student per test
- one test contributes once to completed-test counts
- school results combine genuine students and generated cohort records without double-counting the real demo account
- test benchmarks include only students who wrote the same test
- overall accuracy is correct answers divided by total questions
- answered-only accuracy remains available as the alternate student view

## Acceptance checks

1. Student Analytics no longer displays `Evidence-based next step`.
2. All three comparison charts have metric controls and five independent series controls.
3. The answer-distribution donut uses the Evidara brand colours.
4. PDF export downloads a `.pdf` file without opening the browser print dialog.
5. Selecting a test displays average, lowest, highest, Top 10%, Top 5%, position and percentile.
6. The question table displays the selected answer and correct answer.
7. Expanding a row displays options and the solution.
8. School Admin can compare grades, sections, subjects, tests, teachers and students.
9. School Admin can create an academic follow-up from the student table.
10. CSV and school PDF exports reflect the current filters.
