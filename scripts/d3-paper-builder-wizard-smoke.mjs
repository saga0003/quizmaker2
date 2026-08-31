import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('builder has explicit five-step state', () => {
  assert.ok(source.includes('const [builderStep, setBuilderStep] = useState<1 | 2 | 3 | 4 | 5>(1);'));
});
check('wizard exposes the five required labels in order', () => {
  const navStart = source.indexOf("{ step: 1 as const, label: 'Basics' }");
  const navEnd = source.indexOf(']).map((item)', navStart);
  assert.ok(navStart >= 0 && navEnd > navStart);
  const nav = source.slice(navStart, navEnd);
  const labels = ["label: 'Basics'", "label: 'Questions'", "label: 'Settings'", "label: 'Preview'", "label: 'Publish'"];
  const positions = labels.map((label) => nav.indexOf(label));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
});
check('new and edit flows start at Basics', () => {
  assert.ok(source.includes('function resetBuilder() {\nsetBuilderStep(1);'));
  assert.ok(source.includes('async function openEdit(paper: PaperListRow) {\nif (!supabase) return;\nsetBuilderStep(1);'));
});
check('step-specific content exists for Basics, Questions and Settings', () => {
  assert.ok(source.includes('{builderStep === 1 && (\n<Card'));
  assert.ok(source.includes('<SectionHeading number="1" title="Paper identity"'));
  assert.ok(source.includes('{builderStep === 2 && (\n<Card'));
  assert.ok(source.includes('title="Sections and selection strategy"'));
  assert.ok(source.includes('title="Matching question bank"'));
  assert.ok(source.includes('title="Paper questions"'));
  assert.ok(source.includes('{builderStep === 3 && (\n<Card'));
  assert.ok(source.includes('title="Delivery and student experience"'));
});
check('Preview is a dedicated step with one-click learner preview', () => {
  assert.ok(source.includes('{builderStep === 4 && ('));
  assert.ok(source.includes('title="Preview" description="Review the learner-facing paper before moving to the final publish step."'));
  assert.ok(source.includes('onClick={() => setPreviewOpen(true)}'));
  assert.ok(source.includes('Open learner preview'));
});
check('Publish is a dedicated final step', () => {
  assert.ok(source.includes('{builderStep === 5 && ('));
  assert.ok(source.includes('title="Publish" description="Ready to publish or submit? Review the paper summary, then use the final action below."'));
});
check('wizard provides Back and Next navigation', () => {
  assert.ok(source.includes('Math.max(1, current - 1) as 1 | 2 | 3 | 4 | 5'));
  assert.ok(source.includes('Math.min(5, current + 1) as 1 | 2 | 3 | 4 | 5'));
});
check('draft saving remains available during the guided flow', () => {
  assert.ok(source.includes("onClick={() => void savePaper('draft')}"));
  assert.ok(source.includes('Save Draft'));
});
check('final publish or submit action is gated to step 5', () => {
  assert.ok(source.includes('{builderStep === 5 && (<Button type="button" disabled={saving} onClick={() => void savePaper(submitStatus)}'));
});

console.log(`D3 paper builder wizard smoke: ${checks.length}/${checks.length} checks passed`);
