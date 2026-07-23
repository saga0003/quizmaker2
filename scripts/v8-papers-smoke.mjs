import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const pkg = JSON.parse(read("package.json"));
const vercel = JSON.parse(read("vercel.json"));
const migrations = [32, 33, 34, 35, 36, 37].map((number) =>
  read(`supabase/${number}_${number === 32 ? "v8_paper_builder_foundation" : number === 33 ? "v8_paper_generation_engine" : number === 34 ? "v8_paper_review_publish_export" : number === 35 ? "v8_safe_autosave_templates_workflow" : number === 36 ? "v8_phase2_paper_management" : "v8_phase3_question_generation_studio"}.sql`),
);
const [foundation, generation, lifecycle, workflow, management, studioMigration] = migrations;
const builder = read("src/components/papers/QuestionPaperBuilder.tsx");
const managementDashboard = read("src/components/papers/PaperManagementDashboard.tsx");
const generationStudio = read("src/components/papers/QuestionGenerationStudio.tsx");
const generationPanel = read("src/components/papers/PaperGenerationPanel.tsx");
const history = read("src/components/papers/PaperGenerationHistory.tsx");
const paperList = read("src/components/papers/QuestionPaperList.tsx");

assert.equal(pkg.version, "8.0.0-ui-refresh", "Package must identify the V8 UI refresh build.");
for (const command of ["qa:smoke", "qa:phase1", "qa:phase2", "qa:phase3", "qa:ui"]) {
  assert.ok(pkg.scripts[command], `Missing QA command: ${command}`);
}
assert.equal(vercel.buildCommand, "npm run qa", "Vercel must retain the complete QA command for the later approved deployment.");
assert.equal(vercel.git?.deploymentEnabled, false, "Vercel must remain completely disabled during the UI/UX refresh.");

for (const programme of [
  "Foundation Grade 7", "Foundation Grade 8", "Foundation Grade 9", "Foundation Grade 10",
  "NEET", "JEE Main", "JEE Advanced", "KCET",
]) assert.ok(foundation.includes(programme), `Missing programme: ${programme}`);

for (const contract of [
  "save_paper_definition_v8", "duplicate_question_paper_v8", "create_paper_version_v8",
  "search_eligible_questions_v8", "paper_question_availability_v8", "validate_paper_v8",
  "paper_generation_runs", "paper_templates", "paper_reviews", "paper_audit_history",
]) assert.ok(foundation.includes(contract), `Migration 32 missing ${contract}`);

for (const contract of [
  "save_paper_blueprints_v8", "refresh_paper_blueprint_availability_v8",
  "generate_paper_from_blueprint_v8", "replace_paper_question_v8",
  "Generation stopped because the blueprint has shortages", "Locked questions remain untouched",
]) assert.ok(generation.includes(contract), `Migration 33 missing ${contract}`);

for (const contract of [
  "submit_paper_review_v8", "decide_paper_review_v8", "publish_paper_definition_v8",
  "export_paper_definition_v8", "definition_snapshot",
]) assert.ok(lifecycle.includes(contract), `Migration 34 missing ${contract}`);

for (const contract of [
  "save_paper_as_template_v8", "create_paper_from_template_v8",
  "retained_section_ids", "retained_question_ids", "definition_only",
]) assert.ok(workflow.includes(contract), `Migration 35 missing ${contract}`);

for (const contract of [
  "manage_paper_status_v8", "soft_delete_paper_definition_v8",
  "restore_deleted_paper_definition_v8", "prevent_deleted_paper_mutation_v8",
]) assert.ok(management.includes(contract), `Migration 36 missing ${contract}`);

for (const contract of [
  "append_questions_to_paper_v8", "set_paper_question_lock_v8",
  "question.status::text='approved'", "paper.questions_appended", "paper.question_lock_changed",
]) assert.ok(studioMigration.includes(contract), `Migration 37 missing ${contract}`);

for (const step of ["details", "programme", "sections", "questions", "blueprint", "arrangement", "rules", "preview"]) {
  assert.ok(builder.includes(`key: "${step}"`), `Builder missing ${step} step.`);
}
for (const marker of [
  "duplicate_question_paper_v8", "create_paper_version_v8", "soft_delete_paper_definition_v8",
  "Include recoverable deleted papers",
]) assert.ok(managementDashboard.includes(marker), `Management dashboard missing ${marker}`);
for (const marker of [
  "search_eligible_questions_v8", "append_questions_to_paper_v8", "bankCache", "bankSelection",
  "p_excluded_ids: Array.from(existingQuestionIds)", "set_paper_question_lock_v8", "PaperGenerationPanel",
]) assert.ok(generationStudio.includes(marker), `Generation studio missing ${marker}`);
for (const marker of [
  "save_paper_blueprints_v8", "generate_paper_from_blueprint_v8", "Regenerate section",
  "Regenerate this blueprint row", "Reproducible random seed",
]) assert.ok(generationPanel.includes(marker), `Generation panel missing ${marker}`);
assert.ok(history.includes("paper_generation_runs") && history.includes("onReuseSeed"), "Generation history must persist and reuse seeds.");
assert.ok(paperList.includes("Generation Studio"), "Papers page must expose the Generation Studio.");

for (const source of [builder, managementDashboard, generationStudio]) {
  for (const forbidden of ["Payment gateway", "Access code required", "All logged-in students"]) {
    assert.ok(!source.includes(forbidden), `V8 Papers exposes excluded feature: ${forbidden}`);
  }
}

console.log("V8 UI refresh base smoke checks passed with Vercel locked.");
