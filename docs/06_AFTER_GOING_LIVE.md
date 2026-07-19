# 06 — After Going Live

## Immediate security checks

1. Confirm `.env.local` was never uploaded to Hostinger.
2. Confirm no secret key exists in the source code.
3. Confirm Supabase RLS is enabled on all Version 1 tables.
4. Open Supabase Security Advisor and review warnings.
5. Confirm only your registered account is super admin.
6. Use a strong Google and Supabase account password.
7. Enable two-factor authentication on GitHub, Google, Supabase, Hostinger, and Razorpay accounts.

## Create three test identities

Use three different emails:

1. Super-admin account.
2. School-owner account.
3. Student account.

This prevents confusion while testing roles.

## Backups

1. Keep the source ZIP safely.
2. Keep the source in a private GitHub repository later.
3. Save the database schema SQL in the repository.
4. Before major database changes, export important Supabase tables.
5. Never depend only on the files uploaded to Hostinger.

## Version 1 limitations

Version 1 intentionally does not yet include:

- Paid products
- Razorpay orders
- Real question upload UI
- Full exam creation
- Stored exam attempts
- Live student analytics from attempts
- School staff invitations
- Strict route guards
- Proctoring

It provides the working foundation and preview test. These modules are added in the following versions without replacing the platform.

## Next build target: Version 2

Version 2 will add:

- Admin-created products
- Original price, selling price, and automatic discount display
- Test-series and school plans
- Razorpay test mode
- Server-side order creation using Supabase Edge Functions
- Signature verification
- Webhooks
- Payment records
- Instant entitlements
- Manual access grants
