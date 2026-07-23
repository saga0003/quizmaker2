import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

const branch = execFileSync("git", ["branch", "--show-current"], {
  encoding: "utf8",
}).trim();
const pkg = JSON.parse(read("package.json"));
const builder = read("src/components/papers/QuestionPaperBuilder.tsx");
const list = read("src/components/papers/QuestionPaperList.tsx");
const adminRoute = read("src/app/admin/papers/new/page.tsx");
const schoolRoute = read("src/app/school/papers/new/page.tsx");

assert.equal(
  branch,
  "evidara-v8-papers",
  `Wrong branch: ${branch || "detached"}. Switch to evidara-v8-papers before launching.`,
);
assert.equal(pkg.version, "8.0.0", "package.json is not the V8 release.");
assert.match(
  pkg.scripts["dev:codespaces"],
  /rm -rf \.next.*20242/,
  "The V8 Codespaces command must clear stale Next.js output and use port 20242.",
);

for (const marker of [
  "PaperGenerationPanel",
  "PaperLifecyclePanel",
  "PaperTemplatePanel",
  "PaperExportPanel",
  "PaperAuditPanel",
  'key: "blueprint"',
  'key: "preview"',
  "Loading V8 Paper Builder",
]) {
  assert.ok(builder.includes(marker), `V8 builder marker missing: ${marker}`);
}

for (const legacyMarker of [
  "without changing the V7 interface",
  "All logged-in students",
  "Attempts allowed",
  "Result display",
  "Opens at",
  "Closes at",
]) {
  assert.ok(
    !builder.includes(legacyMarker) && !list.includes(legacyMarker),
    `Legacy paper UI is still wired into the V8 paper components: ${legacyMarker}`,
  );
}

assert.ok(
  adminRoute.includes("QuestionPaperBuilder") && schoolRoute.includes("QuestionPaperBuilder"),
  "The admin and school new-paper routes must both load the V8 QuestionPaperBuilder.",
);
assert.ok(
  list.includes("${base}/new/"),
  "The Papers list must navigate to the V8 /new/ route instead of opening a legacy modal.",
);

console.log("V8 Papers launch verified.");
console.log(`Branch: ${branch}`);
console.log(`Version: ${pkg.version}`);
console.log("Admin builder: /admin/papers/new/");
console.log("School builder: /school/papers/new/");
console.log("Codespaces port: 20242");
