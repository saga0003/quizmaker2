# Security Notes

- Only the Supabase Project URL and publishable key belong in browser environment variables.
- Never add Supabase secret/service-role keys to `.env.local` for this static frontend.
- Never add a Razorpay secret to any `NEXT_PUBLIC_` variable.
- Future Razorpay secrets will be stored in Supabase Edge Function secrets.
- Row Level Security is enabled by `supabase/01_version_1_schema.sql`.
- Dashboard route hiding is not a substitute for database security.
- Strict route guards and full admin CRUD authorization will be expanded with the real modules.
- Enable two-factor authentication on Hostinger, Supabase, Google, GitHub and Razorpay.
- Keep `.env.local` out of ZIP files shared publicly.
