import fs from 'node:fs';

const path = 'src/components/evidara/live-paper-catalogue-v8.tsx';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly 1 match, found ${count}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  "const canApprove = role === 'super_admin' || (kind === 'school' && role === 'school_admin');\nconst canDeletePaper = role === 'super_admin' || (kind === 'school' && role === 'school_admin');",
  "const canApprove = role === 'super_admin' || (kind === 'school' && role === 'school_admin');\nconst canDeletePaper = role === 'super_admin' || (kind === 'school' && role === 'school_admin');\nconst postAttemptLimitedEdit = editingPaperHasAttempts && !canApprove;",
  'add post-attempt admin capability flag',
);

replaceOnce(
  "supabase.from('paper_sections').select('*').eq('paper_id', paper.id).order('display_order'),",
  "supabase.from('paper_sections').select('*').eq('paper_id', paper.id).eq('is_active', true).order('display_order'),",
  'load only current active sections',
);

replaceOnce(
  "supabase.from('paper_questions').select('question_id,section_id,display_order,marks,negative_marks,is_mandatory').eq('paper_id', paper.id).order('display_order'),",
  "supabase.from('paper_questions').select('question_id,section_id,display_order,marks,negative_marks,is_mandatory').eq('paper_id', paper.id).eq('is_active', true).order('display_order'),",
  'load only current active questions',
);

replaceOnce(
  'if (hasAttempts) setBuilderStep(4);',
  'if (hasAttempts && !canApprove) setBuilderStep(4);',
  'only restrict non-admin post-attempt editing',
);

replaceOnce(
  "const { data, error: saveError } = await supabase.rpc('save_question_paper', {",
  "const { data, error: saveError } = await supabase.rpc('save_question_paper_revisioned_v1', {",
  'use revision-safe paper save RPC',
);

replaceOnce(
  "setMessage(status === 'draft' ? 'Draft saved.' : status === 'under_review' ? 'Paper submitted for approval.' : 'Paper published.');",
  "setMessage(editingPaperHasAttempts && canApprove\n? (status === 'draft'\n  ? 'Changes saved. Existing student attempts, scores and analytics were preserved.'\n  : status === 'under_review'\n    ? 'Paper updated and submitted for approval. Existing student history was preserved.'\n    : 'Paper updated and published. Existing student history was preserved; future attempts use the new version.')\n: (status === 'draft' ? 'Draft saved.' : status === 'under_review' ? 'Paper submitted for approval.' : 'Paper published.'));",
  'show history-preservation confirmation',
);

replaceOnce(
  'disabled={editingPaperHasAttempts && item.step !== 4}',
  'disabled={postAttemptLimitedEdit && item.step !== 4}',
  'unlock all builder steps for admins',
);

const disabledFieldMatches = source.split('disabled={editingPaperHasAttempts}').length - 1;
if (disabledFieldMatches !== 7) {
  throw new Error(`post-attempt settings fields: expected 7 disabled matches, found ${disabledFieldMatches}`);
}
source = source.replaceAll('disabled={editingPaperHasAttempts}', 'disabled={postAttemptLimitedEdit}');

replaceOnce(
  '{!editingPaperHasAttempts && builderStep > 1 && <Button type="button" variant="outline" disabled={saving} onClick={() => setBuilderStep((current) => Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5)} className="h-11 border-[var(--line)]">Back</Button>}',
  '{!postAttemptLimitedEdit && builderStep > 1 && <Button type="button" variant="outline" disabled={saving} onClick={() => setBuilderStep((current) => Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5)} className="h-11 border-[var(--line)]">Back</Button>}',
  'restore Back for admin full edit',
);

replaceOnce(
  '{!editingPaperHasAttempts && <Button type="button" variant="outline" disabled={saving} onClick={() => void savePaper(\'draft\')} className="h-11 border-[var(--teal)]/30 text-[var(--teal)]">{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Draft</Button>}',
  '{!postAttemptLimitedEdit && <Button type="button" variant="outline" disabled={saving} onClick={() => void savePaper(\'draft\')} className="h-11 border-[var(--teal)]/30 text-[var(--teal)]">{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save Draft</Button>}',
  'restore Save Draft for admin full edit',
);

replaceOnce(
  '{editingPaperHasAttempts && <Button type="button" disabled={saving || builder.attempts === originalAttemptLimit || builder.attempts < 1} onClick={() => void saveAttemptLimit()} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]">{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Update Attempts</Button>}',
  '{postAttemptLimitedEdit && <Button type="button" disabled={saving || builder.attempts === originalAttemptLimit || builder.attempts < 1} onClick={() => void saveAttemptLimit()} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]">{saving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Update Attempts</Button>}',
  'keep attempts-only action for non-admin staff',
);

replaceOnce(
  '{!editingPaperHasAttempts && builderStep < 5 && <Button type="button" disabled={saving} onClick={() => setBuilderStep((current) => Math.min(5, current + 1) as 1 | 2 | 3 | 4 | 5)} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]">Next</Button>}',
  '{!postAttemptLimitedEdit && builderStep < 5 && <Button type="button" disabled={saving} onClick={() => setBuilderStep((current) => Math.min(5, current + 1) as 1 | 2 | 3 | 4 | 5)} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]">Next</Button>}',
  'restore Next for admin full edit',
);

replaceOnce(
  '{!editingPaperHasAttempts && builderStep === 5 && submitStatus === \'published\' && (<Button type="button" disabled={saving || readinessLoading || !releaseCheckCurrent} onClick={() => void publishCheckedPaper()} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]"><Check className="mr-2 h-4 w-4" />Save and Publish</Button>)}',
  '{!postAttemptLimitedEdit && builderStep === 5 && submitStatus === \'published\' && (<Button type="button" disabled={saving || readinessLoading || !releaseCheckCurrent} onClick={() => void publishCheckedPaper()} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]"><Check className="mr-2 h-4 w-4" />Save and Publish</Button>)}',
  'restore publish for admin full edit',
);

replaceOnce(
  '{!editingPaperHasAttempts && builderStep === 5 && submitStatus !== \'published\' && (<Button type="button" disabled={saving} onClick={() => void savePaper(submitStatus)} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]"><Send className="mr-2 h-4 w-4" />Submit for Approval</Button>)}',
  '{!postAttemptLimitedEdit && builderStep === 5 && submitStatus !== \'published\' && (<Button type="button" disabled={saving} onClick={() => void savePaper(submitStatus)} className="h-11 bg-[var(--teal)] text-white hover:bg-[#0A4747]"><Send className="mr-2 h-4 w-4" />Submit for Approval</Button>)}',
  'restore submit for admin full edit',
);

const remainingHardLocks = [
  'disabled={editingPaperHasAttempts && item.step !== 4}',
  'disabled={editingPaperHasAttempts}',
  '!editingPaperHasAttempts && builderStep',
].filter((needle) => source.includes(needle));
if (remainingHardLocks.length) {
  throw new Error(`remaining admin hard locks: ${remainingHardLocks.join(', ')}`);
}

if (!source.includes("rpc('save_question_paper_revisioned_v1'")) {
  throw new Error('revision-safe save RPC was not installed');
}
if (!source.includes(".eq('is_active', true).order('display_order')")) {
  throw new Error('active revision filters were not installed');
}

fs.writeFileSync(path, source);
console.log('Applied full admin paper editing with revision-safe historical preservation.');
