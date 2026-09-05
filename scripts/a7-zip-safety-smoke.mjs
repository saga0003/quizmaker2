import fs from 'node:fs';
import assert from 'node:assert/strict';

const zipReader = fs.readFileSync('src/lib/zipReader.ts', 'utf8');
const latexImport = fs.readFileSync('src/lib/evidaraLatexPaperImport.ts', 'utf8');

const ratioCheckAt = zipReader.indexOf('compressionRatio > limits.maxCompressionRatio');
const inflateAt = zipReader.indexOf('await inflateRaw(compressed)');
const expandedCheckAt = zipReader.indexOf('totalExpandedBytes > limits.maxExpandedBytes');

const checks = [
  ['central ZIP safety limits exported', zipReader.includes('export const DEFAULT_ZIP_SAFETY_LIMITS')],
  ['compressed archive size capped', zipReader.includes('input.byteLength > limits.maxCompressedBytes')],
  ['file count capped from central directory', zipReader.includes('count > limits.maxEntries')],
  ['per-entry expanded size capped before inflation', zipReader.includes('expandedSize > limits.maxEntryBytes')],
  ['aggregate expanded size capped', expandedCheckAt >= 0],
  ['compression ratio capped', ratioCheckAt >= 0 && zipReader.includes('maxCompressionRatio: 100')],
  ['zero-byte compressed payload cannot claim nonzero expansion', zipReader.includes('Number.POSITIVE_INFINITY')],
  ['ratio guard runs before decompression', ratioCheckAt >= 0 && inflateAt >= 0 && ratioCheckAt < inflateAt],
  ['expanded aggregate guard runs before decompression', expandedCheckAt >= 0 && inflateAt >= 0 && expandedCheckAt < inflateAt],
  ['ZIP data range bounds checked', zipReader.includes('dataEnd > bytes.length')],
  ['actual inflated size must match central-directory declaration', zipReader.includes('expanded.byteLength !== expandedSize')],
  ['LaTeX ZIP import uses shared hardened reader', latexImport.includes('readZip(await file.arrayBuffer())')],
];

for (const [name, passed] of checks) {
  assert.equal(passed, true, `A7 failed: ${name}`);
  console.log(`✓ ${name}`);
}

console.log(`A7 ZIP safety checks passed (${checks.length}/${checks.length}).`);
