import fs from 'node:fs';
const source = fs.readFileSync('src/components/evidara/live-paper-catalogue-v8.tsx', 'utf8');
const required = [
  'title="Edit paper"', 'title="Preview paper"', 'title="Duplicate paper"', 'title="Test Results"', 'title="Analytics"', 'title="Export"', 'title="Archive paper"',
  ".from('exam_attempts')", ".eq('paper_id', paper.id)", "openPaperAction(paper, 'results')", "openPaperAction(paper, 'analytics')", 'exportPaperResults(paper)', 'openPaperPreview(paper)',
  "replace(/[^a-z0-9_-]+/gi, '-')", "type: 'text/csv;charset=utf-8'", 'limit(500)'
];
const missing = required.filter((token) => !source.includes(token));
if (missing.length) { console.error('D7 paper-card actions regression failed:', missing); process.exit(1); }
const order = ['title="Edit paper"','title="Preview paper"','title="Duplicate paper"','title="Test Results"','title="Analytics"','title="Export"'];
let last = -1; for (const token of order) { const idx = source.indexOf(token); if (idx <= last) { console.error('D7 action order regression:', token); process.exit(1); } last = idx; }
console.log('D7 paper-card actions smoke passed (real preview/results/analytics/export plus edit/duplicate/archive).');
