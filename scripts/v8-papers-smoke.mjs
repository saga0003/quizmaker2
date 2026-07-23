import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [pkgText, vercelText, migration, list, builder, types] = await Promise.all([
  read("package.json"),
  read("vercel.json"),
  read("supabase/32_v8_paper_builder_foundation.sql"),
  read("src/components/papers/QuestionPaperList.tsx"),
  read("src/components/papers/QuestionPaperBuilder.tsx"),
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
  assert.ok(migration.includes(programme), `Migration 32 must seed ${programme}`);
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
  assert.ok(migration.includes(contract), `Migration 32 is missing ${contract}`);
}

assert.match(
  migration,
  /'draft','draft'.*source_paper\.creation_mode/s,
  "Duplicated papers must be inserted as draft definitions",
);
assert.ok(
  migration.includes("'student_access_created',false") &&
    migration.includes("'product_created',false"),
  "Publishing a paper definition must not create student access or a product",
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
  'key: "arrangement"',
  'key: "rules"',
  'key: "preview"',
]) {
  assert.ok(builder.includes(step), `Paper builder is missing ${step}`);
}

for (const expected of [
  "save_paper_definition_v8",
  "search_eligible_questions_v8",
  "paper_question_availability_v8",
  "validate_paper_v8",
  "set_paper_workflow_status_v8",
  "Server-side filters retrieve one page",
  "Products, prices, purchases, student access and examination delivery are outside this module",
  "Paper submitted for review",
]) {
  assert.ok(builder.includes(expected), `Paper builder is missing ${expected}`);
}

for (const forbidden of [
  "Save & publish",
  "Access code required",
  "All logged-in students",
  "Payment gateway",
]) {
  assert.ok(!builder.includes(forbidden), `V8 Papers must not expose excluded control: ${forbidden}`);
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
