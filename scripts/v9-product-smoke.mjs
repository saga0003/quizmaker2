import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const files = {
  migration: read('supabase/34_v9_product_catalogue.sql'),
  product: read('src/components/commerce/AdminProductManager.tsx'),
  voucher: read('src/components/commerce/AdminVoucherManager.tsx'),
  analytics: read('src/components/commerce/ProductAnalyticsDashboard.tsx'),
  store: read('src/components/commerce/ProductStore.tsx'),
  workspace: read('src/components/commerce/ProductCommerceWorkspace.tsx'),
  edge: read('supabase/functions/create-razorpay-order/index.ts'),
  sidebar: read('src/components/evidara/app-sidebar.tsx'),
};

const checks = [
  ['product-papers relation', files.migration.includes('create table if not exists public.product_papers')],
  ['school seat assignments', files.migration.includes('create table if not exists public.product_seat_assignments')],
  ['URL-only image fields', files.migration.includes('gallery_image_urls') && files.product.includes('HTTPS image link')],
  ['portrait 3:4 cover', files.product.includes('aspect-[3/4]') && files.store.includes('aspect-[3/4]')],
  ['automatic paper count', files.product.includes('paper{form.papers.length === 1 ?') && files.migration.includes("'paper_count'")],
  ['paper storefront naming', files.product.includes('storefront names') && files.migration.includes('display_name text not null')],
  ['student and school audience', files.product.includes('Students and schools') && files.edge.includes('purchase_scope')],
  ['promotion voucher 1 to 10', files.voucher.includes('Array.from({ length: 10 }') && files.migration.includes('not between 1 and 10')],
  ['controlled 100 percent school voucher', files.voucher.includes('100% offline school activation') && files.migration.includes('Only Super Admin can create or edit a 100%%')],
  ['offline seat count', files.voucher.includes('Seats to activate') && files.migration.includes('seat_count')],
  ['daily monthly yearly analytics', files.analytics.includes("'day' | 'month' | 'year'") && files.migration.includes("p_granularity in ('day','month','year')")],
  ['custom date analytics', files.analytics.includes('type="date"') && files.migration.includes('p_from date')],
  ['commerce workspace tabs', files.workspace.includes('Products') && files.workspace.includes('Vouchers') && files.workspace.includes('Analytics')],
  ['admin product access', !files.sidebar.includes("item.view !== 'admin-products'")],
  ['store paper list', files.store.includes('Included question papers') && files.store.includes('selected.papers.map')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} V9 product smoke check(s) failed.`);
  process.exit(1);
}
console.log(`\n${checks.length} V9 product smoke checks passed.`);
