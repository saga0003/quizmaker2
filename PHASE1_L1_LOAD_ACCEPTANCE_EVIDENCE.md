# Phase 1 L1 Load Acceptance Evidence

Date: 5 Sep 2026
Scope: existing isolated synthetic acceptance tenant only: `Evidara School` (`evidara-school-acceptance`) in the existing SMIS QP Supabase project.

## L1 — 2,000 students/institution test dataset

Preflight was guarded before mutation:

- Acceptance organization: `4effce90-bccb-4263-9f5a-a75b6df301f2`
- Existing membership count: exactly 100
- Existing tagged Phase-1 load auth users: 0
- Existing synthetic acceptance subscription seat limit: exactly 100
- No St. Mary's or future-client tenant rows were selected or mutated.

To exercise the required 2,000-student institution scale without creating another project or tenant, the existing Evidara School synthetic subscription was temporarily scaled from 100 to 2,000 seats for the load-acceptance cycle. The existing institution licence enforcement trigger remained enabled.

1,900 deterministic synthetic learners (`phase1-load-student-0101@evidara.invalid` through `phase1-load-student-2000@evidara.invalid`) were then inserted as real Supabase auth-backed identities rather than membership-only placeholders. Each load learner has:

- one `auth.users` row with `authenticated` role/audience and confirmed synthetic email;
- one matching `auth.identities` email-provider identity;
- one `public.profiles` row created by the normal `on_auth_user_created` / `handle_new_user()` path;
- one active `public.student_school_memberships` row in only `evidara-school-acceptance`;
- Grade 11 / Section A / ISC / NEET synthetic acceptance scope;
- deterministic metadata tags `phase1_load=true`, `acceptance_org=evidara-school-acceptance`, and `synthetic_index` for guarded cleanup.

The same transaction required these postconditions before commit:

- Evidara School memberships = **2,000**
- newly tagged Phase-1 load `auth.users` = **1,900**
- matching tagged profiles = **1,900**
- matching tagged auth identities = **1,900**

All four assertions passed atomically.

After L2/L3 tagged scale fixtures had already been durably evidenced and removed with exact-count guards, database physical size after staging L1 was **361,661,675 bytes**, below the earlier approximately 421.5 MB L2/L3 footprint.

The 1,900 load identities and temporary 2,000-seat limit remain deliberately tagged for guarded cleanup after L4-L6 evidence is complete. Permanent production was not promoted or changed.

## Safety

- Existing Supabase project reused; no new paid project created.
- Only `evidara-school-acceptance` was modified.
- No St. Mary's/future-client data was read for fixture generation or changed.
- Existing licence/membership enforcement remained active.
- Synthetic rows are deterministic and explicitly tagged for exact-count cleanup.
- Production remains protected pending complete R/L/Z acceptance.
