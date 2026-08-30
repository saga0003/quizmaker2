import fs from "node:fs";
import path from "node:path";

const file = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(file)) {
  console.error(".env.local is missing.");
  process.exit(1);
}
const values = {};
for (const raw of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const at = line.indexOf("=");
  values[line.slice(0, at).trim()] = line.slice(at + 1).trim().replace(/^['\"]|['\"]$/g, "");
}
const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_ENDPOINT", "R2_PUBLIC_BASE_URL"];
const errors = [];
for (const key of required) {
  const value = values[key] || "";
  if (!value || value === "[SENSITIVE]" || value.includes("PASTE_") || value.includes("YOUR_")) errors.push(`${key} is missing or still a placeholder.`);
}
if (values.R2_BUCKET && values.R2_BUCKET !== "evidara-question-assets") errors.push("R2_BUCKET should be evidara-question-assets.");
for (const key of ["R2_ENDPOINT", "R2_PUBLIC_BASE_URL"]) {
  try { const url = new URL(values[key]); if (url.protocol !== "https:") throw new Error(); }
  catch { errors.push(`${key} must be a valid HTTPS URL.`); }
}
if (values.R2_ACCOUNT_ID && values.R2_ENDPOINT && !values.R2_ENDPOINT.includes(values.R2_ACCOUNT_ID)) errors.push("R2_ENDPOINT does not contain the configured R2_ACCOUNT_ID.");
if (errors.length) {
  console.error("\nR2 local configuration is incomplete:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Cloudflare R2 local environment values are structurally valid.");
console.log(`Bucket: ${values.R2_BUCKET}`);
console.log(`Public base: ${values.R2_PUBLIC_BASE_URL}`);
