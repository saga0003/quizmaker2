import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const home = read("src/app/page.tsx");
const shell = read("src/components/DashboardShell.tsx");
const list = read("src/components/papers/QuestionPaperList.tsx");
const vercel = JSON.parse(read("vercel.json"));
const phaseDocument = read("docs/V8_PHASE_1_INTERFACE_FOUNDATION.md");

assert.match(home, /import \{ QuestionPaperList \} from ['"]@\/components\/papers\/QuestionPaperList['"];/);
assert.match(home, /view === ['"]admin-papers['"]\) return <QuestionPaperList kind=['"]admin['"] \/>/);
assert.match(home, /view === ['"]school-papers['"]\) return <QuestionPaperList kind=['"]school['"] \/>/);
assert.ok(!home.includes("LivePaperCatalogue"), "Legacy paper catalogue must remain disconnected.");
assert.match(shell, /Paper Builder/, "The native shell must identify the Papers workspace.");
assert.match(shell, /V8/, "The shell must identify V8 Papers.");
assert.ok(list.includes("PaperManagementDashboard"), "Phase 1 routing must lead to the real V8 management interface.");
assert.equal(vercel.git?.deploymentEnabled, false, "Vercel must remain disabled during UI work.");
assert.equal(vercel.buildCommand, "npm run qa");

for (const marker of [
  "evidara-v7-final-locked",
  "Real V8 Papers navigation",
  "Deployment lock restored",
  "Deferred to Phase 2",
  "Intentionally ignored or excluded",
]) assert.ok(phaseDocument.includes(marker), `Phase 1 documentation marker missing: ${marker}`);

console.log("V8 Phase 1 integration smoke passed under the responsive UI refresh boundary.");
