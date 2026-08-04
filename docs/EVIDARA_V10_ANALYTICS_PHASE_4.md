# Evidara V10 Analytics Phase 4

Phase 4 is the final planned analytics layer. It extends Phase 3 with platform-wide administration, chapter/topic evidence and the simplified time-management score.

## Migration order

Apply after migration 37a:

1. `supabase/38_v10_analytics_phase_4.sql`
2. `supabase/38a_v10_analytics_phase_4_engine.sql`
3. `supabase/38b_v10_analytics_phase_4_hardening.sql`

No migration, demo generation, reset, merge or deployment runs automatically.

## Demo data model

After the old demo data is reset, the existing Super Admin generator creates the same fixed comparison cohort:

- 100 students
- 50 PCM students
- 50 PCB students
- 3 JEE series
- 3 NEET series
- 10 tests per series
- 100 questions per test
- Physics and Chemistry for both tracks
- Mathematics for PCM
- Biology for PCB

Phase 4 enriches that generated batch with:

- 16 chapters
- 48 topics
- chapter and topic mapping in generated question metadata
- per-student, per-test topic results
- chapter and topic percentage
- chapter and topic overall accuracy
- average, Top 10%, Top 5% and highest comparison values

The extra 99 students remain compact comparison records and do not require Supabase Auth accounts.

## Chapter structure

### Physics

- Mechanics
- Heat and Thermodynamics
- Electricity and Magnetism
- Optics and Modern Physics

### Chemistry

- Physical Chemistry
- Organic Chemistry
- Inorganic Chemistry
- Atomic Structure and Bonding

### Mathematics

- Algebra
- Calculus
- Coordinate Geometry
- Trigonometry and Probability

### Biology

- Cell and Biomolecules
- Human Physiology
- Genetics and Evolution
- Ecology and Plant Physiology

Each chapter contains three generated topics.

## Time Management Score

The test score uses no individual-question target time.

### Inputs

- total questions
- attempted questions
- correct answers
- total test duration
- actual time used
- normal submission or automatic timeout

### Completion — 50%

`attempted questions ÷ total questions`

### Accuracy control — 30%

`correct answers ÷ attempted questions`

If nothing was attempted, accuracy control is zero.

### Time control — 20%

- all questions attempted before timeout: `1`
- all questions attempted but automatic timeout: `0.8`
- unanswered questions remain: `attempted ÷ total`

### Final score

`10 × (0.50 × completion + 0.30 × accuracy control + 0.20 × time control)`

The score is rounded to one decimal and limited to 0–10.

### Penalties

Only two penalties apply:

1. subtract 1 when less than 50% of the duration is used and accuracy is below 60%
2. subtract 1 when the test ended automatically and questions remain unanswered

### Labels

- 0–3.9: Needs Improvement
- 4–5.9: Average
- 6–7.4: Good
- 7.5–8.9: Very Good
- 9–10: Excellent

The interface explicitly describes this as a supporting indicator and not a scientific measurement of speed or ability.

## Product completion rule

An individual test always receives a time-management score.

The overall selected-series score and the subject-level average across that series appear only after all compulsory tests are completed. For a 10-test series, the overall score is the average of the ten test scores.

## Student analytics

Phase 4 retains every Phase 3 student feature and adds:

- visible simple time-score methodology
- product completion gate for overall time score
- time-score rating
- chapter and topic product filter
- subject filter
- chapter/topic switch
- percentage/accuracy switch
- comparison chart
- chapter/topic evidence table
- chapter/topic CSV export

## Platform command centre

Evidara Admin and Super Admin now start at a platform-level dashboard with:

- active schools
- total and active students
- completed test results
- platform average percentage
- platform accuracy
- platform time score
- data-quality warning count
- school adoption and participation comparison
- school activity distribution
- school performance table
- board and school search filters
- platform CSV export
- anonymous chapter benchmarks
- anonymous topic benchmarks
- chapter/topic CSV export
- data-quality warnings
- analytics governance and audit activity
- school drill-down
- student drill-down through the school dashboard

The school adoption score is an operational usage indicator and not an academic ranking.

## Reset safety

The same two-step reset remains mandatory:

1. first warning confirmation
2. exact demo email and exact phrase `RESET DEMO ANALYTICS`

Phase 4 reset also removes generated chapters, topics and topic-result rows. Genuine Evidara data remains outside the generated batch deletion scope.

## Acceptance checks

1. Reset old demo data.
2. Run migrations 38, 38a and 38b.
3. Generate the 100-student cohort again.
4. Confirm 16 chapters and 48 topics are generated.
5. Confirm chapter/topic analytics appear for the demo student.
6. Confirm individual test time scores match the Phase 4 formula.
7. Confirm a deliberately incomplete series keeps the overall time score locked.
8. Confirm a complete 10-test series displays the average of all ten test scores.
9. Confirm no individual-question target time exists.
10. Confirm Evidara Admin and Super Admin open the platform command centre.
11. Confirm school drill-down opens the Phase 3 school dashboard.
12. Confirm reset removes the Phase 4 taxonomy evidence only from the generated batch.
