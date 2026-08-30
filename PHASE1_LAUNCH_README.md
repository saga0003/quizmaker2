# Evidara Phase 1 — Launch Build

## Launch offer

- ₹199 per active student per year
- Unlimited students
- Unlimited tests
- Institution-owned question bank
- Online assessments, results and analytics
- Study Resources remain available in the existing student/school/admin workspaces

## What is parked, not deleted

The existing public/direct-student growth and commerce engines remain in this source tree for future use. Phase 1 hides them from public, student and school-facing navigation and blocks their normal workspace/direct-page entry points. The Phase 1 Supabase migration also revokes anonymous execution of the old public catalogue/SEO RPCs without deleting those functions.

Parked for launch:

- Public Practice
- Public Question Pages
- Public Question Papers
- Test-series marketplace
- Student Store / purchases
- Referral centre
- Public product catalogue
- Direct-student commerce and Razorpay checkout entry points
- Self Assessment for students
- School Product Store / entitlements / product-seat management
- Public PYQ/SEO surfaces

Retained for **Super Admin**:

- Products / commerce administration
- Referral settings
- Self-assessment administration
- PYQ authoring / previous-year-paper management
- Readiness / production diagnostics

Nothing above has been intentionally deleted. The central policy is in `src/config/phase1-launch.ts` so the product can be reopened deliberately later.

## Study Resources

Study Resources were intentionally left live in their existing form for students, schools and platform administrators.

## Question upload

The existing Evidara bulk import engine is retained, but the first interaction has been simplified in the NatSciX style:

1. Choose Excel, CSV or LaTeX file
2. Download templates/import guide if required
3. Evidara validates the questions before saving
4. Missing chapters/topics are surfaced with a one-click "Create all missing taxonomy" action
5. Attach an image ZIP only when local image references require it
6. Continue into Evidara's detailed per-question review when needed
7. Import only ready questions

This preserves Evidara's stronger review/import engine while reducing the normal teacher workflow.

## Public launch surface

The homepage now sells Evidara as an institution assessment platform and displays the founding plan at ₹199/student/year with unlimited students and unlimited tests. Public marketplace/practice/question/PYQ routes redirect to the homepage during Phase 1, and the sitemap/robots configuration no longer promotes those parked surfaces.

## Before production deployment

1. Configure the existing Supabase environment variables and server secret variables.
2. Apply all existing Supabase migrations for the project in order to the target database, including `20260827190000_phase1_park_public_catalogue.sql`.
3. Configure the existing object storage/R2 variables if question/resource file storage is required.
4. Run `npm ci` on a machine/CI runner with npm registry access.
5. Run `npm run qa:phase1-launch`.
6. Run `npm run typecheck` and `npm run lint`.
7. Run `npm run build`.
8. Deploy to Vercel/your existing Next.js host.
9. Sign in as Super Admin and create/activate the first institution subscription using the existing institution/subscription administration.
10. Test one complete journey: teacher upload → paper creation → student attempt → submit → analytics.

## Important

The Phase 1 source policy is intentionally reversible. `supabase/phase1_restore_public_catalogue.sql` restores anonymous catalogue RPC grants when a future public phase is deliberately reopened. Do not delete the parked components/migrations when cleaning production assets; they are the retained foundation for the later public marketplace, PYQ, referral, self-assessment and commerce phases.

## Local one-click dependency repair (Aug 27 hotfix)

`TEST_EVIDARA.bat` now calls `ENSURE_DEPENDENCIES.bat`. On a fresh or damaged install it automatically runs `npm install` so an out-of-sync lockfile is repaired instead of stopping with `npm ci` EUSAGE. Healthy existing dependencies are reused. The V19.1 health check was also corrected from `19.0.0` to `19.1.0`.
