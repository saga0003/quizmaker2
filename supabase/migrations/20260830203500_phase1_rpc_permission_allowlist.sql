-- Evidara Phase 1 P0.11 — explicit RPC permission allowlist.
--
-- Policy:
--   * SECURITY DEFINER routines are never executable through the implicit PUBLIC grant.
--   * Existing authenticated application access is preserved explicitly.
--   * anon may execute only the small compatibility allowlist below.
--
-- Phase 1 does not depend on the legacy public catalogue, but its read-only RPCs are
-- intentionally retained during the hardening transition so the currently deployed
-- public site is not broken before final production promotion.

do $$
declare
  r record;
begin
  for r in
    select p.oid,
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
    execute format('grant execute on function %s to authenticated', r.signature);
  end loop;
end
$$;

-- Intentionally anonymous compatibility surface.
-- Public catalogue reads are read-only and retained only until the Phase 1 navigation
-- permanently removes those legacy surfaces. create_institute is the existing public
-- institution-interest/lead RPC; is_username_available supports pre-auth account setup.
do $$
declare
  r record;
begin
  for r in
    select p.oid,
           format('%I.%I(%s)', n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and p.proname = any(array[
        'create_institute',
        'is_username_available',
        'get_public_paper_v15',
        'get_public_product_v15',
        'get_public_question_v15',
        'get_store_products',
        'list_public_papers_v15',
        'list_public_products_v15',
        'list_public_seo_questions_v15'
      ]::text[])
  loop
    execute format('grant execute on function %s to anon', r.signature);
  end loop;
end
$$;

comment on function public.create_institute(text,text,text,text,text,text) is
  'P0.11 anonymous allowlist: public institution-interest lead submission. Review/remove when public lead flow is replaced.';
