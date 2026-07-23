import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const dashboard = read("src/components/papers/PaperManagementDashboard.tsx");
const list = read("src/components/papers/QuestionPaperList.tsx");
const migration = read("supabase/36_v8_phase2_paper_management.sql");
const vercel = JSON.parse(read("vercel.json"));

assert.match(list, /PaperManagementDashboard as QuestionPaperList/, "Papers must use the Phase 2 management dashboard.");

for (const marker of [
  "duplicate_question_paper_v8",
  "create_paper_version_v8",
  "manage_paper_status_v8",
  "soft_delete_paper_definition_v8",
  "restore_deleted_paper_definition_v8",
  "Include recoverable deleted papers",
  "Products, pricing and test delivery remain outside this module",
]) {
  assert.ok(dashboard.includes(marker), `Phase 2 dashboard marker missing: ${marker}`);
}

for (const marker of [
  "add column if not exists deleted_at",
  "prevent_deleted_paper_mutation_v8",
  "create or replace function public.manage_paper_status_v8",
  "create or replace function public.soft_delete_paper_definition_v8",
  "create or replace function public.restore_deleted_paper_definition_v8",
  "Published paper history cannot be reopened as a draft",
  "Published, approved or review-active papers cannot be deleted",
  "paper.soft_deleted",
  "paper.soft_delete_restored",
]) {
  assert.ok(migration.includes(marker), `Phase 2 migration marker missing: ${marker}`);
}

assert.match(migration, /workflow_status='draft'/, "Restored deleted papers must return as Draft.");
assert.match(migration, /recoverable[^\n]*true/, "Soft deletion must explicitly remain recoverable.");
assert.equal(vercel.git?.deploymentEnabled, false, "Vercel must remain disabled until Phase 3 is completed.");

console.log("V8 Phase 2 management smoke passed.");
console.log("Draft duplication, versioning, archive, restore and recoverable deletion contracts are present.");
console.log("Vercel remains disabled pending Phase 3 acceptance.");
