# Start Here — ScholarOS Version 2

1. Read `LIVE_DEPLOYMENT_GUIDE.md` from the beginning.
2. Create `tests.YOURDOMAIN.com` in Hostinger.
3. Create a Supabase Free project.
4. Run SQL files `01`, `03`, then `04`.
5. Create `.env.local` using `.env.example`.
6. Build and upload the Hostinger frontend.
7. Configure production Auth URLs and Brevo SMTP.
8. Register your account and run `02_make_me_super_admin.sql`.
9. Configure Google login.
10. Generate Razorpay Test Mode keys.
11. Set Supabase Edge Function secrets and deploy all three functions.
12. Add the Razorpay Test webhook.
13. Complete one successful and one failed Test Mode payment.

The fastest build command after `.env.local` is ready:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\BUILD_FOR_HOSTINGER.ps1
```
