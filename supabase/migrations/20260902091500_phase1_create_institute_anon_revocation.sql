-- Evidara Phase 1 security follow-up — create_institute is authenticated-only.
--
-- P0.11 originally retained anonymous EXECUTE for create_institute under the
-- assumption that it was a public lead-capture RPC. The live function is not a
-- lead endpoint: it requires auth.uid() and creates a real institution plus owner
-- membership. Keep the RPC callable by authenticated users, but remove needless
-- anonymous/PUBLIC attack surface.

revoke execute on function public.create_institute(text, text, text, text, text, text)
  from public, anon;

grant execute on function public.create_institute(text, text, text, text, text, text)
  to authenticated;

comment on function public.create_institute(text, text, text, text, text, text) is
  'Phase 1 authenticated institution onboarding RPC. Anonymous execution is intentionally revoked.';
