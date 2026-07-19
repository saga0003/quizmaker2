# Evidara V6.6 — Cloud Benchmark Operations

V6.6 connects shared-paper benchmarks to the production question-paper and exam-attempt tables.

## Live workflow

1. A school selects one of its published question papers.
2. Evidara calculates a SHA-256 fingerprint from the exact paper, sections, questions, marks and scoring settings.
3. The school creates and publishes a benchmark window with a student access code.
4. A student with an active school membership joins using that code.
5. Evidara creates a normal secure exam attempt tagged with the benchmark publication and the student’s school.
6. Submission triggers automatic contribution validation.
7. The school sees only its own named cohort.
8. External results remain anonymous and locked until at least 20 external attempts from at least 3 external schools exist.

## Automatic exclusions

- Submission outside the benchmark window
- Submission after a manually closed window
- Missing or invalid maximum marks
- Paper fingerprint mismatch
- Attempt-version mismatch
- More integrity events than the publication permits
- Explicitly invalidated attempt
- Duplicate student contribution

## Tenant and identity controls

- Students receive only benchmarks they have submitted; benchmark access codes are not listed to student accounts.
- School staff receive publications their school owns or in which their students participated.
- Only the publishing school can publish, close or backfill its benchmark window.
- Participating schools can review only their own named student contributions.
- Automatically excluded attempts require Super Admin review before restoration.
- No school can view another school’s student names, exact attempts or access-controlled publication data.

## Lifecycle controls

- Draft publications may be published or cancelled.
- Published publications may be closed or cancelled.
- Closed and cancelled publications cannot be reopened.
- An earlier ordinary attempt on the same paper does not consume the benchmark opportunity.
- Each learner contributes only the first submitted benchmark attempt for a publication.
- Backfill can refresh validation for the same attempt without replacing it with a later attempt.

## Database migrations

Apply migrations in numeric order through:

- `11_shared_benchmarks.sql`
- `12_benchmark_aggregate_function.sql`
- `13_benchmark_cloud_operations.sql`
- `14_benchmark_operation_hardening.sql`
- `15_benchmark_security_and_lifecycle_hardening.sql`

## Cloud routes

- `/api/benchmarks`
- `/school/benchmarks/`
- `/school/benchmarks/publish/`
- `/student/benchmarks/`
- `/admin/benchmarks/`

Automatic Vercel Git deployment remains paused. Validate through GitHub Actions and test through GitHub Codespaces before intentionally publishing production.
