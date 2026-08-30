import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let passed = 0;
let failed = 0;

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}
function check(name, condition) {
  if (condition) {
    console.log(`PASS ${name}`);
    passed += 1;
  } else {
    console.error(`FAIL ${name}`);
    failed += 1;
  }
}

const policy = read('src/config/phase1-launch.ts');
check('launch price is 199 per student', policy.includes('studentPriceInrPerYear: 199'));
check('question bank is teacher maintained', policy.includes('teacherMaintainedQuestionBank: true'));
check('study resources remain enabled', policy.includes('studyResources: true'));
for (const view of ['student-store','student-purchases','student-referrals','student-self-assessment','school-store','school-entitlements','school-product-seats']) {
  check(`${view} hidden for Phase 1`, policy.includes(`'${view}'`));
}
for (const view of ['admin-products','admin-referrals','admin-self-assessment']) {
  check(`${view} retained as super-admin-only`, policy.includes(`'${view}'`));
}

const workspace = read('src/lib/workspaceViews.ts');
check('direct workspace URLs use Phase 1 policy', workspace.includes('phase1AllowsWorkspaceView(user.accessRole, view)'));

const sidebar = read('src/components/evidara/app-sidebar.tsx');
const mobile = read('src/components/evidara/mobile-top-bar.tsx');
check('desktop nav uses Phase 1 policy', sidebar.includes('phase1AllowsWorkspaceView'));
check('mobile nav uses Phase 1 policy', mobile.includes('phase1AllowsWorkspaceView'));
check('student study resources retained on desktop', sidebar.includes("view: 'student-resources'"));
check('school study resources retained on desktop', sidebar.includes("view: 'school-resources'"));

const landing = read('src/components/evidara/landing-page.tsx');
check('landing shows Rs 199 student annual price', landing.includes('₹199') && landing.includes('/ student / year'));
check('landing sells per-student licensed access', landing.includes('Per-student annual access') && landing.includes('₹199 per active student per year'));
check('landing does not promise unlimited students', !landing.includes('Unlimited students'));
check('landing sells unlimited tests', landing.includes('Unlimited tests'));
check('landing keeps study resources in offer', landing.includes('Study resources'));

const importer = read('src/components/evidara/question-bulk-import-dialog-core.tsx');
check('simple importer title', importer.includes('Excel, CSV or LaTeX import'));
check('simple choose file action', importer.includes('Choose file'));
check('taxonomy assistance preserved', importer.includes('Create all missing taxonomy'));
check('image ZIP support preserved', importer.includes('Image ZIP template'));

const gates = [
  ['src/app/products/page.tsx','publicProducts'],
  ['src/app/products/[slug]/page.tsx','publicProducts'],
  ['src/app/test-series/page.tsx','publicTestSeries'],
  ['src/app/test-series/[slug]/page.tsx','publicTestSeries'],
  ['src/app/question-papers/page.tsx','publicQuestionPapers'],
  ['src/app/question-papers/[slug]/page.tsx','publicQuestionPapers'],
  ['src/app/questions/[slug]/page.tsx','publicQuestionPages'],
  ['src/app/practice/[exam]/[subject]/[chapter]/[topic]/page.tsx','publicPractice'],
  ['src/app/trial/page.tsx','publicPractice'],
];
for (const [file, feature] of gates) {
  const src = read(file);
  check(`${file} gated`, src.includes(`requirePhase1PublicFeature('${feature}')`) || src.includes(`requirePhase1PublicFeature(\"${feature}\")`));
}

const readiness = read('src/app/admin/readiness/page.tsx');
check('readiness UI super-admin-only', readiness.includes('superAdminOnly'));
const papers = read('src/components/evidara/live-paper-catalogue-v8.tsx');
check('PYQ manager super-admin-only', papers.includes("kind === 'admin' && role === 'super_admin' && <PyqPaperManager"));
const qEditor = read('src/components/evidara/question-editor-dialog.tsx');
check('PYQ occurrence editor super-admin restricted', qEditor.includes("role === 'super_admin'"));

const publicLock = read('supabase/migrations/20260827190000_phase1_park_public_catalogue.sql');
check('anonymous product catalogue RPC is parked', publicLock.includes('revoke execute on function public.get_store_products() from anon'));
check('anonymous SEO question RPC is parked', publicLock.includes('revoke execute on function public.get_public_question_v15(text) from anon'));
check('future public restore helper is retained', read('supabase/phase1_restore_public_catalogue.sql').includes('grant execute on function public.get_public_product_v15(text) to anon'));

const robots = read('src/app/robots.ts');
check('robots hide parked public engines', ['/products/','/test-series/','/question-papers/','/questions/','/practice/','/trial/'].every((v)=>robots.includes(v)));
const sitemap = read('src/app/sitemap.ts');
check('sitemap no longer exposes parked engines', !sitemap.includes('/products/') && !sitemap.includes('/test-series/') && !sitemap.includes('/question-papers/'));

console.log(`\nPhase 1 launch smoke: ${passed} passed, ${failed} failed.`);
if (failed) process.exit(1);
