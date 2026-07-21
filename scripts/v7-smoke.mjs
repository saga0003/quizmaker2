import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];
const passes = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) return "";
  return fs.readFileSync(absolutePath, "utf8");
}

function expect(label, condition, message) {
  if (condition) passes.push(label);
  else failures.push(`${label}: ${message}`);
}

const packageJson = JSON.parse(read("package.json") || "{}");
expect("package version", packageJson.version === "7.0.0", `expected 7.0.0, received ${packageJson.version ?? "missing"}`);
expect("Supabase dependency", Boolean(packageJson.dependencies?.["@supabase/supabase-js"]), "@supabase/supabase-js is missing");
expect("Prisma dependency removed", !packageJson.dependencies?.prisma && !packageJson.dependencies?.["@prisma/client"], "Prisma packages must not be present");
expect("Cloudflare adapter restored", Boolean(packageJson.devDependencies?.["@opennextjs/cloudflare"]), "Cloudflare OpenNext adapter is missing");
expect("V7 interface", exists("src/components/evidara/landing-page.tsx") && exists("src/components/evidara/admin-views.tsx"), "V7 interface files are missing");
expect("Supabase auth bridge", exists("src/components/evidara/v7-auth-bridge.tsx") && read("src/components/evidara/v7-auth-bridge.tsx").includes("useAuth"), "V7 Supabase auth bridge is missing");
expect("V7 login uses Supabase", read("src/components/evidara/login-page.tsx").includes("signInWithPassword") && read("src/components/evidara/login-page.tsx").includes("signInWithOAuth"), "V7 login is not connected to Supabase");
expect("V7 release health", read("src/app/api/health/route.ts").includes('release: "7.0.0"'), "health endpoint is not reporting V7");
expect("Prisma schema removed", !exists("prisma/schema.prisma"), "temporary Prisma schema still exists");
expect("SQLite database removed", !exists("db/custom.db"), "temporary SQLite database still exists");
expect("Template database client removed", !exists("src/lib/db.ts"), "temporary Prisma client still exists");
expect("Cloudflare configuration", read("wrangler.jsonc").includes('"main": ".open-next/worker.js"'), "Cloudflare worker configuration is missing");

if (failures.length) {
  console.error(`Evidara V7 smoke checks failed: ${failures.length}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Evidara V7 smoke checks passed (${passes.length} checks).`);
for (const item of passes) console.log(`✓ ${item}`);
