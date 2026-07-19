# ScholarOS — Student Intelligence Platform

ScholarOS is a multi-school assessment and learning-intelligence product for Grades 8–12.

## Product roles

- **Super Admin:** multi-school tenancy, cloud operations, assessment quality, consent and permissioned opportunity intelligence.
- **Organisation Admin:** question quality, test operations, student cohorts and reporting.
- **School Admin:** grade and section performance, high-potential students and teacher interventions.
- **Student:** assessments, secure server scoring, post-test diagnosis, speed/accuracy analysis and a measurable learning plan.

## Version 3

Version 3 adds a hybrid-cloud production layer without disabling the working browser pilot:

- Supabase email/password and magic-link authentication support
- Authenticated Vercel server functions
- Versioned multi-device workspace synchronization
- Role-filtered organisation, school and student data
- Optimistic conflict protection
- Server-side student scoring
- Redacted student question payloads with no browser answer keys
- Tenant-aware row-level security migration
- Cloud health and operations dashboard
- Automatic local-pilot fallback when cloud credentials are absent

Version 2 workflows remain operational in local mode, including school onboarding, student import, question creation, assessment publishing, completed attempts, analytics, interventions, consent controls and CSV exports.

## Local run

```bash
npm run build
python3 -m http.server 3000 --directory dist
```

Static local hosting runs the pilot interface. Vercel server functions are required for `/api/config`, `/api/health`, `/api/sync` and `/api/attempts`.

## Cloud activation

1. Apply `supabase/schema.sql`.
2. Apply `supabase/migrations/003_cloud_sync_and_rls.sql`.
3. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
4. Redeploy and verify `/api/health`.

See `docs/V3_CLOUD_SETUP.md` for the complete setup and account-mapping instructions.

## Data principles

Academic evidence is never treated as marketing consent. Odoo exports contain only records backed by explicit programme-counselling permission. Student cloud clients do not receive answer keys; scoring occurs on the server.
