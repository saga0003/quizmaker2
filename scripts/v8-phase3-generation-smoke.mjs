import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const studio = read("src/components/papers/QuestionGenerationStudio.tsx");
const history = read("src/components/papers/PaperGenerationHistory.tsx");
const list = read("src/components/papers/QuestionPaperList.tsx");
const migration = read("supabase/37_v8_phase3_question_generation_studio.sql");
const engine = read("supabase/33_v8_paper_generation_engine.sql");
const adminRoute = read("src/app/admin/papers/generation/page.tsx");
const schoolRoute = read("src/app/school/papers/generation/page.tsx");

for (const marker of [
  "search_eligible_questions_v8",
  "paper_question_availability_v8",
  "append_questions_to_paper_v8",
  "set_paper_question_lock_v8",
  "bankCache",
  "bankSelection",
  "selected across pages",
  "p_excluded_ids: Array.from(existingQuestionIds)",
  "PaperGenerationPanel",
  "PaperGenerationHistory",
  "Generation Studio",
  "toggleVisible",
]) assert.ok(studio.includes(marker), `Phase 3 studio marker missing: ${marker}`);

for (const marker of [
  "create or replace function public.append_questions_to_paper_v8",
  "question.status::text='approved'",
  "paper.questions_appended",
  "create or replace function public.set_paper_question_lock_v8",
  "paper.question_lock_changed",
  "definition_published',false",
  "product_created',false",
  "student_access_created',false",
]) assert.ok(migration.includes(marker), `Phase 3 migration marker missing: ${marker}`);

for (const marker of [
  "refresh_paper_blueprint_availability_v8",
  "generate_paper_from_blueprint_v8",
  "Generation stopped because the blueprint has shortages",
  "Locked questions remain untouched",
  "paper_generation_runs",
  "replace_paper_question_v8",
]) assert.ok(engine.includes(marker), `Generation engine marker missing: ${marker}`);

assert.ok(history.includes("paper_generation_runs"), "Generation history must read persisted generation runs.");
assert.ok(history.includes("onReuseSeed"), "Generation history must expose reusable seeds.");
assert.ok(list.includes("Generation Studio"), "Papers must visibly link to the Generation Studio.");
assert.ok(adminRoute.includes('QuestionGenerationStudio kind="admin"'), "Admin generation route missing.");
assert.ok(schoolRoute.includes('QuestionGenerationStudio kind="school"'), "School generation route missing.");

console.log("V8 Phase 3 question and generation smoke passed under the responsive UI boundary.");
console.log("Server-side filtering, cross-page selection, exact availability, hybrid locks, blueprints, shortage blocking and generation history remain wired.");
