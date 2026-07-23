import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [
  pkgText,
  vercelText,
  foundationMigration,
  generationMigration,
  lifecycleMigration,
  workflowMigration,
  list,
  builder,
  generationPanel,
  lifecyclePanel,
  templatePanel,
  exportPanel,
  auditPanel,
  types,
] = await Promise.all([
  read("package.json"),
  read("vercel.json"),
  read("supabase/32_v8_paper_builder_foundation.sql"),
  read("supabase/33_v8_paper_generation_engine.sql"),
  read("supabase/34_v8_paper_review_publish_export.sql"),
  read("supabase/35_v8_safe_autosave_templates_workflow.sql"),
  read("src/components/papers/QuestionPaperList.tsx"),
  read("src/components/papers/QuestionPaperBuilder.tsx"),
  read("src/components/papers/PaperGenerationPanel.tsx"),
  read("src/components/papers/PaperLifecyclePanel.tsx"),
  read("src/components/papers/PaperTemplatePanel.tsx"),
  read("src/components/papers/PaperExportPanel.tsx"),
  read("src/components/papers/PaperAuditPanel.tsx"),
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

for (const contract of [
  "stable blueprint",
  "export_paper_definition_v8",
  "submit_paper_review_v8",
  "add_paper_review_comment_v8",
  "resolve_paper_review_comment_v8",
  "decide_paper_review_v8",
  "publish_paper_definition_v8",
  "accepted_warning_reason",
  "definition_snapshot",
]) {
  assert.ok(
    lifecycleMigration.toLowerCase().includes(contract.toLowerCase()),
    `Migration 34 is missing ${contract}`,
  );
}

for (const contract of [
  "retained_section_ids",
  "retained_question_ids",
  "on conflict (id) do update",
  "on conflict (paper_id,question_id) do update",
  "sections_preserved",
  "blueprints_preserved",
  "save_paper_as_template_v8",
  "create_paper_from_template_v8",
  "Use the tracked review decision and publication functions",
  "definition_only",
]) {
  assert.ok(
    workflowMigration.includes(contract),
    `Migration 35 is missing ${contract}`,
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
assert.ok(
  generationMigration.includes("p_rule_id is null or paper_question.blueprint_rule_id=p_rule_id") &&
    !generationMigration.includes("paper_question.blueprint_rule_id is null\n        and paper_question.section_id"),
  "Rule-only regeneration must not remove unrelated questions",
);
assert.ok(
  lifecycleMigration.includes("workflow_status<>'approved'") &&
    lifecycleMigration.includes("Resolve all review comments before approving"),
  "Publishing and approval must enforce the academic review workflow",
);
assert.ok(
  lifecycleMigration.includes("'student_access_created',false") &&
    lifecycleMigration.includes("'product_created',false"),
  "Published V8 paper definitions must not create products or student access",
);
assert.ok(
  workflowMigration.includes("id<>all(retained_section_ids)") &&
    workflowMigration.includes("question_id<>all(retained_question_ids)"),
  "Draft autosave must update retained sections and questions without rebuilding everything",
);
assert.ok(
  workflowMigration.includes("'workflow_status','draft'") &&
    workflowMigration.includes("'student_access_created',false") &&
    workflowMigration.includes("'product_created',false"),
  "Template-created papers must always begin as isolated draft definitions",
);
assert.ok(
  workflowMigration.includes("workflow_status<>'approved'") &&
    workflowMigration.includes("definition_snapshot=excluded.definition_snapshot"),
  "Final publication must require approval and preserve an immutable version snapshot",
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
  "PaperLifecyclePanel",
  "PaperTemplatePanel",
  "PaperExportPanel",
  "PaperAuditPanel",
  "save_paper_definition_v8",
  "search_eligible_questions_v8",
  "paper_question_availability_v8",
  "validate_paper_v8",
  "submit_paper_review_v8",
  "replace_paper_question_v8",
  "paper_question_id",
  "blueprint_rule_id",
  "Replace generated question",
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
  "id: rule.id || null",
]) {
  assert.ok(
    generationPanel.includes(expected),
    `Generation workspace is missing ${expected}`,
  );
}

for (const expected of [
  "submit_paper_review_v8",
  "add_paper_review_comment_v8",
  "resolve_paper_review_comment_v8",
  "decide_paper_review_v8",
  "publish_paper_definition_v8",
  "create_paper_version_v8",
  "export_paper_definition_v8",
  "No product, price, bundle, entitlement, agent code or student attempt is created",
]) {
  assert.ok(
    lifecyclePanel.includes(expected),
    `Paper lifecycle workspace is missing ${expected}`,
  );
}

for (const expected of [
  "save_paper_as_template_v8",
  "create_paper_from_template_v8",
  "Save as template",
  "Build draft",
  "Create draft paper",
  "Templates never publish a paper and never create student access",
]) {
  assert.ok(
    templatePanel.includes(expected),
    `Template workspace is missing ${expected}`,
  );
}

for (const expected of [
  "export_paper_definition_v8",
  "Question paper HTML",
  "Answer key HTML",
  "Solutions HTML",
  "Excel question list",
  "Question list CSV",
  "Answers & solutions CSV",
  "Blueprint CSV",
  "Validation report",
  "Complete JSON backup",
  "Print current preview",
]) {
  assert.ok(exportPanel.includes(expected), `Export workspace is missing ${expected}`);
}

for (const expected of [
  "paper_audit_history",
  "Every important paper action",
  "Draft saves, duplication, generation, replacement, review, publication, versions and templates are recorded",
  "Search action, role, reason or changed value",
  "All actions",
]) {
  assert.ok(auditPanel.includes(expected), `Audit workspace is missing ${expected}`);
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
