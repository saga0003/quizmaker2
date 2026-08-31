import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const paperBuilder = read('src/components/evidara/live-paper-catalogue-v8.tsx');
const auth = read('src/context/AuthProvider.tsx');

const checks = [];
function check(label, condition) {
  if (!condition) throw new Error(`A10 regression failed: ${label}`);
  checks.push(label);
}

check('paper autosave derives an explicit tenant scope', paperBuilder.includes("const draftScope = kind === 'admin' ? 'platform' : organizationId || 'no-institution';"));
check('paper autosave key includes tenant scope after user and workspace kind', paperBuilder.includes("evidara-v8-paper:${user?.id || 'anonymous'}:${kind}:${draftScope}"));
check('paper autosave memo tracks organization scope changes', paperBuilder.includes('[draftScope, kind, user?.id]'));
check('unsafe pre-A10 paper namespace is retired', !paperBuilder.includes("evidara-v8-paper:${user?.id || 'anonymous'}:${kind}`, [kind, user?.id]"));
check('new paper recovery reads only the scoped draft namespace', paperBuilder.includes('localStorage.getItem(`${draftBase}:new`)'));
check('autosave writes only the scoped current draft key', paperBuilder.includes('localStorage.setItem(draftKey'));
check('first server persistence clears scoped new-paper draft', paperBuilder.includes('localStorage.removeItem(`${draftBase}:new`)'));
check('publish or approval clears the scoped current draft', paperBuilder.includes("if (status !== 'draft')") && paperBuilder.includes('localStorage.removeItem(key)'));
check('auth owns a single paper-draft prefix for cleanup', auth.includes('const PAPER_DRAFT_PREFIX = "evidara-v8-paper:"'));
check('legacy unscoped drafts are identified structurally', auth.includes('key.split(":").length === 4'));
check('legacy unscoped drafts are purged on authenticated session load', auth.includes('purgeLegacyUnscopedPaperDrafts(userId);'));
check('logout captures the signed-in user before session destruction', auth.includes('const signingOutUserId = session?.user.id;'));
check('logout clears all paper drafts for the signing-out user', auth.includes('clearPaperDraftsForUser(signingOutUserId)'));
check('draft cleanup is user-specific rather than global', auth.includes('const userPrefix = `${PAPER_DRAFT_PREFIX}${userId}:`') && auth.includes('key?.startsWith(userPrefix)'));
check('active institution storage remains independent from paper draft cleanup', auth.includes('evidara:active-organization:${userId}'));

console.log(`A10 local-autosave isolation checks passed (${checks.length}):`);
for (const label of checks) console.log(` - ${label}`);
