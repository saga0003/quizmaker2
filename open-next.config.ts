// The adapter is supplied by the `cf:*` npx commands during Cloudflare builds.
// @ts-expect-error Build-only dependency is intentionally outside the Next.js application lockfile.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig();
