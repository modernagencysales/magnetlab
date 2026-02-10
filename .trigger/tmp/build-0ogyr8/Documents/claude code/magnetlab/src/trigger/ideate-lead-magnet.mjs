import {
  generateLeadMagnetIdeasParallel,
  logApiError
} from "../../../../../chunk-WZ67LIHF.mjs";
import "../../../../../chunk-RWH646ED.mjs";
import "../../../../../chunk-DKPAWPJO.mjs";
import "../../../../../chunk-HJL3WNPY.mjs";
import "../../../../../chunk-POHWGI23.mjs";
import {
  createSupabaseAdminClient
} from "../../../../../chunk-MDZYQ24F.mjs";
import {
  task
} from "../../../../../chunk-RPAAZZEF.mjs";
import "../../../../../chunk-NAHNRDWS.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-R7N3VW3I.mjs";

// src/trigger/ideate-lead-magnet.ts
init_esm();
var ideateLeadMagnet = task({
  id: "ideate-lead-magnet",
  maxDuration: 600,
  // 10 minutes — ideation makes 5 parallel + 1 sequential AI calls
  retry: {
    maxAttempts: 1
  },
  run: /* @__PURE__ */ __name(async (payload) => {
    const { jobId, userId, input } = payload;
    const supabase = createSupabaseAdminClient();
    await supabase.from("background_jobs").update({
      status: "processing",
      started_at: (/* @__PURE__ */ new Date()).toISOString()
    }).eq("id", jobId);
    try {
      const businessContext = {
        businessDescription: input.businessContext.businessDescription,
        businessType: input.businessContext.businessType,
        credibilityMarkers: input.businessContext.credibilityMarkers || [],
        urgentPains: input.businessContext.urgentPains || [],
        templates: input.businessContext.templates || [],
        processes: input.businessContext.processes || [],
        tools: input.businessContext.tools || [],
        frequentQuestions: input.businessContext.frequentQuestions || [],
        results: input.businessContext.results || [],
        successExample: input.businessContext.successExample
      };
      const result = await generateLeadMagnetIdeasParallel(businessContext, input.sources, userId);
      try {
        await supabase.from("brand_kits").update({
          saved_ideation_result: result,
          ideation_generated_at: (/* @__PURE__ */ new Date()).toISOString()
        }).eq("user_id", userId);
      } catch (saveError) {
        logApiError("ideate-lead-magnet/save-brand-kit", saveError, { userId, jobId });
      }
      await supabase.from("background_jobs").update({
        status: "completed",
        result,
        completed_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", jobId);
      return { success: true, jobId, conceptCount: result.concepts.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logApiError("ideate-lead-magnet", error, { userId, jobId });
      await supabase.from("background_jobs").update({
        status: "failed",
        error: errorMessage,
        completed_at: (/* @__PURE__ */ new Date()).toISOString()
      }).eq("id", jobId);
      throw error;
    }
  }, "run")
});
export {
  ideateLeadMagnet
};
//# sourceMappingURL=ideate-lead-magnet.mjs.map
