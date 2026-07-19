# Evidara V6.6 — Cloud Benchmark Operations

V6.6 connects shared-paper benchmarks to the production exam tables.

## Live workflow

1. A school selects a published question paper.
2. Evidara calculates a SHA-256 fingerprint from the exact paper, sections, questions, marks and scoring settings.
3. The school creates and publishes a benchmark window with a student access code.
4. A student joins with that code and receives a normal secure Evidara exam attempt.
5. Submission triggers automatic contribution validation.
6. The school sees its own named cohort.
7. External results remain anonymous and locked until at least 20 external attempts from at least 3 external schools exist.

## Automatic exclusions

- Submission outside the benchmark window
- Missing or invalid maximum marks
- Paper fingerprint mismatch
- Attempt-version mismatch
- More integrity events than the publication allows
- Explicitly invalidated attempt
- Duplicate student contribution

## Database migrations

Apply migrations in numeric order through:

- `11_shared_benchmarks.sql`
- `12_benchmark_aggregate_function.sql`
- `13_benchmark_cloud_operations.sql`
- `14_benchmark_operation_hardening.sql`

## Cloud routes

- `/api/benchmarks`
- `/school/benchmarks/`
- `/school/benchmarks/publish/`
- `/student/benchmarks/`
- `/admin/benchmarks/`

Automatic Vercel Git deployment remains paused. Test this version through GitHub Actions and Codespaces.
