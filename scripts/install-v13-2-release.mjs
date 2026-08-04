import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const releaseDir = join(root, '.release', 'v13.2');
const requiredSource = join(root, 'src', 'components', 'analytics-v12', 'student-analytics-v12.tsx');
const expectedSha256 = '1c17f266e366ca48fd14641b4c735044ba84a08e068020fcbc70c0d34b703074';

if (!existsSync(releaseDir)) {
  if (existsSync(requiredSource)) process.exit(0);
  throw new Error('V13.2 release archive is missing and the analytics source has not been installed.');
}

const parts = readdirSync(releaseDir)
  .filter((name) => /^part-\d+$/.test(name))
  .sort();

if (parts.length !== 3) {
  throw new Error(`Expected 3 V13.2 release parts, found ${parts.length}.`);
}

const encoded = parts.map((name) => readFileSync(join(releaseDir, name), 'utf8')).join('');
const archive = Buffer.from(encoded, 'base64');
const actualSha256 = createHash('sha256').update(archive).digest('hex');

if (actualSha256 !== expectedSha256) {
  throw new Error(`V13.2 archive checksum mismatch: expected ${expectedSha256}, received ${actualSha256}.`);
}

const temp = mkdtempSync(join(tmpdir(), 'evidara-v13-2-'));
const archivePath = join(temp, 'release.tar.gz');
writeFileSync(archivePath, archive);

try {
  execFileSync('tar', ['-xzf', archivePath, '-C', root], { stdio: 'inherit' });
} finally {
  rmSync(temp, { recursive: true, force: true });
}

if (!existsSync(requiredSource)) {
  throw new Error('V13.2 archive was extracted, but the analytics workspace is still missing.');
}

console.log('Evidara V13.2 source verified and installed.');
