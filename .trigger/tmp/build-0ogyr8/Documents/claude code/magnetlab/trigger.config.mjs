import {
  defineConfig
} from "../../../chunk-RPAAZZEF.mjs";
import "../../../chunk-NAHNRDWS.mjs";
import {
  init_esm
} from "../../../chunk-R7N3VW3I.mjs";

// trigger.config.ts
init_esm();
var trigger_config_default = defineConfig({
  project: "proj_lueymlvtfuvbroyvxzjw",
  runtime: "node",
  logLevel: "log",
  // 5 minutes max per task
  maxDuration: 300,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1e3,
      maxTimeoutInMs: 1e4,
      factor: 2,
      randomize: true
    }
  },
  dirs: ["./src/trigger"],
  build: {}
});
var resolveEnvVars = void 0;
export {
  trigger_config_default as default,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map
