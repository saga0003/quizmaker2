import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };

check('builder has explicit five-step state', () => {
  assert.match(source, /const \[builderStep, setBuilderStep\] = useState<1 \| 2 \| 3 \| 4 \| 5>\(1\)/);
});
check('wizard exposes required five labels in order', () => {
  const basics = source.indexOf("label: 'Basics'");
  const questions = source.indexOf("label: 'Questions'");
  const settings = source.indexOf("label: 'Settings'");
  const preview = source.indexOf("label: 'Preview'");
  const publish = source.indexOf("label: 'Publish'");
  assert.ok(basics >= 0 && basics < questions && questions < settings && settings < preview && preview < publish);
});
check('new and reset flows always start on Basics', () => {
  const reset = source.match(/function resetBuilder\(\)[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(reset, /setBuilderStep\(1\)/);
});
check('Basics is isolated to step 1', () => {
  assert.match(source, /builderStep === 1[\s\S]{0,600}<SectionHeading number="1" title="Paper identity"/);
});
check('question selection is isolated to step 2', () => {
  assert.match(source, /builderStep === 2[\s\S]{0,600}title="Sections and selection strategy"/);
  assert.match(source, /builderStep === 2[\s\S]{0,700}title="Matching question bank"/);
});
check('delivery settings are isolated to step 3', () => {
  assert.match(source, /builderStep === 3[\s\S]{0,600}title="Delivery and student experience"/);
});
check('Preview has a dedicated step and launches learner preview', () => {
  assert.match(source, /builderStep === 4[\s\S]*?Review the learner-facing paper[\s\S]*?setPreviewOpen\(true\)/);
});
check('Publish has a dedicated final step', () => {
  assert.match(source, /builderStep === 5[\s\S]*?Ready to publish or submit/);
});
check('wizard provides Back and Next navigation', () => {
  assert.match(source, /setBuilderStep\(\(current\) => Math\.max\(1, current - 1\) as 1 \| 2 \| 3 \| 4 \| 5\)/);
  assert.match(source, /setBuilderStep\(\(current\) => Math\.min\(5, current \+ 1\) as 1 \| 2 \| 3 \| 4 \| 5\)/);
});
check('final publish action is not shown before step 5', () => {
  assert.match(source, /builderStep === 5 && \([\s\S]*?savePaper\(submitStatus\)/);
});
check('draft saving remains available throughout guided flow', () => {
  assert.match(source, /savePaper\('draft'\)/);
});

console.log(`D3 paper builder wizard smoke: ${checks.length}/${checks.length} checks passed`);
