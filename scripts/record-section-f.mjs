import fs from 'node:fs';

const checklistPath = 'PHASE1_RELEASE_CHECKLIST.md';
let checklist = fs.readFileSync(checklistPath, 'utf8');
const old12 = '- [ ] F12 Excel export for test results and student×subject/chapter/topic analytics.';
const new12 = '- [x] F12 Excel export for test results and student×subject/chapter/topic analytics — verified 1 Sep 2026. Exact candidate `23bcae9726c3e4493e478053be4b4995cf7a10db` passed complete release gate `33521024715`; the class workspace now creates a genuine `.xlsx` workbook with Results, Test Results, Subject Analytics, Chapter Analytics and Topic Analytics sheets using authorized student analytics evidence, and the permanent 13-point F12 regression is enforced in the release gate.';
const old13 = '- [ ] F13 Heavy institutional aggregates progressively move to database-side aggregation where needed for scale.';
const new13 = '- [x] F13 Heavy institutional aggregates progressively move to database-side aggregation where needed for scale — verified 1 Sep 2026. Live migration `phase1_institution_attempt_aggregate_scaling` adds the partial submitted-attempt index and service-role-only `get_institution_student_attempt_metrics_v1`; school/programme/grade summary paths now aggregate inside PostgreSQL while question-evidence paths retain raw attempt IDs only where required. Exact candidate `cd70cb3e756f54604b2e80d8226310d88a89ee07` passed complete release gate `33521642436` including the permanent 13-point F13 regression, TypeScript, lint, every existing regression and production build.';
if (!checklist.includes(old12) || !checklist.includes(old13)) throw new Error('F12/F13 checklist anchors missing or already changed');
checklist = checklist.replace(old12, new12).replace(old13, new13);
fs.writeFileSync(checklistPath, checklist);

const logPath = 'PHASE1_PROGRESS_LOG.md';
const entry = `

## 2026-09-01 19:58:37 IST — F12/F13 analytics export + aggregate scaling verified / hourly heartbeat

- **Run start/end:** 2026-09-01 19:58:37 IST → approximately 20:21 IST for engineering/release verification; logging/cleanup continued immediately afterward.
- **Active engineering/review span:** approximately **22 minutes** through final F13 gate confirmation, plus checklist/log cleanup. The requested 45–50 minute target was **not met because this tool execution window ended materially earlier**; no idle padding was added.
- **Section worked:** F — Analytics, results and reporting.
- **Checklist items completed:** **F12** real Excel analytics export and **F13** database-side heavy institutional aggregate scaling. Section F is now **13/13 verified (100%)**.
- **Starting branch head:** \`3eaf57381f7a4bb09a8d47f6cf4696bea95f1c6b\`.
- **Functional commits/candidates:** F12 product \`2aacc2e64d94d415088bdeec1aa9d35e1266c8f7\`, exact cleaned F12 candidate \`23bcae9726c3e4493e478053be4b4995cf7a10db\`; F13 product \`c5113d727262733087343f683dd98d4fb1c6548e\`, exact cleaned F13 candidate \`cd70cb3e756f54604b2e80d8226310d88a89ee07\`.
- **F12 implementation:** Added pinned \`exceljs\` 4.4.0 and an on-demand genuine \`.xlsx\` exporter with Results, Test Results, Subject Analytics, Chapter Analytics and Topic Analytics sheets. Evidence uses the already-authorized \`get_student_analytics_v12\` RPC in bounded batches.
- **F12 CI:** release gate \`33521024715\` — **PASS**, approximately **2m19s**, including the permanent 13-point F12 smoke, TypeScript, lint, all prior regressions, production build and final enforcement.
- **F13 implementation:** Live Supabase migration \`phase1_institution_attempt_aggregate_scaling\` added \`exam_attempts_org_student_submitted_idx\` and service-role-only \`get_institution_student_attempt_metrics_v1\`. School/class/programme/grade summaries now aggregate inside PostgreSQL in batches of at most 500 student IDs; question-evidence paths intentionally retain raw attempt IDs where needed.
- **F13 Supabase:** project remained \`ACTIVE_HEALTHY\`; RPC execute is allowed for \`service_role\` and denied to \`anon\`/\`authenticated\`; index is present; a live scoped aggregate probe returned expected evidence.
- **F13 CI:** exact candidate \`cd70cb3e756f54604b2e80d8226310d88a89ee07\`, release gate \`33521642436\` — **PASS**, 2026-09-01 20:17:16–20:20:32 IST (**3m16s**), including F13 smoke, every earlier hardening/regression suite, TypeScript, lint and production build.
- **Vercel/production:** fresh runtime inspection found **no production runtime errors in the preceding 24 hours**. Permanent production was not promoted or changed.
- **Rework/failures:** F12 caught and fixed exact dependency pinning, nullable client narrowing and an overly variable-name-coupled smoke assertion before the final candidate. F13 had normal intermediate workflow/concurrency churn. The first heartbeat recorder was rejected before creating jobs and was replaced by this minimal recorder. No unresolved product failure remains.
- **Pending:** Section G onward, real-school acceptance, load acceptance and final production sign-off.
- **Section progress:** F = **13/13 (100%)**.
- **Overall Phase 1 progress:** **71/129 verified (55.0%)**.
- **Exact next action:** Begin **G1** by auditing the canonical \`₹199 × licensed students × annual licence period\` model end-to-end, then harden G1–G6 sequentially with permanent regressions and complete release gates.
`;
fs.appendFileSync(logPath, entry);
