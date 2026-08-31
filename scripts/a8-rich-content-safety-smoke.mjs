import fs from 'node:fs';

const files = {
  math: 'src/components/evidara/rich-math-content.tsx',
  editor: 'src/components/evidara/question-editor-dialog.tsx',
  preview: 'src/components/evidara/question-device-preview.tsx',
  source: 'src/components/evidara/source-fidelity-content.tsx',
};

const read = (path) => fs.readFileSync(path, 'utf8');
const math = read(files.math);
const editor = read(files.editor);
const preview = read(files.preview);
const source = read(files.source);

const assertions = [
  ['rich math rendering has no app-owned dangerouslySetInnerHTML sink', !math.includes('dangerouslySetInnerHTML')],
  ['rich math rendering uses react-katex', math.includes('from "react-katex"') || math.includes("from 'react-katex'")],
  ['KaTeX trust is explicitly disabled', /trust:\s*false/.test(math)],
  ['KaTeX errors render as React text/code rather than interpolated HTML', math.includes('<code>{safeFallback(normalized)}</code>')],
  ['question authoring is structured field input', editor.includes("import { Textarea } from '@/components/ui/textarea'" )],
  ['question authoring does not use contentEditable', !editor.includes('contentEditable')],
  ['question authoring does not use dangerouslySetInnerHTML', !editor.includes('dangerouslySetInnerHTML')],
  ['question preview does not use dangerouslySetInnerHTML', !preview.includes('dangerouslySetInnerHTML')],
  ['source-fidelity renderer does not use dangerouslySetInnerHTML', !source.includes('dangerouslySetInnerHTML')],
  ['source-fidelity renderer uses React image/svg nodes', source.includes('<img') && source.includes('<svg') && source.includes('<image')],
  ['raw HTML markdown rendering is not enabled in the question editor', !editor.includes('rehypeRaw') && !editor.includes('remark-html')],
  ['iframe/srcDoc rich content injection is absent from question editor', !editor.includes('srcDoc') && !editor.includes('<iframe')],
];

let failed = 0;
for (const [label, ok] of assertions) {
  if (ok) console.log(`PASS: ${label}`);
  else {
    console.error(`FAIL: ${label}`);
    failed += 1;
  }
}

if (failed) {
  console.error(`A8 rich-content safety checks failed: ${failed}/${assertions.length}`);
  process.exit(1);
}

console.log(`A8 rich-content safety checks passed: ${assertions.length}/${assertions.length}`);
