# Evidara V10 Analytics Phase 2

Phase 2 extends the live student analytics foundation with teacher analytics, a controlled Super Admin demo cohort, multi-student benchmarks and the corrected student dashboard.

## Migration order

Apply after migration 35:

1. `supabase/36_v10_analytics_phase_2.sql`
2. `supabase/36a_v10_analytics_phase_2_safety.sql`
3. `supabase/36b_v10_analytics_phase_2_attempt_limit_hotfix.sql`
4. `supabase/36c_v10_analytics_student_calculation_ui_fix.sql`
5. `supabase/36d_v10_analytics_100_student_demo_cohort.sql`
6. `supabase/36d1_v10_analytics_numeric_round_compat.sql`
7. `supabase/36e_v10_analytics_comparison_engine.sql`
8. `supabase/36f_v10_analytics_demo_reset_safety.sql`
9. `supabase/36g_v10_analytics_comparison_hardening.sql`

For an installation already migrated through 36c, run only steps 5–9.

- 36a gives generated sections a batch-unique identity and fixes teacher status counts.
- 36b keeps generated paper attempt limits inside the valid 1–100 range.
- 36c uses one latest submitted result per student per test.
- 36d replaces the original single-student generator with the fixed 100-student PCM/PCB cohort.
- 36d1 supports decimal rounding for PostgreSQL ordered-set percentile aggregates.
- 36e adds percentage, percentile, accuracy and time-score comparisons plus test-detail analytics.
- 36f restores the real demo student’s original academic tracks after reset.
- 36g preserves genuine school subject benchmarks when no generated cohort is involved.

## Demo account

Default real login:

`sales.student@demo.evidara.app`

The account must exist in Supabase Auth and must have opened Evidara once so that its profile exists.

The other 99 generated students are isolated analytics records and do not require Supabase Auth accounts.

## Fixed 100-student cohort

The generator creates:

- 100 students
- 50 PCM students
- 50 PCB students
- three JEE test series
- three NEET test series
- ten papers per series
- sixty published papers in total
- one hundred questions per paper
- Physics and Chemistry for both tracks
- Mathematics for PCM
- Biology for PCB
- varied correct, incorrect and unanswered counts
- varied percentage, both accuracy values and time-management scores
- complete and deliberately incomplete series

The real demo login is part of PCM and receives detailed attempts and question responses. It completes two JEE series and only 7 of 10 tests in the third JEE series.

The additional 99 students store efficient per-test and per-subject evidence so comparisons remain fast without creating hundreds of thousands of unnecessary response rows.

## Percentile completion rule

A series percentile unlocks only when the student completes all ten papers in that selected series.

At 7/10, 8/10 or 9/10:

- percentage remains visible
- overall accuracy remains visible
- answered-only accuracy remains visible
- time score remains visible
- series percentile remains locked

At 10/10, the average series percentile becomes available.

## Accuracy definitions

### Primary accuracy

`Correct answers ÷ total questions × 100`

Example:

- 50 correct
- 30 wrong
- 20 unanswered
- 100 total questions
- overall accuracy = 50%

### Alternate accuracy

`Correct answers ÷ (correct + incorrect) × 100`

The Accuracy card contains a swap control so the user can move between all-question accuracy and answered-only accuracy.

## Student dashboard corrections

- Product selection is a top dropdown rather than a permanent left rail.
- Every test appears once in a horizontally navigable timeline.
- Selecting a timeline card opens that test’s detailed comparison popup.
- Each KPI information icon explains its formula.
- Subject comparison uses one compact row per subject rather than five crowded bar groups.
- The subject panel can switch between percentage, overall accuracy and time score.
- Each subject row shows the student result, comparison average marker and gap above or below average.
- Performance trends support percentage, percentile, overall accuracy and time score.
- Trend buttons independently toggle the student, average, Top 10%, Top 5% and highest lines.
- Trend selectors and buttons remain inside their card at all screen widths.

## Timeline test popup

Selecting any test displays:

- student score and percentage
- correct, wrong and unanswered counts
- overall accuracy
- answered-only accuracy
- time-management score
- number of students who wrote the test
- student rank position
- student percentile
- average
- lowest
- highest
- Top 10% threshold
- Top 5% threshold

Comparison groups are restricted to students who wrote the same test.

## Super Admin student table

The Demo Data area contains a table of all 100 generated students with:

- roll number and student name
- PCM or PCB track
- completed tests
- total marks and maximum marks
- overall percentage
- Physics percentage
- Chemistry percentage
- Mathematics or Biology percentage
- series completion status
- percentile locked or unlocked status when one series is selected

Super Admin can filter by:

- all six series or one specific series
- PCM or PCB
- roll number or student name

## Reset safeguards

Reset is restricted to Super Admin and requires two confirmations.

The final confirmation requires:

- the exact target email
- the exact phrase `RESET DEMO ANALYTICS`

Reset removes only records tagged with that generated batch, including generated students, results, products, papers, questions, attempts and responses. It restores the real demo account’s previous section and academic tracks. Genuine Evidara data is outside the deletion scope.

## Performance boundary

Only the real demo login receives full question-response evidence. The other 99 students use compact result tables for test and subject comparisons. This provides meaningful 100-student percentiles and thresholds while keeping generation and dashboard queries practical.

Phase 3 remains the whole-school management dashboard with grade, section, teacher and subject comparisons across the institution.
