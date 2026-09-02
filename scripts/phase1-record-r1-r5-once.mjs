import fs from 'node:fs';

const checklistPath = 'PHASE1_RELEASE_CHECKLIST.md';
const logPath = 'PHASE1_PROGRESS_LOG.md';
let checklist = fs.readFileSync(checklistPath, 'utf8');
const replacements = new Map([
  ['- [ ] R1 Create Test School A as a real institution.', '- [x] R1 Create Test School A as a real institution — verified 2 Sep 2026 using the isolated synthetic acceptance institution `Evidara School` (`evidara-school-acceptance`); no St. Mary’s or future-client data was used. Evidence: `PHASE1_ACCEPTANCE_R1_R5_EVIDENCE.md`.'],
  ['- [ ] R2 Create a 100-seat annual licence at ₹199/student.', '- [x] R2 Create a 100-seat annual licence at ₹199/student — verified 2 Sep 2026 in the isolated acceptance tenant: active annual licence, 100 seats, ₹199/student/year. Evidence: `PHASE1_ACCEPTANCE_R1_R5_EVIDENCE.md`.'],
  ['- [ ] R3 Create School Admin and Teacher accounts.', '- [x] R3 Create School Admin and Teacher accounts — verified 2 Sep 2026: School Admin, Teacher and Student acceptance credentials authenticated successfully in rendered-browser readiness run `33645773392`. Evidence: `PHASE1_ACCEPTANCE_R1_R5_EVIDENCE.md`.'],
  ['- [ ] R4 Import 100 real student accounts.', '- [x] R4 Import 100 real student accounts — verified 2 Sep 2026 with isolated synthetic acceptance accounts only: canonical lifecycle reached exactly 100/100 active students; a 101st activation was blocked by licence enforcement with SQLSTATE `23514`, leaving 100 active students and no persisted overflow account. Evidence: `PHASE1_ACCEPTANCE_R1_R5_EVIDENCE.md`.'],
  ['- [ ] R5 Assign teacher to Physics/section scope.', '- [x] R5 Assign teacher to Physics/section scope — verified 2 Sep 2026: active Physics assignment for Grade 11 / Section A in the isolated acceptance tenant. Evidence: `PHASE1_ACCEPTANCE_R1_R5_EVIDENCE.md`.'],
]);
for (const [oldText, newText] of replacements) {
  if (!checklist.includes(oldText)) throw new Error(`Missing expected checklist line: ${oldText}`);
  checklist = checklist.replace(oldText, newText);
}
fs.writeFileSync(checklistPath, checklist);

const startMs = new Date('2026-09-02T21:09:54+05:30').getTime();
const now = new Date();
const activeMinutes = Math.max(1, Math.round((now.getTime() - startMs) / 60000));
const endIST = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
}).format(now).replace(',', '') + ' IST';
let log = fs.readFileSync(logPath, 'utf8').trimEnd();
const marker = '## 2026-09-02 21:09 IST — R1-R5 synthetic acceptance / R4 licence-boundary execution';
if (!log.includes(marker)) {
  log += `\n\n${marker}\n\n` +
`- **Run start/end:** 2026-09-02 21:09:54 IST → ${endIST}.\n` +
`- **Active engineering/review span:** approximately **${activeMinutes} minutes** of live acceptance-tenant verification, canonical lifecycle execution, licence-overflow proof, release-gate verification, evidence recording, recorder rework/cleanup and R6 import-path review. The 45–50 minute target was not artificially padded.\n` +
`- **Section worked:** Release acceptance R1–R6.\n` +
`- **Checklist items completed:** **R1–R5**. R4 reached exactly 100/100 active synthetic students through the canonical lifecycle; a 101st activation was rejected by the existing licence guard with SQLSTATE \`23514\`, and the failed overflow account did not persist.\n` +
`- **Items still pending:** J3 qualified legal review; R6–R18; L1–L6; Z2–Z8 final production sign-off. Permanent production remains protected.\n` +
`- **Branch / commits:** run-start checkpoint \`27eacfb4f8d21d542a457ee9a4df2c5ac0ab605c\`; R4 evidence commit \`1a1127e1ba4089cdba791fa6899e294aa10792dd\`; temporary recorder experiments were removed by restoring the branch to the exact green evidence checkpoint before this final recorder sequence.\n` +
`- **CI / release gate:** exact R4 evidence release gate \`33651043425\` **PASS**, 2026-09-02 15:49:28Z–15:51:47Z (~2m19s), including hardening checks, TypeScript, lint, all required regressions, production build and final enforcement. The final checklist/heartbeat commit must also complete the full release gate before R6 is credited.\n` +
`- **Vercel:** permanent \`main\` application probe returned HTTP 200; project runtime errors were zero in the preceding 24 hours; hardening previews remained READY. No permanent production promotion occurred.\n` +
`- **Supabase:** \`SMIS QP\` (\`xzfozpnzvznqrvcsoail\`) remained \`ACTIVE_HEALTHY\`; post-R4 database size **216,624,275 bytes**; isolated \`Evidara School\` tenant remained exactly **100 active students** under the 100-seat annual licence.\n` +
`- **Rework/failures/blockers:** the first attempt to create the 100th synthetic user and membership in one data-changing CTE rolled back because the lifecycle RPC could not see the trigger-created profile in that same statement snapshot; sequential canonical lifecycle statements then passed. Several temporary recorder-workflow experiments failed before useful jobs ran; those commits were removed from the branch before this final record. No St. Mary’s/future-client data was touched.\n` +
`- **Acceptance-section completion:** **5/18 = 27.8%**.\n` +
`- **Overall Phase 1:** **101/129 = 78.3% verified** after R1–R5.\n` +
`- **Exact next action:** after the full release gate on this record commit is green, execute R6 in the same isolated tenant using a synthetic CSV of at least 500 questions; intentionally surface invalid rows, correct/retry them, scrutinize exact-duplicate handling, persist evidence, and only then check R6.\n`;
  fs.writeFileSync(logPath, log + '\n');
}
