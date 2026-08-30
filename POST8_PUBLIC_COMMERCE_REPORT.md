# Evidara Post-Phase-1 Public Commerce Build

**Date:** 7 August 2026
**Supabase project:** `xzfozpnzvznqrvcsoail`
**Project URL:** `https://xzfozpnzvznqrvcsoail.supabase.co`

## Delivered

- Truthful public homepage for direct students and institutions.
- Public product store as the acquisition entry point.
- Google sign-in return-to-store continuity.
- Independent student model (school membership optional, not a second role).
- Existing Razorpay purchase → verification → entitlement path preserved.
- Referral code capture and one-time attribution.
- ₹100 + ₹100 referral-credit program after the referred student's first >=₹1,000 paid individual order.
- Student Refer & Earn workspace.
- Evidara credit ledger, 30-minute checkout reservations, and captured-payment-only redemption.
- Live create-order Edge Function updated to apply wallet credit safely.
- Targeted public-launch Supabase hardening for staging data, admin commerce RPCs and obsolete role-assignment RPCs.

## Live Supabase migrations applied

- `secure_profiles_authorization`
- `secure_student_resource_access`
- `secure_institution_student_lifecycle`
- `scope_academic_resources`
- `public_student_referrals`
- `evidara_credit_checkout`
- `public_launch_rpc_hardening`
- `public_catalogue_truth_guard`
- `draft_empty_test_series`

## Referral rules

- One referral attribution per referred account.
- Self-referral rejected.
- Must be claimed before first paid individual purchase.
- School purchases do not qualify.
- Qualifying amount: ₹1,000 or more after order pricing.
- Reward: ₹100 credit to referrer and ₹100 welcome credit to referred student.
- Reward is triggered only by a `paid` order.
- Credit checkout reservation expires after 30 minutes.
- Credit is debited only when an order is actually paid.

## Verification

- Public-student smoke: 18/18
- Phase 1 Increment 5–8: 18/18
- Profile authorization: 25/25
- Student live: 22/22
- Increment 3: 29/29
- Increment 4: 36/36
- V13.2 Vercel smoke: 12/12
- Analytics: 47/47
- Live `create-razorpay-order`: ACTIVE, version 6, JWT required.
- Live referral/staging tables: RLS enabled.
- Anonymous execution removed from the checked admin commerce RPCs.

## Remaining pre-publish checks

Run the Windows verification workflow on a machine where npm can install the lockfile. The Chat sandbox's internal npm mirror cannot currently fetch `zwitch@2.0.4`, so it cannot provide a fresh Next.js production build here.

Supabase security advisors also contain a large historical set of SECURITY DEFINER warnings from older Evidara versions. They require a separate call-site audit; mass-revoking them could break active question, exam or analytics workflows.

## Catalogue truth guard

The live store no longer exposes demo test series or published test-series records with zero attached papers. The existing demo product was returned to draft, and empty NEET/JEE test-series records were returned to draft until real papers are attached and an admin explicitly republishes them.
