-- Future-phase helper. Run deliberately when Evidara reopens these public engines.
grant execute on function public.get_store_products() to anon;
grant execute on function public.get_public_product_v15(text) to anon;
grant execute on function public.get_public_question_v15(text) to anon;
grant execute on function public.list_public_seo_questions_v15(integer, integer) to anon;
grant execute on function public.list_public_products_v15() to anon;
grant execute on function public.list_public_papers_v15() to anon;
grant execute on function public.get_public_paper_v15(text) to anon;
