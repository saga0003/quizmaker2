# ScholarOS Version 4 — Start Here

Version 4 fixes ZIP image uploads and adds the first complete question-paper and timed online-test workflow.

## Upgrade order

1. Keep your working Version 3 folder as a backup.
2. Extract the Version 4 source into a new `V4` folder.
3. Copy `.env.local` from Version 3 into the Version 4 project root.
4. Copy your completed `src/config/site.ts` business details if they differ.
5. Run `npm.cmd install` in the Version 4 project folder.
6. Run `supabase/07_version_4_exam_builder.sql` in Supabase SQL Editor.
7. Run `npm.cmd run dev`.
8. Test the image-format CSV and ZIP on `/admin/questions/import/`.
9. Create a paper at `/admin/papers/new/`, preview it and publish it.
10. Sign in as a student, open `/student/tests/`, take the test and submit it.
11. Run `scripts/BUILD_FOR_HOSTINGER.ps1` and upload every item inside `out` directly to the live subdomain `public_html`.

Read `VERSION4_LIVE_UPGRADE_GUIDE.md` before replacing the live site.
