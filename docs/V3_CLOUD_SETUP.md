# ScholarOS Version 3 cloud activation

Version 3 runs immediately in operational local-pilot mode. Cloud mode requires a dedicated Supabase project and three Vercel environment variables.

## 1. Create or select a Supabase project

Use a dedicated project for ScholarOS. Do not reuse a production database belonging to another application.

## 2. Apply database files in order

1. Run `supabase/schema.sql` in the Supabase SQL editor.
2. Run `supabase/migrations/003_cloud_sync_and_rls.sql`.

The migration adds tenant helper functions, role-aware row-level security, an authenticated profile trigger, a versioned workspace bridge, audit infrastructure and explicit protection preventing students from selecting answer keys.

## 3. Create the first organisation and super-admin profile

Create the user through Supabase Authentication, then insert an organisation and update the generated profile.

```sql
insert into public.organisations(name, slug)
values ('ScholarOS Learning Network', 'scholaros-learning-network')
returning id;

update public.profiles
set organisation_id = '<organisation uuid>',
    role = 'super_admin'
where id = '<auth user uuid>';
```

For school and student accounts, include the legacy pilot identifiers in profile metadata during the transition:

```json
{
  "pilot_school_key": "sch1",
  "pilot_student_key": "st1"
}
```

These identifiers let Version 3 filter the existing pilot dataset safely while normalized tables are populated.

## 4. Configure Vercel

Add these variables to Production, Preview and Development:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The service-role key is server-only. Never prefix it with `NEXT_PUBLIC_`, place it in client JavaScript or commit it to GitHub.

Redeploy the Vercel project. `/api/health` should report `hybrid-cloud` and `healthy: true`.

## 5. First cloud sign-in

Sign in as the super admin from the Version 3 login screen. If the organisation has no cloud workspace, ScholarOS automatically bootstraps the current browser pilot dataset. Demonstration passwords are removed before upload.

## Security model

- Supabase Auth establishes identity.
- Vercel APIs validate the bearer token and load the matching profile.
- Organisation and school mappings determine the returned data slice.
- Student questions are redacted before transmission.
- Student submissions are scored by `/api/attempts` using server-held answer keys.
- Writes use optimistic versions to prevent stale-device overwrites.
- Normalized tables have tenant-aware RLS for the post-transition architecture.

## Transition boundary

The versioned workspace is a deliberate migration bridge so the working Version 2 product can become multi-device without rewriting every screen at once. Later releases will move each workflow to normalized tables and storage buckets while preserving the same role boundaries.
