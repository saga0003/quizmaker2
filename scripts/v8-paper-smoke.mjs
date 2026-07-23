import { readFileSync } from 'node:fs';

const files = {
  builder: readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8'),
  paperTypes: readFileSync('src/types/papers.ts', 'utf8'),
  questionTypes: readFileSync('src/types/questions.ts', 'utf8'),
  questionEditor: readFileSync('src/components/evidara/question-editor-dialog.tsx', 'utf8'),
  bulkImport: readFileSync('src/components/evidara/question-bulk-import-dialog-core.tsx', 'utf8'),
  template: readFileSync('src/lib/questionTemplateWorkbook.ts', 'utf8'),
  settings: readFileSync('src/components/evidara/question-taxonomy-settings.tsx', 'utf8'),
  optionsHook: readFileSync('src/components/evidara/use-assessment-options.ts', 'utf8'),
  migration32: readFileSync('supabase/32_v8_paper_builder.sql', 'utf8'),
  migration33: readFileSync('supabase/33_v8_configurable_assessment_settings.sql', 'utf8'),
  listRoute: readFileSync('src/components/papers/QuestionPaperList.tsx', 'utf8'),
  builderRoute: readFileSync('src/components/papers/QuestionPaperBuilder.tsx', 'utf8'),
  preview: readFileSync('src/components/papers/PaperPreview.tsx', 'utf8'),
  styles: readFileSync('src/app/globals.css', 'utf8'),
};

const requestedTestTypes = ['full_length_mock', 'subject_test', 'chapter_test', 'topic_test', 'unit_test', 'diagnostic_test', 'scholarship_test', 'previous_year_paper', 'practice_test', 'foundation_test', 'school_test', 'custom_test'];
const checks = [
  ['grade in question editor', files.questionEditor.includes('>Grade</GuidedLabel>') && files.questionEditor.includes('class_level: editor.classLevel')],
  ['grade in paper builder', files.builder.includes('>Grade</span>') && files.migration32.includes('grade_level text')],
  ['dynamic Excel grade and exam validation', files.template.includes("byHeader.get('grade')") && files.template.includes("byHeader.get('exam_types')") && files.bulkImport.includes('grades.map((item) => item.value)')],
  ['question test type removed', !files.questionEditor.includes('QuestionTestType') && !files.questionEditor.includes('Enter the custom test type') && !files.questionTypes.includes('QuestionTestType')],
  ['paper-only requested test types', requestedTestTypes.every((value) => files.paperTypes.includes(value)) && files.settings.includes('Paper test types')],
  ['database-driven assessment settings', files.migration33.includes('create table if not exists public.assessment_options') && files.optionsHook.includes("from('assessment_options')")],
  ['logical reasoning seeded', files.migration33.includes("'Logical Reasoning'") && files.builder.includes('Logical Reasoning')],
  ['biology division in questions and papers', files.questionEditor.includes('biologyDivision') && files.bulkImport.includes('biology_division') && ['combined', 'botany', 'zoology'].every((value) => files.builder.includes(value))],
  ['difficulty counts visible while selecting', files.builder.includes('difficultyCounts') && files.builder.includes('total matching')],
  ['formatted description without extra instructions', files.builder.includes('Formatted description') && !files.builder.includes('Extra instructions')],
  ['super admin bulk taxonomy management', files.settings.includes('Select all') && files.settings.includes('Delete / archive') && files.migration33.includes('bulk_manage_question_taxonomy_v8')],
  ['three result modes', ['score_only', 'score_and_answers', 'in_depth_analytics'].every((value) => files.builder.includes(value))],
  ['no creator access-mode control', !files.builder.includes('<Label>Access mode</Label>')],
  ['open forever', files.builder.includes('Open forever') && files.migration32.includes('open_forever boolean')],
  ['three selection modes', ['manual', 'automatic', 'hybrid'].every((value) => files.builder.includes(`'${value}'`))],
  ['section-level mode', files.paperTypes.includes('selection_mode?: PaperSelectionMode') && files.migration32.includes('selection_mode text')],
  ['difficulty distribution', ['very_easy', 'easy', 'moderate', 'difficult', 'very_difficult'].every((value) => files.builder.includes(value))],
  ['approval statuses', ['under_review', 'approved', 'published', 'paused', 'closed', 'archived', 'rejected'].every((value) => files.paperTypes.includes(value))],
  ['role approvals', files.migration32.includes('Evidara papers must be approved by Super Admin') && files.migration32.includes('approved by School Admin')],
  ['direct question upload', files.builder.includes('QuestionBulkImportDialog') && files.builder.includes('Upload questions here')],
  ['autosave and draft recovery', files.builder.includes('localStorage.setItem') && files.builder.includes('Recovered your autosaved V8 paper draft')],
  ['real paper routes use V8', files.listRoute.includes('LivePaperCatalogueV8') && files.builderRoute.includes('LivePaperCatalogueV8')],
  ['student-facing preview hides answers', !files.preview.includes('is_correct') && !files.preview.includes('solution_text')],
  ['live student exam hides taxonomy metadata', files.styles.includes('.secure-exam-content main.rm-card > div:first-child > div:first-child > div')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
if (failed.length) {
  console.error(`\n${failed.length} V8 paper smoke check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${checks.length} V8 paper smoke checks passed.`);
