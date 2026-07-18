# ScholarOS — Student Intelligence Platform

ScholarOS is a multi-school assessment and learning-intelligence product for Grades 8–12.

## Product roles

- **Super Admin:** multi-school tenancy, assessment operations, consent and permissioned opportunity intelligence.
- **Organisation Admin:** question quality, test operations, student cohorts and reporting.
- **School Admin:** grade and section performance, high-potential students and teacher interventions.
- **Student:** assessments, post-test diagnosis, topic mastery, speed/accuracy analysis and a measurable learning plan.

## Version 1

This release is a responsive, production-deployed pilot application with realistic demonstration data and working interactions:

- Role switching across four user types
- Multi-school command centre
- School onboarding workflow
- Assessment blueprint studio
- Minor-student consent controls
- Permissioned lead intelligence
- Student assessment experience
- Post-test percentile, accuracy and timing analytics
- Topic mastery heatmap
- Error-cause diagnosis
- Professor-designed remediation plan
- Teacher intervention groups
- Mobile-responsive navigation

## Local run

```bash
npm run build
python3 -m http.server 3000 --directory dist
```

## Production architecture

The next connected release uses Supabase for authentication, tenant isolation, question banks, assessment attempts, response-level timing, psychometrics, mastery snapshots and parent consent. Odoo integration receives only opportunities backed by explicit programme-counselling consent.

See `supabase/schema.sql` and `docs/PRODUCT_ROADMAP.md`.
