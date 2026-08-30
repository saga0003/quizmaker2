# Evidara Phase 1 Launch Build Report

Date: 2026-08-27
Base: Evidara V19.1 LaTeX Paper Import Merged
Reference UX: NatSciX V6 Import Centre

## Implemented

- College-first public landing page with ₹199/student/year founding plan
- Unlimited students / unlimited tests positioning
- Central reversible Phase 1 feature policy
- Public practice, public questions, public papers, public test series and public products parked
- Student Store, Purchases, Referral and Self Assessment parked
- School Product Store, Entitlements and Product Seat Management parked
- Products, Referral Settings and Self Assessment retained for Super Admin
- Readiness retained for Super Admin
- PYQ authoring/official previous-year-paper controls retained for Super Admin
- Study Resources retained in existing student, school and admin workspaces
- Desktop/mobile/direct workspace access all use Phase 1 policy
- Sitemap and robots no longer advertise parked public engines
- Anonymous public catalogue/SEO RPC execution revoked by the final Phase 1 Supabase migration; restore helper supplied for a future public phase
- Bulk question import entry simplified in NatSciX style while preserving Evidara validation, taxonomy repair, image ZIP, review and import capabilities
- Existing CSS/component system retained

## QA executed in this build environment

- Phase 1 launch smoke: 42/42 passed
- Phase 1 institution increment 5-8 smoke: 18/18 passed
- Live institution analytics: 48/48 checks passed
- Profile authorization smoke: 25/25 passed
- Student live dashboard/resources smoke: 22/22 passed
- V18 PYQ/Paper Engine: 41/41 passed
- V19.1 LaTeX Paper Import: 19/19 passed
- Changed-file TypeScript/TSX syntax transpile: 27/27 passed, 0 syntax diagnostics

## Environment limitation

A fresh `npm ci` / production Next.js build could not be completed in this execution container because the npm registry was unreachable (`EAI_AGAIN`) and one required package was not present in the local npm cache. This is an environment/network limitation, not a reported application QA failure.

Before production deployment, run on a normal internet-connected development/CI machine:

```bash
npm ci
npm run qa:phase1-launch
npm run typecheck
npm run lint
npm run build
```

Then apply all Supabase migrations, including:

`supabase/migrations/20260827190000_phase1_park_public_catalogue.sql`

Finally test one complete institution flow before opening marketing traffic: teacher import → paper publish → student attempt → submit → analytics.
