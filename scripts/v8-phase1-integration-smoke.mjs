import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const home = read("src/app/page.tsx");
const shell = read("src/components/DashboardShell.tsx");
const vercel = JSON.parse(read("vercel.json"));
const phaseDocument = read("docs/V8_PHASE_1_INTERFACE_FOUNDATION.md");

assert.match(
  home,
  /import \{ QuestionPaperList \} from ['"]@\/components\/papers\/QuestionPaperList['"];/,
  "The main Evidara dashboard must import the real V8 QuestionPaperList.",
);
assert.match(
  home,
  /view === ['"]admin-papers['"]\) return <QuestionPaperList kind=['"]admin['"] \/>/,
  "Admin Papers must render the real V8 paper catalogue.",
);
assert.match(
  home,
  /view === ['"]school-papers['"]\) return <QuestionPaperList kind=['"]school['"] \/>/,
  "School Papers must render the school-scoped V8 paper catalogue.",
);
assert.ok(
  !home.includes("LivePaperCatalogue"),
  "The main Papers navigation must not fall back to the legacy LivePaperCatalogue.",
);

assert.match(shell, /Paper Builder/, "The native shell must identify the Papers workspace.");
assert.match(shell, /V8 Papers/, "The native shell must visibly identify the V8 module.");
assert.match(
  shell,
  /No Vercel or production deployment is enabled/,
  "The V8 Papers shell must display the no-deployment boundary.",
);

assert.equal(
  vercel.git?.deploymentEnabled,
  false,
  "Vercel Git deployment must remain disabled throughout V8 Papers development.",
);

for (const marker of [
  "evidara-v7-final-locked",
  "Real V8 Papers navigation",
  "Deployment lock restored",
  "Deferred to Phase 2",
  "Intentionally ignored or excluded",
]) {
  assert.ok(phaseDocument.includes(marker), `Phase 1 documentation marker missing: ${marker}`);
}

console.log("V8 Phase 1 integration smoke passed.");
console.log("Admin and School Papers route to QuestionPaperList.");
console.log("Legacy LivePaperCatalogue is disconnected from the main Papers navigation.");
console.log("Vercel deployment remains disabled.");
