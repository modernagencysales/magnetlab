import {
  runNightlyBatch
} from "../../../../../chunk-LWFTZJXI.mjs";
import "../../../../../chunk-RWH646ED.mjs";
import "../../../../../chunk-DKPAWPJO.mjs";
import "../../../../../chunk-HJL3WNPY.mjs";
import "../../../../../chunk-POHWGI23.mjs";
import "../../../../../chunk-MDZYQ24F.mjs";
import {
  logger,
  task
} from "../../../../../chunk-RPAAZZEF.mjs";
import "../../../../../chunk-NAHNRDWS.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-R7N3VW3I.mjs";

// src/trigger/run-autopilot.ts
init_esm();
var runAutopilot = task({
  id: "run-autopilot",
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  run: /* @__PURE__ */ __name(async (payload) => {
    const { userId, postsPerBatch = 3, bufferTarget = 5, autoPublish = false } = payload;
    logger.info("Running autopilot", { userId, postsPerBatch, bufferTarget });
    const result = await runNightlyBatch({
      userId,
      postsPerBatch,
      bufferTarget,
      autoPublish,
      autoPublishDelayHours: 24
    });
    logger.info("Autopilot complete", {
      postsCreated: result.postsCreated,
      postsScheduled: result.postsScheduled,
      ideasProcessed: result.ideasProcessed,
      errors: result.errors.length
    });
    return result;
  }, "run")
});
export {
  runAutopilot
};
//# sourceMappingURL=run-autopilot.mjs.map
