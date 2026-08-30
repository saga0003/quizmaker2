import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const exists=(p)=>fs.existsSync(path.join(root,p));
let passed=0, failed=0;
function check(name,condition){
  if(condition){passed++;console.log(`PASS ${name}`);}
  else{failed++;console.error(`FAIL ${name}`);}
}

const required=[
  'supabase/migrations/20260810221500_expand_neet_taxonomy_v17.sql',
  'supabase/migrations/20260810222500_add_neet_animal_kingdom_taxonomy_v17.sql',
  'supabase/migrations/20260810223200_neet_pyq_taxonomy_enrichment_v17.sql',
  'supabase/migrations/20260810223400_fix_neet_taxonomy_enrichment_immutable_v17.sql',
  'supabase/migrations/20260814100000_pyq_paper_occurrence_engine_v18.sql',
  'supabase/migrations/20260814103000_paper_file_import_engine_v18.sql',
  'supabase/migrations/20260814104500_pyq_paper_readiness_v18.sql',
  'supabase/migrations/20260814105000_commerce_pyq_paper_metadata_v18.sql',
  'supabase/migrations/20260814105500_pyq_builder_occurrence_source_v18.sql',
  'supabase/migrations/20260814110000_manual_paper_pyq_identity_v18.sql',
  'supabase/migrations/20260814110500_paper_import_section_subject_guard_v18.sql',
  'supabase/migrations/20260814111000_paper_publish_question_gate_v18.sql',
  'templates/paper-import/PAPER_IMPORT_TEMPLATE_V18.json',
  'templates/paper-import/PAPER_IMPORT_TEMPLATE_V18.tex',
  'src/app/api/admin/pyq-paper-sources/route.ts',
  'src/app/api/admin/paper-file-import/route.ts',
  'src/components/evidara/pyq-paper-manager.tsx',
  'src/components/evidara/paper-file-import-dialog.tsx',
];
required.forEach((p)=>check(`exists ${p}`,exists(p)));

const qtypes=read('src/types/questions.ts');
check('Question types expose PYQ occurrences',qtypes.includes('QuestionPyqOccurrenceInput')&&qtypes.includes('question_pyq_occurrences'));

const editor=read('src/components/evidara/question-editor-dialog.tsx');
check('Question editor can add multiple PYQ occurrences',editor.includes('Previous-year paper occurrences')&&editor.includes('Add PYQ occurrence')&&editor.includes('syncQuestionOccurrences'));
check('Question occurrence captures variant/code/question number',editor.includes('Paper variant')&&editor.includes('Paper code')&&editor.includes('Question no.'));

const staging=read('src/app/api/admin/pyq-staging-import/route.ts');
check('Prepared PYQ import registers source paper',staging.includes('upsert_pyq_source_paper_service_v18'));
check('Promotion registers question occurrence',staging.includes('question_pyq_occurrences'));
check('PYQ promotion reuses exact duplicate questions',staging.includes('reusedExactDuplicate')&&staging.includes("eq('duplicate_hash', staged.duplicate_hash)"));

const papers=read('src/components/evidara/live-paper-catalogue-v8.tsx');
check('Paper catalogue exposes exact PYQ builder',papers.includes('Build PYQ Paper')&&papers.includes('PyqPaperManager'));
check('Paper catalogue exposes paper import', (papers.includes('Import Year / Paper') || papers.includes('Import JSON / LaTeX')) && papers.includes('PaperFileImportDialog'));
check('Paper list shows PYQ year/variant',papers.includes('source_variant')&&papers.includes('source_paper_code'));
check('Manual paper builder can assign official PYQ identity',papers.includes('Official previous-year paper')&&papers.includes('set_question_paper_pyq_identity_v18'));

const fileImport=read('src/components/evidara/paper-file-import-dialog.tsx');
check('Paper file import parses JSON and LaTeX',fileImport.includes("ext==='json'")&&fileImport.includes("ext==='tex'"));
check('Exact duplicates automatically reuse',fileImport.includes("exact?'reuse'"));
check('Near duplicates require manual review',fileImport.includes("match?.near?.length?'review':'new'")&&fileImport.includes('possible duplicate'));
check('Duplicate review offers keep both',fileImport.includes('Keep both / import this'));

const products=read('src/components/commerce/AdminProductManager.tsx');
check('Product paper picker filters PYQ',products.includes('Previous-year papers')&&products.includes('paperYearFilter')&&products.includes('paperVariantFilter'));
check('Product paper picker displays PYQ metadata',products.includes('source_paper_code')&&products.includes('source_variant'));

const migration=read('supabase/migrations/20260814100000_pyq_paper_occurrence_engine_v18.sql');
check('DB has source papers and occurrence tables',migration.includes('pyq_source_papers')&&migration.includes('question_pyq_occurrences'));
check('DB exact builder exists',migration.includes('build_pyq_paper_service_v18'));
const importMigration=read('supabase/migrations/20260814103000_paper_file_import_engine_v18.sql');
check('Atomic paper import service exists',importMigration.includes('paper_file_import_bundle_service_v18'));
check('File import reuses exact hash before insert',importMigration.includes('duplicate_hash=v_hash'));
const manualIdentity=read('supabase/migrations/20260814110000_manual_paper_pyq_identity_v18.sql');
check('Manual PYQ identity maps selected paper questions to occurrences',manualIdentity.includes('question_pyq_occurrences')&&manualIdentity.includes('display_order+1'));
check('V18 ships JSON and LaTeX paper templates',exists('templates/paper-import/PAPER_IMPORT_TEMPLATE_V18.json')&&exists('templates/paper-import/PAPER_IMPORT_TEMPLATE_V18.tex'));

const publishGate=read('supabase/migrations/20260814111000_paper_publish_question_gate_v18.sql');
check('Paper publish gate blocks unapproved questions and refreshes snapshots',publishGate.includes('not approved')&&publishGate.includes('question_snapshots_refreshed_at'));

console.log(`\nV18 PYQ/Paper Engine: ${passed} passed, ${failed} failed`);
process.exit(failed?1:0);

