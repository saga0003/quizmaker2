begin;

-- TOTP/AAL2 is temporarily disabled while Evidara evaluates a replacement
-- privileged-access mechanism. Keep the existing role and tenant checks intact.
create or replace function public.evidara_privileged_mfa_satisfied_v20()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    current_setting('request.jwt.claim.role', true) = 'service_role'
    or auth.uid() is not null,
    false
  )
$$;

revoke all on function public.evidara_privileged_mfa_satisfied_v20() from public, anon, authenticated;

comment on function public.evidara_privileged_mfa_satisfied_v20()
is 'Temporary Phase 1 rollback: privileged TOTP/AAL2 requirement is paused; authenticated role and tenant authorization checks remain enforced.';

commit;
