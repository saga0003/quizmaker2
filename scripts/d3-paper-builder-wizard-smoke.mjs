import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');
const assignment = fs.readFileSync('src/components/evidara/paper-assignment-center.tsx', 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('builder has explicit five-step state', () => {
  assert.ok(source.includes('const [builderStep, setBuilderStep] = useState<1 | 2 | 3 | 4 | 5>(1);'));
});
check('wizard exposes Phase 1 labels in required order', () => {
  const navStart = source.indexOf("{ step: 1 as const, label: 'Details' }");
  const navEnd = source.indexOf(']).map((item)', navStart);
  assert.ok(navStart >= 0 && navEnd > navStart);
  const nav = source.slice(navStart, navEnd);
  const labels = ["label: 'Details'", "label: 'Questions'", "label: 'Audience'", "label: 'Settings'", "label: 'Preview & Publish'"];
  const positions = labels.map((label) => nav.indexOf(label));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});
check('new and edit flows start at Details', () => {
  assert.ok(source.includes('function resetBuilder() {\nsetBuilderStep(1);'));
  assert.ok(source.includes('async function openEdit(paper: PaperListRow) {\nif (!supabase) return;\nsetBuilderStep(1);'));
});
check('Questions remains the dedicated selection step', () => {
  assert.ok(source.includes('{builderStep === 2 && ('));
  assert.ok(source.includes('title="Sections and selection strategy"'));
  assert.ok(source.includes('title="Matching question bank"'));
  assert.ok(source.includes('title="Paper questions"'));
});
check('Audience is an explicit third step using the hardened assignment engine', () => {
  assert.ok(source.includes('{builderStep === 3 && ('));
  assert.ok(source.includes('title="Audience"'));
  assert.ok(source.includes('<PaperAssignmentCenter paperId={builder.id} embedded />'));
  assert.ok(source.includes('Save draft to configure audience'));
  assert.ok(assignment.includes('preview_paper_assignment_v19'));
  assert.ok(assignment.includes('assign_paper_audience_v19'));
});
check('embedded audience is locked to the current paper', () => {
  assert.ok(assignment.includes('paperId: fixedPaperId'));
  assert.ok(assignment.includes('fixedPaperId || current'));
  assert.ok(assignment.includes('{!fixedPaperId && <div>'));
});
check('Settings is step four', () => {
  assert.ok(source.includes('{builderStep === 4 && ('));
  assert.ok(source.includes('<SectionHeading number="4" title="Delivery and student experience"'));
});
check('Preview and publish share the final step', () => {
  assert.ok(source.includes('{builderStep === 5 && ('));
  assert.ok(source.includes('title="Preview & Publish"'));
  assert.ok(source.includes('Open learner preview'));
  assert.ok(source.includes('title="Publish"'));
});
check('wizard provides Back and Next navigation', () => {
  assert.ok(source.includes('Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5'));
  assert.ok(source.includes('Math.min(5, current + 1) as 1 | 2 | 3 | 4 | 5'));
});
check('draft saving remains available throughout the guided flow', () => {
  assert.ok(source.includes("onClick={() => void savePaper('draft')}"));
  assert.ok(source.includes('Save Draft'));
});
check('final publish or submit action is gated to step 5', () => {
  assert.ok(source.includes("{builderStep === 5 && submitStatus === 'published' && ("));
  assert.ok(source.includes('onClick={() => void publishCheckedPaper()}'));
  assert.ok(source.includes('disabled={saving || readinessLoading || !releaseCheckCurrent}'));
  assert.ok(source.includes("{builderStep === 5 && submitStatus !== 'published' && ("));
  assert.ok(source.includes('onClick={() => void savePaper(submitStatus)}'));
});

console.log(`D3 paper builder wizard smoke: ${checks.length}/${checks.length} checks passed`);
