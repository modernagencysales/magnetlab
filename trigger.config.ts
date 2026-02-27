import { defineConfig } from "@trigger.dev/sdk/v3";
import { puppeteer } from "@trigger.dev/build/extensions/puppeteer";

export default defineConfig({
  project: "proj_jdjofdqazqwitpinxady",
  runtime: "node",
  logLevel: "log",
  maxDuration: 600, // 10 minutes max per task (MOD-76: doubled for heavy AI calls)
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/trigger"],
  build: {
    extensions: [puppeteer()],
  },
});
