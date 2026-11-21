import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No incrementalCache override: there's no ISR here, every route is dynamic.
const config = defineCloudflareConfig();

// `npm run build` is the OpenNext build, so Workers Builds' default command
// produces `.open-next/`. Without this, OpenNext's inner build would call
// `npm run build` and recurse forever.
config.buildCommand = "npm run next:build";

export default config;
