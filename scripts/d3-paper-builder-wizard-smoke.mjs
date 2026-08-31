import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');
const checks = [];
const check = (name, fn) => { fn(); checks.push(name); };
const stepToken = (step) => `{builderStep === ${step} && (`;

check('builder has explicit five-step state', () => {
  assert.match(source, /const \[builderStep, setBuilderStep\] = useState<1 \| 2 \| 3 \| 4 \| 5>\(1\)/);
});
check('wizard exposes required five labels in order', () => {
  const labels = ['Basics', 'Questions', 'Settings', 'Preview', 'Publish'];
  const positions = labels.map((label) => source.indexOf(`label: '${label}'`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});
check('new and reset flows always start on Basics', () => {
  const reset = source.match(/function resetBuilder\(\)[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(reset, /setBuilderStep\(1\)/);
});
check('Basics is isolated to step 1', () => {
  const start = source.indexOf(stepToken(1));
  const heading = source.indexOf('<SectionHeading number="1" title="Paper identity"', start);
  assert.ok(start >= 0 && heading > start);
});
check('question selection is isolated to step 2', () => {
  const starts = [];
  let cursor = 0;
  while ((cursor = source.indexOf(stepToken(2), cursor)) >= 0) { starts.push(cursor); cursor += stepToken(2).length; }
  assert.ok(starts.length >= 2);
  const sectionsHeading = source.indexOf('title="Sections and selection strategy"', starts[0]);
  const bankHeading = source.indexOf('title="Matching question bank"', starts[1]);
  assert.ok(sectionsHeading > starts[0] && bankHeading > starts[1]);
});
check('delivery settings are isolated to step 3', () => {
  const start = source.indexOf(stepToken(3));
  assert.ok(start >= 0 && source.indexOf('title="Delivery and student experience"', start) > start);
});
check('Preview has a dedicated step and launches learner preview', () => {
  const start = source.indexOf(stepToken(4));
  const copy = source.indexOf('Review the learner-facing paper', start);
  const action = source.indexOf('setPreviewOpen(true)', copy);
  assert.ok(start >= 0 && copy > start && action > copy);
});
check('Publish has a dedicated final step', () => {
  const start = source.indexOf(stepToken(5));
  assert.ok(start >= 0 && source.indexOf('Ready to publish or submit', start) > start);
});
check('wizard provides Back and Next navigation', () => {
  assert.match(source, /setBuilderStep\(\(current\) => Math\.max\(1, current - 1\) as 1 \| 2 \| 3 \| 4 \| 5\)/);
  assert.match(source, /setBuilderStep\(\(current\) => Math\.min\(5, current \+ 1\) as 1 \| 2 \| 3 \| 4 \| 5\)/);
});
check('final publish action is not shown before step 5', () => {
  const footerGate = source.lastIndexOf(stepToken(5));
  assert.ok(footerGate >= 0 && source.indexOf('savePaper(submitStatus)', footerGate) > footerGate);
});
check('draft saving remains available throughout guided flow', () => {
  assert.match(source, /savePaper\('draft'\)/);
});

console.log(`D3 paper builder wizard smoke: ${checks.length}/${checks.length} checks passed`);
