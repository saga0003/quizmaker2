import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");
const pkg = JSON.parse(read("package.json"));
const vercel = JSON.parse(read("vercel.json"));
const layout = read("src/app/layout.tsx");
const shell = read("src/components/DashboardShell.tsx");
const responsive = read("src/app/evidara-papers-responsive.css");
const list = read("src/components/papers/QuestionPaperList.tsx");
const dashboard = read("src/components/papers/PaperManagementDashboard.tsx");
const studio = read("src/components/papers/QuestionGenerationStudio.tsx");
const builder = read("src/components/papers/QuestionPaperBuilder.tsx");

assert.equal(pkg.version, "8.0.0-ui-refresh", "The UI branch must use the UI refresh version label.");
assert.equal(vercel.git?.deploymentEnabled, false, "Incomplete UI work must never deploy to Vercel.");
assert.equal(vercel.buildCommand, "npm run qa", "The later approved deployment must still run all QA gates.");
assert.ok(layout.includes('import "./evidara-papers-responsive.css"'), "The responsive Papers stylesheet must be loaded globally.");

for (const marker of [
  "lg:w-[68px]",
  "lg:w-64",
  "max-w-7xl",
  "mobileOpen",
  "Open navigation",
  "Close navigation overlay",
  "min-h-11",
  "bg-[#14232B]",
  "bg-[#0E5A5A]",
  "bg-[#F2B84B]",
  "evidara_sidebar_collapsed",
]) assert.ok(shell.includes(marker), `Responsive V7 shell marker missing: ${marker}`);

for (const marker of [
  "@media (max-width: 1240px)",
  "@media (max-width: 960px)",
  "@media (max-width: 640px)",
  ".v8-builder-layout",
  ".v8-step-nav",
  ".v8-save-actions",
  ".v8-question-bank > article",
  ".arrangement-actions",
  ".v8-builder-footer",
  ".paper-modal-card",
  "max-height: 90dvh",
  "overflow-y: auto",
  "prefers-reduced-motion",
]) assert.ok(responsive.includes(marker), `Responsive stylesheet marker missing: ${marker}`);

for (const marker of [
  "paper-workspace",
  "Assessment workspace",
  "Generation Studio",
  "Create paper",
  "rounded-2xl",
]) assert.ok(list.includes(marker), `Papers home UI marker missing: ${marker}`);

for (const marker of [
  "xl:hidden",
  "xl:block",
  "Filters and search",
  "More actions",
  "min-h-11",
  "paper-modal",
  "role=\"dialog\"",
  "Duplicate",
  "New version",
  "Restore Draft",
]) assert.ok(dashboard.includes(marker), `Responsive paper catalogue marker missing: ${marker}`);

for (const marker of [
  "paper-generation-workspace",
  "overflow-x-auto",
  "min-w-max",
  "toggleVisible",
  "w-full justify-center sm:w-auto",
  "xl:sticky",
  "h-11 w-11",
  "grid grid-cols-2",
]) assert.ok(studio.includes(marker), `Responsive Generation Studio marker missing: ${marker}`);

for (const marker of [
  'activeStep === "details"',
  'activeStep === "questions"',
  'activeStep === "arrangement"',
  'activeStep === "rules"',
  'activeStep === "preview"',
  "v8-step-nav",
  "v8-save-actions",
  "v8-builder-footer",
]) assert.ok(builder.includes(marker), `Builder UI contract missing: ${marker}`);

for (const source of [shell, responsive, list, dashboard, studio]) {
  for (const forbidden of ["max-w-[1600px]", "min-w-[1380px]", "Vercel preview release", "Papers Phase 3"]) {
    assert.ok(!source.includes(forbidden), `Old or oversized UI marker still present: ${forbidden}`);
  }
}

console.log("V8 responsive UI smoke passed.");
console.log("V7 visual continuity, mobile drawer navigation, tablet rails, touch targets, card-based management, scroll-safe modals and deployment lock are present.");
