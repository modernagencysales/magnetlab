import { task } from "@trigger.dev/sdk/v3";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import { generateLeadMagnetIdeasParallel } from "@/lib/ai/lead-magnet-generator";
import { logApiError } from "@/lib/api/errors";
import type { BusinessContext } from "@/lib/types/lead-magnet";
import type { IdeationJobInput } from "@/lib/types/background-jobs";

export interface IdeateLeadMagnetPayload {
  jobId: string;
  userId: string;
  input: IdeationJobInput;
}

export const ideateLeadMagnet = task({
  id: "ideate-lead-magnet",
  maxDuration: 600, // 10 minutes — ideation makes 5 parallel + 1 sequential AI calls
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: IdeateLeadMagnetPayload) => {
    const { jobId, userId, input } = payload;
    const supabase = createSupabaseAdminClient();

    // Mark job as processing
    await supabase
      .from("background_jobs")
      .update({
        status: "processing",
        started_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    try {
      // Build full business context
      const businessContext: BusinessContext = {
        businessDescription: input.businessContext.businessDescription,
        businessType: input.businessContext.businessType as BusinessContext["businessType"],
        credibilityMarkers: input.businessContext.credibilityMarkers || [],
        urgentPains: input.businessContext.urgentPains || [],
        templates: input.businessContext.templates || [],
        processes: input.businessContext.processes || [],
        tools: input.businessContext.tools || [],
        frequentQuestions: input.businessContext.frequentQuestions || [],
        results: input.businessContext.results || [],
        successExample: input.businessContext.successExample,
      };

      // Generate ideas using parallel batching for ~60x faster performance
      // See MOD-71: splits 10 concepts into 3 parallel batches
      // Pass userId so AI Brain knowledge from transcripts is injected into ideation
      const result = await generateLeadMagnetIdeasParallel(businessContext, input.sources, userId);

      // Save result to brand_kit for future use
      try {
        await supabase
          .from("brand_kits")
          .update({
            saved_ideation_result: result,
            ideation_generated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      } catch (saveError) {
        logApiError("ideate-lead-magnet/save-brand-kit", saveError, { userId, jobId });
        // Non-critical, continue
      }

      // Mark job as completed
      await supabase
        .from("background_jobs")
        .update({
          status: "completed",
          result,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return { success: true, jobId, conceptCount: result.concepts.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logApiError("ideate-lead-magnet", error, { userId, jobId });

      // Mark job as failed
      await supabase
        .from("background_jobs")
        .update({
          status: "failed",
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      throw error;
    }
  },
});
