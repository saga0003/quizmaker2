# Version 2 Security Notes

1. Razorpay Key Secret is never read by the Hostinger frontend.
2. The create-order function authenticates the Supabase user token manually.
3. The verify-payment function checks the Razorpay HMAC signature server-side.
4. The webhook verifies `x-razorpay-signature` against the raw request body.
5. Entitlements are created only by the service-role database path after verification.
6. Payment fulfilment is idempotent, preventing duplicate coupon use and duplicate access from browser verification plus webhook delivery.
7. Products are publicly exposed only through `get_store_products()`, which returns published/current products.
8. Admin product writes require the `super_admin` role.
9. Orders, payments and entitlements are protected using Row Level Security.
10. Do not disable RLS or expose Supabase secret/service keys.

Before processing real payments, add legal pages (Terms, Privacy, Refund/Cancellation, Contact and Pricing disclosures), complete Razorpay KYC/website verification, and perform an end-to-end Test Mode review.
