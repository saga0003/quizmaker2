import { readFileSync } from 'node:fs';

const files = {
  builder: readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8'),
  types: readFileSync('src/types/papers.ts', 'utf8'),
  migration: readFileSync('supabase/32_v8_paper_builder.sql', 'utf8'),
  listRoute: readFileSync('src/components/papers/QuestionPaperList.tsx', 'utf8'),
  builderRoute: readFileSync('src/components/papers/QuestionPaperBuilder.tsx', 'utf8'),
  preview: readFileSync('src/components/papers/PaperPreview.tsx', 'utf8'),
};

const checks = [
  ['grade field', files.builder.includes('>Grade</span>') && files.migration.includes('grade_level text')],
  ['three result modes', ['score_only', 'score_and_answers', 'in_depth_analytics'].every((value) => files.builder.includes(value))],
  ['no creator access-mode control', !files.builder.includes('<Label>Access mode</Label>')],
  ['open forever', files.builder.includes('Open forever') && files.migration.includes('open_forever boolean')],
  ['three selection modes', ['manual', 'automatic', 'hybrid'].every((value) => files.builder.includes(`'${value}'`))],
  ['section-level mode', files.types.includes('selection_mode?: PaperSelectionMode') && files.migration.includes('selection_mode text')],
  ['difficulty distribution', ['very_easy', 'easy', 'moderate', 'difficult', 'very_difficult'].every((value) => files.builder.includes(value))],
  ['all requested test types', ['full_length_mock', 'subject_test', 'chapter_test', 'topic_test', 'unit_test', 'diagnostic_test', 'scholarship_test', 'previous_year_paper', 'practice_test', 'foundation_test', 'school_test', 'custom_test'].every((value) => files.types.includes(value))],
  ['approval statuses', ['under_review', 'approved', 'published', 'paused', 'closed', 'archived', 'rejected'].every((value) => files.types.includes(value))],
  ['role approvals', files.migration.includes('Evidara papers must be approved by Super Admin') && files.migration.includes('approved by School Admin')],
  ['direct question upload', files.builder.includes('QuestionBulkImportDialog') && files.builder.includes('Upload questions here')],
  ['autosave and draft recovery', files.builder.includes('localStorage.setItem') && files.builder.includes('Recovered your autosaved V8 paper draft')],
  ['biology split', ['combined', 'botany', 'zoology'].every((value) => files.builder.includes(value))],
  ['real paper routes use V8', files.listRoute.includes('LivePaperCatalogueV8') && files.builderRoute.includes('LivePaperCatalogueV8')],
  ['student-facing preview hides answers', !files.preview.includes('is_correct') && !files.preview.includes('solution_text')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} V8 paper smoke check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} V8 paper smoke checks passed.`);
