# Evidara V14 — Build Report

**Source version:** 14.0.0  
**Confirmed Supabase project:** `xzfozpnzvznqrvcsoail`  
**Database endpoint:** `https://xzfozpnzvznqrvcsoail.supabase.co`

## V14 source included

- Expanded Student navigation with Results, Self Assessment and Refer & Earn.
- Public referral promotion is hidden/disabled for school-enrolled students.
- Teacher dashboard uses live scoped counts and Teacher navigation uses **My Questions**.
- School Admin navigation uses school-owned questions only; Evidara master question-bank access is not exposed to school roles.
- Evidara Admin works with Evidara-owned questions, papers and resources; school-created question access is not exposed in its active question-bank view.
- Super Admin navigation expanded with Institutions, Resources, Referral Settings, Self Assessment and Access & Accounts.
- V14 Access & Accounts uses server-only scoped directory and role-management RPCs.
- Bulk CSV account import supports arbitrary column-header mapping, preview and up to 1,000 rows.
- School Student Lifecycle exposes the same Bulk CSV importer.
- Structured Resources supports folder/subfolder hierarchy and PDF/Office/CSV/text/image files stored through Cloudflare R2.
- Students browse the same school resource hierarchy read-only and can access authorized Evidara resources.
- Super Admin resource inventory and institution drill-down views are included.
- Institutions module includes school/subscription/resource summaries and per-school payment-history drill-down.
- Aggregate revenue remains Super-Admin-only; Evidara Admin sees payment details only on institution drill-down.
- Super Admin referral settings UI is connected to the V14 referral settings RPC.
- Self Assessment wallet/generator UI is connected to the live V14 server RPCs.
- School students receive the database-defined included assessment-credit model; direct students use referral/top-up credits.
- NEET full mock protection is represented in the V14 flow (180 maximum; 45 Physics, Chemistry, Botany and Zoology).
- Evidara Admin question/paper publication remains subject to Super Admin governance.

## Live Supabase V14 migrations already present

- `20260807151858_v14_role_resources_self_assessment`
- `20260807152437_v14_account_directory_and_role_management`
- `20260807152640_v14_self_assessment_exam_materialization`
- `20260807152754_v14_self_assessment_credit_product`
- `20260807153653_v14_subscription_lifecycle_schedule`

These were applied to the confirmed Supabase project above during the V14 work. Marker files are retained under `supabase/migrations/` so the local source records the remote migration versions.

## Verification completed in this build environment

- V14 Vercel/source smoke: **12/12**
- Analytics smoke: **47/47**
- Profile authorization: **25/25**
- Student live dashboard/resources: **22/22**
- Increment 3: **29/29**
- Increment 4: **36/36**
- Increment 5–8: **18/18**
- Public student commerce: **18/18**
- V14 role/resource/self-assessment smoke: **25/25**
- TypeScript parser: **221 TS/TSX application files parsed with 0 syntax failures**

## Environment limitation

A fresh `npm ci` could not complete inside the ChatGPT build sandbox because its internal package mirror returns HTTP 404 for `zwitch@2.0.4`. Therefore the full Next.js `typecheck -> lint -> build` was not executed here after the final V14 source edits. Run `VERIFY_EVIDARA.bat` on the Windows computer before publishing. That script does not intentionally modify Supabase or deploy the application.

## Before production publish

1. Copy the existing working `.env.local` into this V14 project folder.
2. Run `TEST_EVIDARA.bat` and manually check each role.
3. Run `VERIFY_EVIDARA.bat`.
4. Publish only after the local TypeScript/lint/Next.js build passes.
