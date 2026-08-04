# Evidara V9 Product Catalogue and Commerce

V9 builds on `evidara-v8-paper-builder` and adds a complete product lifecycle for question-paper series.

## Product catalogue

- Admin and Super Admin can create and edit student, school or combined-audience products.
- Products bundle approved or published Evidara master question papers.
- Each paper can have a product-specific display name without altering the source paper.
- The included-paper count is compiled automatically.
- The cover uses a 3:4 portrait image URL. Up to eight optional gallery image URLs can be added.
- Evidara stores only links; image files remain on the chosen CDN or website.
- Products support grades, examinations, descriptions, benefits, current price versions, access duration, attempts, default school seats, status and featured placement.

## Vouchers and offline school activation

- Evidara Admin and Super Admin may create promotional vouchers from 1% to 10%.
- Only Super Admin may create a 100% offline-payment activation voucher.
- A 100% voucher must be locked to one product and one school, include the paid amount, receipt/transaction reference and exact seat allocation, and is forced to one redemption.
- Voucher redemption creates a paid order and an auditable school entitlement rather than bypassing commerce records.

## Analytics

The commerce dashboard includes verified revenue, paid orders, distinct student purchases, distinct school purchases, seats sold, voucher redemptions, offline activations, top products and daily/monthly/annual charts with custom date filters.

## Database rollout

Run these migrations in order:

1. `supabase/32_v8_paper_builder.sql`
2. `supabase/33_v8_configurable_assessment_settings.sql`
3. `supabase/34_v9_product_catalogue.sql`

Redeploy `create-razorpay-order` after applying migration 34.
