do $$
declare r record;
begin
  for r in select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('admin_list_products_v9','admin_upsert_product','admin_upsert_product_v9','admin_upsert_voucher','admin_upsert_voucher_v9','list_product_builder_papers_v9','get_product_commerce_analytics_v9')
  loop
    execute format('revoke all on function %s from public, anon',r.sig);
    execute format('grant execute on function %s to authenticated',r.sig);
  end loop;
  for r in select p.oid::regprocedure::text sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('assign_evidara_role','assign_evidara_role_by_email','assign_evidara_school_role_by_email')
  loop
    execute format('revoke all on function %s from public, anon, authenticated',r.sig);
    execute format('grant execute on function %s to service_role',r.sig);
  end loop;
end $$;
