-- Evidara Phase 1 launch: park anonymous public catalogue / SEO RPC access.
-- The functions and their data are intentionally retained for future phases.
-- Authenticated access remains unchanged so Super Admin tooling can continue to
-- inspect/develop the retained engines behind the Phase 1 application policy.

revoke execute on function public.get_store_products() from anon;
revoke execute on function public.get_public_product_v15(text) from anon;
revoke execute on function public.get_public_question_v15(text) from anon;
revoke execute on function public.list_public_seo_questions_v15(integer, integer) from anon;
revoke execute on function public.list_public_products_v15() from anon;
revoke execute on function public.list_public_papers_v15() from anon;
revoke execute on function public.get_public_paper_v15(text) from anon;
