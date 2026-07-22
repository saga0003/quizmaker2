import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const passes = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return "";
  return fs.readFileSync(absolutePath, "utf8");
}

function expect(label, condition, message) {
  if (condition) passes.push(label);
  else failures.push(`${label}: ${message}`);
}

const packageJson = JSON.parse(read("package.json") || "{}");
const rolesSource = read("src/lib/roles.ts");
const roleMigration = read("supabase/25_role_access_control.sql");
const compatibilityMigration = read("supabase/26_v7_role_compatibility.sql");
const accessMigration = read("supabase/27_v7_question_access_governance.sql");
const completionMigration = read("supabase/28_v7_question_module_completion.sql");
const pageRouter = read("src/app/page.tsx");
const questionBank = read("src/components/evidara/live-question-bank.tsx");
const questionEditor = read("src/components/evidara/question-editor-dialog.tsx");
const questionImporter = read("src/components/evidara/question-bulk-import-dialog.tsx");
const questionSettings = read("src/components/evidara/question-taxonomy-settings.tsx");
const taxonomyApi = read("src/app/api/question-taxonomy/route.ts");
const questionPreview = read("src/components/evidara/question-device-preview.tsx");
const questionReview = read("src/components/evidara/question-review-dialog.tsx");
const workbook = read("src/lib/questionTemplateWorkbook.ts");
const exportSource = read("src/lib/questionExport.ts");
const importParser = read("src/lib/questionImport.ts");
const paperCatalogue = read("src/components/evidara/live-paper-catalogue.tsx");
const studentTests = read("src/components/evidara/live-student-tests.tsx");
const demoBootstrap = read("scripts/bootstrap-sales-demo.mjs");

