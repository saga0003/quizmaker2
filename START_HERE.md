# ScholarOS Version 1 — Start Here

This package contains a working responsive web application, a demo examination, database scripts, trial question import files, and deployment instructions.

## What you can open before any setup

After installing the project locally, you can immediately open:

- `/` — public homepage
- `/login/` — Google/email login screen in Demo Mode
- `/student/` — student analytics preview
- `/school/` — school dashboard preview
- `/school/register/` — school registration preview
- `/admin/` — super-admin dashboard preview
- `/trial/` — working 8-question trial examination
- `/setup-check/` — connection status page

## Follow the documents in this exact order

1. `docs/01_WINDOWS_LOCAL_SETUP.md`
2. `docs/02_SUPABASE_DATABASE_SETUP.md`
3. `docs/03_EMAIL_AND_GOOGLE_LOGIN.md`
4. `docs/04_TEST_EVERY_FEATURE.md`
5. `docs/05_HOSTINGER_GO_LIVE.md`
6. `docs/06_AFTER_GOING_LIVE.md`
7. `docs/07_COMMON_ERRORS.md`

Do not begin with Hostinger. First confirm the project works locally, then connect Supabase, then configure Google login, and only then upload the live build.

## Two ZIP files

- `rankmint-tests-v1-source.zip` — source code you edit and rebuild.
- `rankmint-tests-v1-hostinger-demo.zip` — already-built Demo Mode website for immediate Hostinger preview. This demo does not contain your Supabase keys.

## Main rule

Never send or upload a Supabase secret key or service-role key to the browser. Version 1 only needs the public Project URL and publishable key.
