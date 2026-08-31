import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) });

const importer = read('src/components/evidara/question-bulk-import-dialog-core.tsx');
const ai = read('src/components/evidara/ai-import-helper.tsx');
const taxonomyUi = read('src/components/evidara/question-taxonomy-settings.tsx');
const taxonomyApi = read('src/app/api/question-taxonomy/route.ts');
const bank = read('src/components/evidara/live-question-bank.tsx');
const students = read('src/components/school/StudentLifecycleManager.tsx');
const schoolApi = read('src/app/api/school-platform/route.ts');
const schoolHook = read('src/components/school/useSchoolPlatform.ts');
const subscription = read('src/components/school/SubscriptionCenter.tsx');
const migration = read('supabase/migrations/20260828010000_phase1_clean_school_operations.sql');

check('AI helper exists in importer', importer.includes('<AiImportHelper') && ai.includes('AI Helper'));
check('AI helper is provider-independent', /ChatGPT|Gemini|Claude/.test(ai) && ai.includes('Copy'));
check('AI helper covers LaTeX', ai.includes('LaTeX'));
check('AI helper covers Excel/CSV', /Excel|CSV/.test(ai));
check('AI helper covers image ZIP workflow', /ZIP/.test(ai) && /image/i.test(ai));
check('import workflow communicates four steps', ['Upload','Map','Review','Import'].every((text) => importer.includes(`'${text}'`)));
check('import can create a school paper', importer.includes('Create a paper from this import') && importer.includes('Import ${valid.length} & Create Paper'));
check('import calls atomic phase1 paper RPC', importer.includes("bulk_import_questions_and_paper_phase1"));
check('paper settings capture exam and grade', importer.includes('paperExam') && importer.includes('paperGrade'));
check('paper defaults can fill missing exam and grade', importer.includes('applyPaperDefaultsToMissing') && importer.includes('Apply exam & grade to missing questions'));
check('taxonomy warning is dynamic', importer.includes('analysisMissing') && importer.includes('corresponding subject-, chapter- or topic-wise reports will be incomplete'));
check('missing institution subject directs to Academic Setup', importer.includes('Add it from Academic Setup'));

check('atomic RPC reuses organization duplicates', migration.includes('duplicate_hash = v_hash') && migration.includes('reused_count := reused_count + 1'));
check('atomic RPC adds new questions to bank', migration.includes('public.save_question'));
check('atomic RPC creates draft organization paper', migration.includes("'draft'") && migration.includes("'organization'"));
check('atomic RPC creates paper sections', migration.includes('insert into public.paper_sections'));
check('atomic RPC preserves paper question order', migration.includes('array_position(v_question_ids, qu.id)') && migration.includes('display_order'));
check('atomic RPC is not anonymous', migration.includes('revoke all on function') && migration.includes('from public, anon'));

check('school admin gets Academic Setup tab', bank.includes('(kind === \'school\' && !teacher)') && bank.includes('Academic Setup'));
check('academic setup supports institution subjects', taxonomyUi.includes('Add institution subject'));
check('academic setup supports bulk create', taxonomyUi.includes('Bulk add') && taxonomyApi.includes("action === 'bulkCreate'"));
check('academic setup supports subject chapter topic', ['Subjects','Chapters','Topics'].every((text) => taxonomyUi.includes(text)));
check('school taxonomy archives instead of hard deletes', taxonomyApi.includes("is_active: action === 'restoreItems'"));
check('school cannot manage other institution taxonomy', taxonomyApi.includes('Schools can only change their own academic setup'));
check('taxonomy parent IDs are school scoped', taxonomyApi.includes('ensureParentVisible') && taxonomyApi.includes('Schools can only use universal taxonomy or taxonomy owned by their own institution'));

check('student table supports select all and selection', students.includes('allVisibleSelected') && students.includes('selected.has(student.id)'));
check('student bulk promotion requires confirmation', students.includes('Promote {selected.size} selected student') && students.includes('<AlertDialog'));
check('student edit drawer exists', students.includes('Edit Student Profile') && students.includes('<Sheet'));
check('student profile fields are editable', ['fullName','email','phone','rollNumber','parentName','parentPhone','academicYear','section','tracks','notes'].every((field) => students.includes(`detail.${field}`)));
check('student account supports set password', students.includes('Set password') && schoolApi.includes('setStudentPassword'));
check('student account supports generated temporary password', students.includes('Generate temporary') && schoolApi.includes('resetStudentPassword'));
check('student removal is institution-only', students.includes("student's Evidara account is not deleted globally") && schoolApi.includes('removeStudent'));
check('teacher roster is read only', students.includes('Assigned-section read-only access') && students.includes('Read only'));
check('student writes require school manager', schoolApi.includes('if (!ctx.manager)') && schoolApi.includes('School Admin permission is required'));
check('student writes stay organization scoped', schoolApi.includes('.eq("organization_id", organizationId)'));
check('student command helper returns action data safely', schoolHook.includes('const command') && schoolHook.includes('return await requestCloud("POST", { action, ...payload }) as unknown as Record<string, unknown>'));

check('subscription is clean card UI', subscription.includes('Institution Subscription') && subscription.includes('Included features') && subscription.includes('Subscription governance'));
check('subscription presents unlimited school plan', subscription.includes('Unlimited') && subscription.includes('Tests'));
check('subscription retains resource access', subscription.includes('Resource access'));
check('subscription contains no legacy ScholarOS branding', !subscription.includes('ScholarOS'));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}`);
if (failed.length) {
  console.error(`\nPhase 1 Clean School UX smoke failed: ${failed.length}/${checks.length} checks.`);
  process.exit(1);
}
console.log(`\nPhase 1 Clean School UX smoke passed: ${checks.length}/${checks.length} checks.`);