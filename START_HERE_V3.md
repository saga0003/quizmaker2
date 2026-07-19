# ScholarOS Version 3 — Start Here

Version 3 adds the Question Bank and Bulk Upload Engine.

## Upgrade order

1. Keep your live Version 2 folder as a backup.
2. Extract Version 3 into a new computer folder.
3. Copy your existing `.env.local` and completed `src/config/site.ts` values into Version 3.
4. Run `npm.cmd install`.
5. In Supabase SQL Editor, run `supabase/05_version_3_question_bank.sql` once.
6. In Supabase Authentication → Sign In / Providers → Email, turn **Confirm email OFF**.
7. Run `npm.cmd run dev` and test the question-bank pages locally.
8. Run `powershell.exe -ExecutionPolicy Bypass -File .\scripts\BUILD_FOR_HOSTINGER.ps1`.
9. Upload every item inside the generated `out` folder directly into the live subdomain `public_html`.
10. Hard-refresh the live website and test the Version 3 checklist.

Detailed instructions are in `VERSION3_LIVE_UPGRADE_GUIDE.md`.
