-- Resolve an onboarding School Admin account without scanning the Auth Admin API.
-- This remains service-role-only and exposes only the minimum fields needed by
-- the institution onboarding route.

create or replace function public.resolve_onboarding_account_by_email(p_email text)
returns table (
  user_id uuid,
  profile_role text,
  full_name text,
  phone text,
  active_memberships bigint
)
language sql
security definer
set search_path = ''
as $$
  select
    u.id as user_id,
    p.role::text as profile_role,
    p.full_name,
    p.phone,
    (
      select count(*)::bigint
      from public.organization_members om
      where om.user_id = u.id
        and om.is_active = true
    ) as active_memberships
  from auth.users u
  left join public.profiles p on p.id = u.id
  where pg_catalog.lower(pg_catalog.btrim(coalesce(u.email, ''))) =
        pg_catalog.lower(pg_catalog.btrim(coalesce(p_email, '')))
  limit 1;
$$;

revoke all on function public.resolve_onboarding_account_by_email(text) from public, anon, authenticated;
grant execute on function public.resolve_onboarding_account_by_email(text) to service_role;
