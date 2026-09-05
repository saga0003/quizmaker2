import fs from 'node:fs';
import assert from 'node:assert/strict';

const validator = fs.readFileSync('src/lib/server/uploadValidation.ts', 'utf8');
const r2 = fs.readFileSync('src/lib/server/r2.ts', 'utf8');
const privateStorage = fs.readFileSync('src/lib/server/privateResourceStorage.ts', 'utf8');

const checks = [
  ['shared validator exists', validator.includes('export function assertUploadSignature')],
  ['SVG explicitly rejected', validator.includes("contentType === 'image/svg+xml'") && validator.includes('looksLikeSvg(bytes)')],
  ['PNG signature checked', validator.includes('0x89, 0x50, 0x4e, 0x47')],
  ['JPEG signature checked', validator.includes('0xff, 0xd8, 0xff')],
  ['GIF signature checked', validator.includes("'GIF87a'") && validator.includes("'GIF89a'")],
  ['WebP RIFF signature checked', validator.includes("ascii(bytes, 0, 4) === 'RIFF'") && validator.includes("ascii(bytes, 8, 4) === 'WEBP'")],
  ['PDF header checked', validator.includes("ascii(bytes, 0, 5) === '%PDF-'")],
  ['OOXML ZIP signature checked', validator.includes('ZIP_MIME_TYPES') && validator.includes('0x50, 0x4b, 0x03, 0x04')],
  ['legacy Office OLE signature checked', validator.includes('OLE_MIME_TYPES') && validator.includes('0xd0, 0xcf, 0x11, 0xe0')],
  ['text rejects binary/NUL content', validator.includes('if (byte === 0) return false')],
  ['question assets validate before R2 upload', r2.includes('uploadQuestionAssetToR2') && r2.includes('assertUploadSignature({ bytes: input.bytes')],
  ['platform resources validate server-side', r2.includes('uploadResourceFileToR2') && r2.includes('allowedMimeTypes: resourceMimeTypes')],
  ['PYQ assets validate server-side', r2.includes('uploadPyqV19AssetToR2') && !r2.includes('"image/svg+xml"')],
  ['private institution resources validate server-side', privateStorage.includes('assertUploadSignature({')],
  ['private resources do not allow SVG MIME', !privateStorage.includes("'image/svg+xml'" )],
];

for (const [name, passed] of checks) {
  assert.equal(passed, true, `A6 failed: ${name}`);
  console.log(`✓ ${name}`);
}

console.log(`A6 upload hardening checks passed (${checks.length}/${checks.length}).`);
