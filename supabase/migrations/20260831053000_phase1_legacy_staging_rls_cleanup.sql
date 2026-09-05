-- Phase 1 A4: legacy import/recovery tables are operational artifacts only.
-- Application browser roles have no direct grants and no runtime code references.
-- Keep access limited to postgres/service_role while enabling RLS so future grants fail closed.

alter table public.evidara_import_staging_v4 enable row level security;
alter table public.evidara_batch004_recovery_audit enable row level security;

revoke all on table public.evidara_import_staging_v4 from public, anon, authenticated;
revoke all on table public.evidara_batch004_recovery_audit from public, anon, authenticated;

-- evidara_batch004_staging already has RLS enabled with no browser policies; normalize grants too.
revoke all on table public.evidara_batch004_staging from public, anon, authenticated;
