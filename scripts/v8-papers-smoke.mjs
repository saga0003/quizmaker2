import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  pkgText,
  vercelText,
  foundationMigration,
  generationMigration,
  list,
  builder,
  generationPanel,
  types,
] = await Promise.all([
  read("package.json"),
  read("vercel.json"),
  read("supabase/32_v8_paper_builder_foundation.sql"),
  read("supabase/33_v8_paper_generation_engine.sql"),
  read("src/components/papers/QuestionPaperList.tsx"),
  read("src/components/papers/QuestionPaperBuilder.tsx"),
  read("src/components/papers/PaperGenerationPanel.tsx"),
  read("src/types/papers.ts"),
]);

const pkg = JSON.parse(pkgText);
const vercel = JSON.parse(vercelText);

assert.equal(pkg.version, "8.0.0", "V8 package version must be 8.0.0");
assert.equal(
  pkg.scripts["qa:smoke"],
  "node scripts/v8-papers-smoke.mjs",
  "V8 smoke script must be the active QA smoke command",
);
assert.equal(
  vercel.git?.deploymentEnabled,
  false,
  "Vercel Git deployments must remain disabled during V8 Papers development",
);

for (const programme of [
  "Foundation Grade 7",
  "Foundation Grade 8",
  "Foundation Grade 9",
  "Foundation Grade 10",
  "NEET",
  "JEE Main",
  "JEE Advanced",
  "KCET",
]) {
  assert.ok(
    foundationMigration.includes(programme),
    `Migration 32 must seed ${programme}`,
  );
}

for (const contract of [
  "paper_programmes",
  "paper_subjects",
  "paper_versions",
  "paper_blueprints",
  "paper_generation_runs",
  "paper_templates",
  "paper_reviews",
  "paper_review_comments",
  "paper_validation_results",
  "paper_audit_history",
  "save_paper_definition_v8",
  "duplicate_question_paper_v8",
  "create_paper_version_v8",
  "search_eligible_questions_v8",
  "paper_question_availability_v8",
  "validate_paper_v8",
  "set_paper_workflow_status_v8",
]) {
  assert.ok(
    foundationMigration.includes(contract),
    `Migration 32 is missing ${contract}`,
  );
}

for (const contract of [
  "paper_eligible_questions_v8",
  "save_paper_blueprints_v8",
  "refresh_paper_blueprint_availability_v8",
  "paper_question_snapshot_v8",
  "generate_paper_from_blueprint_v8",
  "replace_paper_question_v8",
  "random_seed",
  "Generation stopped because the blueprint has shortages",
]) {
  assert.ok(
    generationMigration.includes(contract),
    `Migration 33 is missing ${contract}`,
  );
}

assert.match(
  foundationMigration,
  /'draft','draft'.*source_paper\.creation_mode/s,
  "Duplicated papers must be inserted as draft definitions",
);
assert.ok(
  foundationMigration.includes("'student_access_created',false") &&
    foundationMigration.includes("'product_created',false"),
  "Publishing a paper definition must not create student access or a product",
);
assert.ok(
  generationMigration.includes("paper_question.is_locked=false") &&
    generationMigration.includes("locked_count_value"),
  "Automatic and hybrid regeneration must preserve locked questions",
);
assert.ok(
  generationMigration.includes("md5(eligible.question_id::text||seed_value"),
  "Generated selection must use a stored reproducible seed",
);

for (const expected of [
  "duplicate_question_paper_v8",
  "Duplicate as a new draft",
  "Create draft copy",
  "Nothing was published",
  "workflow_status",
  "creation_mode",
]) {
  assert.ok(list.includes(expected), `Paper list is missing ${expected}`);
}

for (const step of [
  'key: "details"',
  'key: "programme"',
  'key: "sections"',
  'key: "questions"',
  'key: "blueprint"',
  'key: "arrangement"',
  'key: "rules"',
  'key: "preview"',
]) {
  assert.ok(builder.includes(step), `Paper builder is missing ${step}`);
}

for (const expected of [
  "PaperGenerationPanel",
  "save_paper_definition_v8",
  "search_eligible_questions_v8",
  "paper_question_availability_v8",
  "validate_paper_v8",
  "set_paper_workflow_status_v8",
  "Server-side filters retrieve one page",
  "Products, pricing, payment, entitlement and test delivery remain separate",
  "Paper submitted for review",
]) {
  assert.ok(builder.includes(expected), `Paper builder is missing ${expected}`);
}

for (const expected of [
  "save_paper_blueprints_v8",
  "refresh_paper_blueprint_availability_v8",
  "generate_paper_from_blueprint_v8",
  "Requested counts are checked",
  "Reproducible random seed",
  "Regenerate section",
  "Regenerate this blueprint row",
  "Locked manual questions stay fixed",
]) {
  assert.ok(
    generationPanel.includes(expected),
    `Generation workspace is missing ${expected}`,
  );
}

for (const forbidden of [
  "Save & publish",
  "Access code required",
  "All logged-in students",
  "Payment gateway",
]) {
  assert.ok(
    !builder.includes(forbidden),
    `V8 Papers must not expose excluded control: ${forbidden}`,
  );
}

for (const expected of [
  "PaperWorkflowStatus",
  "PaperCreationMode",
  "PaperDefinitionPayloadV8",
  "PaperDuplicateResult",
  "PaperValidationResult",
]) {
  assert.ok(types.includes(expected), `Paper types are missing ${expected}`);
}

console.log("V8 Papers smoke checks passed.");