expect("package version", packageJson.version === "7.0.0", `expected 7.0.0, received ${packageJson.version ?? "missing"}`);
expect("Supabase dependency", Boolean(packageJson.dependencies?.["@supabase/supabase-js"]), "@supabase/supabase-js is missing");
expect("Prisma dependency removed", !packageJson.dependencies?.prisma && !packageJson.dependencies?.["@prisma/client"], "Prisma packages must not be present");
expect("Cloudflare adapter restored", Boolean(packageJson.devDependencies?.["@opennextjs/cloudflare"]), "Cloudflare OpenNext adapter is missing");
expect("V7 interface", exists("src/components/evidara/landing-page.tsx") && exists("src/components/evidara/admin-views.tsx"), "V7 interface files are missing");
expect("Supabase auth bridge", exists("src/components/evidara/v7-auth-bridge.tsx") && read("src/components/evidara/v7-auth-bridge.tsx").includes("useAuth"), "V7 Supabase auth bridge is missing");
expect("V7 login uses Supabase", read("src/components/evidara/login-page.tsx").includes("signInWithPassword") && read("src/components/evidara/login-page.tsx").includes("signInWithOAuth"), "V7 login is not connected to Supabase");
expect("V7 release health", read("src/app/api/health/route.ts").includes('release: "7.0.0"'), "health endpoint is not reporting V7");
expect("five canonical roles", ["super_admin", "evidara_admin", "school_admin", "school_teacher", "student"].every((role) => rolesSource.includes(`"${role}"`)), "one or more canonical roles are missing");
expect("role permission model", rolesSource.includes("hasEvidaraPermission") && rolesSource.includes("canAccessEvidaraWorkspace"), "role permission helpers are missing");
expect("role migration", exists("supabase/25_role_access_control.sql") && roleMigration.includes("assign_evidara_role_by_email"), "Supabase role migration or assignment RPC is missing");
expect("role compatibility migration", compatibilityMigration.includes("compatible_member_role") && compatibilityMigration.includes("is_evidara_school_staff"), "V7 legacy permission compatibility is missing");
expect("question access migration", accessMigration.includes("module_access_settings") && accessMigration.includes("question_import_batches"), "question module access migration is missing");
expect("question publication migration", completionMigration.includes("enforce_question_publication_permissions") && completionMigration.includes("Teachers can save a draft"), "question publication role guard is missing");
expect("school role isolation", read("src/app/api/school-platform/route.ts").includes("schoolStaff") && read("src/app/api/school-platform/route.ts").includes("School Admin permission is required"), "school teacher/admin boundaries are missing");
expect(
  "live V7 question bank",
  questionBank.includes("QuestionEditorDialog")
    && questionBank.includes("QuestionBulkImportDialog")
    && questionBank.includes("QuestionReviewDialog")
    && questionBank.includes("QuestionTaxonomySettings")
    && questionBank.includes("School-Created Questions")
    && questionEditor.includes("save_question")
    && questionImporter.includes("bulk_import_questions"),
  "V7 question table, editor, review, settings or import flow is missing",
);
expect("one-page question editor", !questionEditor.includes("TabsContent") && questionEditor.includes("Classification and use") && questionEditor.includes("Question content") && questionEditor.includes("Answer and options") && questionEditor.includes("Solution and assessment settings"), "question editor is not a single continuous workspace");
expect("searchable taxonomy", questionEditor.includes("SearchableTaxonomySelect") && questionSettings.includes("A–Z sorting") && taxonomyApi.includes("createSubject") && taxonomyApi.includes("createChapter") && taxonomyApi.includes("createTopic"), "searchable subject, chapter and topic management is incomplete");
expect("Super Admin subject governance", taxonomyApi.includes("Only Super Admin can add universal subjects") && questionSettings.includes("Only Super Admin"), "subject creation is not restricted to Super Admin");
expect("device question preview", questionPreview.includes("Mobile") && questionPreview.includes("Tablet") && questionPreview.includes("Laptop") && questionReview.includes("QuestionDevicePreview"), "mobile, tablet and laptop question preview is missing");
expect("editable bulk review", questionImporter.includes("Question navigator") && questionImporter.includes("Next question") && questionImporter.includes("Jump to first error") && questionImporter.includes("updateRaw"), "bulk question correction and navigation are missing");
expect("validated Excel template", workbook.includes("dataValidations") && workbook.includes("evidara-question-import-template.xlsx") && workbook.includes("downloadQuestionImageZipTemplate") && importParser.includes("bulkQuestionTemplateHeaders"), "validated Excel and image ZIP template support is missing");
expect("simple import template", !importParser.slice(importParser.indexOf("bulkQuestionTemplateHeaders")).includes("match_left_a"), "Match the Following columns must not appear in the simple Excel/CSV template");
expect("school-only question export", exportSource.includes("Evidara master questions cannot be exported") && exportSource.includes("questions.csv") && exportSource.includes("image-links.csv") && questionBank.includes("Export School ZIP"), "school-only question ZIP export is incomplete");
expect("topic serial and date filters", questionBank.includes("Topic Serial") && questionBank.includes("Published date") && questionBank.includes("dateFrom") && questionBank.includes("dateTo"), "topic serial numbers or exact publication-date filters are missing");
expect("teacher publication guard", questionEditor.includes("Teachers can save drafts") && questionBank.includes("school_teacher") && completionMigration.includes("new.status not in ('draft', 'in_review')"), "teacher draft/review-only publication boundary is missing");
expect("live V7 paper builder", paperCatalogue.includes("save_question_paper") && paperCatalogue.includes("set_question_paper_status") && paperCatalogue.includes("Paper Sections"), "V7 paper table or builder is missing");
expect("live V7 student tests", studentTests.includes("list_available_papers") && studentTests.includes("start_exam_attempt"), "student live test catalogue is missing");
expect("live workspace routing", pageRouter.includes("LiveQuestionBank") && pageRouter.includes("LivePaperCatalogue") && pageRouter.includes("LiveStudentTests"), "V7 live workspaces are not routed");
expect("secure demo bootstrap", packageJson.scripts?.["demo:bootstrap"] && demoBootstrap.includes("auth.admin.createUser") && demoBootstrap.includes(".evidara-demo-access.txt"), "sales demo account bootstrap is missing");
expect("demo passwords ignored", read(".gitignore").includes(".evidara-demo-access.txt") && read(".gitignore").includes(".evidara-demo-access.json"), "generated demo passwords are not ignored");
expect("Prisma schema removed", !exists("prisma/schema.prisma"), "temporary Prisma schema still exists");
expect("SQLite database removed", !exists("db/custom.db"), "temporary SQLite database still exists");
expect("Template database client removed", !exists("src/lib/db.ts"), "temporary Prisma client still exists");
expect("Cloudflare configuration", read("wrangler.jsonc").includes('"main": ".open-next/worker.js"'), "Cloudflare worker configuration is missing");

if (failures.length) {
  console.error(`Evidara V7 smoke checks failed: ${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Evidara V7 smoke checks passed (${passes.length} checks).`);
for (const item of passes) console.log(`✓ ${item}`);
