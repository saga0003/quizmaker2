import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const governance = read('PHASE1_PRIVACY_GOVERNANCE.md');
const pkg = JSON.parse(read('package.json'));
const a3 = read('scripts/a3-privileged-audit-smoke.mjs');
const p012 = read('scripts/p012-credential-security-smoke.mjs');
const p05 = read('scripts/phase1-hardening-smoke.mjs');

const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
const forbiddenAiPackages = Object.keys(deps).filter((name) =>
  /(^|\/)(openai|anthropic|@anthropic-ai|@google\/generative-ai|@google\/genai|groq-sdk|cohere-ai|mistralai|replicate)(\/|$)/i.test(name),
);

const checks = [
  ['J1 identifies parent data as optional and non-analytic', governance.includes('parent_name') && governance.includes('parent_phone') && governance.includes('not an analytics dimension')],
  ['J1 prohibits unnecessary sensitive-data expansion', governance.includes('government identifiers') && governance.includes('medical data') && governance.includes('biometrics')],
  ['J1 keeps audit/health data minimised', governance.includes('Never log passwords') && governance.includes('Operational health endpoints must remain aggregate/sanitised')],
  ['J2 defines retention classes', governance.includes('Retention classes') && governance.includes('Assessment records') && governance.includes('Security/audit records')],
  ['J2 defines institution-scoped export', governance.includes('Institution export') && governance.includes('Cross-school data must never be included')],
  ['J2 defines controlled termination/deletion', governance.includes('Termination/deletion workflow') && governance.includes('never use an ad-hoc unreviewed production cascade')],
  ['J2 refuses untested destructive deletion', governance.includes('separately tested against a disposable tenant') && governance.includes('not an untested hard delete')],
  ['J4 states no automatic external AI provider dependency', governance.includes('no automatic external AI SDK/provider dependency') && forbiddenAiPackages.length === 0],
  ['J4 restricts future AI helper to question content', governance.includes('question-content conversion assistance') && governance.includes('Student identity') && governance.includes('excluded from the payload')],
  ['J4 requires explicit external-processing disclosure', governance.includes('explicit operator action') && governance.includes('external processor will receive the selected question content')],
  ['J4 keeps AI output behind normal import gates', governance.includes('same validation, duplicate, safety and approval gates')],
  ['J5 documents explicit institution-scoped support access', governance.includes('explicit institution scope') && governance.includes('support audit event')],
  ['J5 preserves read-only View As', governance.includes('Read-only Super Admin View As cannot write')],
  ['J5 preserves privileged MFA/AAL2 cutover', governance.includes('MFA/AAL2') && governance.includes('Z8')],
  ['J5 existing privileged audit regression remains present', a3.includes('support.analytics.view') || a3.includes('privileged')],
  ['J5 credential security regression remains present', p012.includes('aal2') || p012.includes('AAL2')],
  ['tenant/security hardening contract remains present', p05.includes('tenant') || p05.includes('organization')],
  ['J3 is explicitly not self-certified', governance.includes('J3 remains open') && governance.includes('qualified counsel') && governance.includes('must not self-certify legal compliance')],
  ['DPDP legal handoff includes children and breach review', governance.includes('children') && governance.includes('personal-data-breach')],
  ['no known external AI SDK dependency is installed', forbiddenAiPackages.length === 0],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} J: ${name}`);
  if (!ok) failed += 1;
}
if (failed) {
  console.error(`J privacy-governance regression failed: ${failed}/${checks.length}`);
  process.exit(1);
}
console.log(`J privacy-governance regression passed: ${checks.length}/${checks.length}`);
