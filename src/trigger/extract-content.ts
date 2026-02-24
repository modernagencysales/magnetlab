import { task } from "@trigger.dev/sdk/v3";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import { processContentExtraction } from "@/lib/ai/lead-magnet-generator";
import { logApiError } from "@/lib/api/errors";
import type { LeadMagnetArchetype, LeadMagnetConcept, BusinessContext, CallTranscriptInsights, InteractiveConfig } from "@/lib/types/lead-magnet";

export interface ExtractContentPayload {
  jobId: string;
  userId: string;
  leadMagnetId?: string | null;
  input: {
    archetype: string;
    concept: unknown;
    answers: Record<string, string>;
    transcriptInsights?: CallTranscriptInsights;
    // Interactive generation fields
    action?: 'generate-interactive';
    businessContext?: BusinessContext;
  };
}

export const extractContent = task({
  id: "extract-content",
  maxDuration: 300, // 5 minutes
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: ExtractContentPayload) => {
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
      let result: unknown;

      if (input.action === 'generate-interactive') {
        // Interactive path: generate calculator/assessment/GPT config
        const { isInteractiveArchetype, getInteractiveType } = await import("@/lib/types/lead-magnet");
        const archetype = input.archetype as LeadMagnetArchetype;

        if (!isInteractiveArchetype(archetype)) {
          throw new Error('Archetype is not interactive');
        }

        const interactiveType = getInteractiveType(archetype);
        const { generateCalculatorConfig, generateAssessmentConfig, generateGPTConfig } = await import("@/lib/ai/interactive-generators");

        const concept = input.concept as LeadMagnetConcept;
        let config: InteractiveConfig;

        switch (interactiveType) {
          case 'calculator':
            config = await generateCalculatorConfig(concept, input.answers, input.transcriptInsights);
            break;
          case 'assessment':
            config = await generateAssessmentConfig(concept, input.answers, input.transcriptInsights);
            break;
          case 'gpt':
            config = await generateGPTConfig(concept, input.answers, input.businessContext as unknown as Record<string, unknown>, input.transcriptInsights);
            break;
          default:
            throw new Error('Unknown interactive type');
        }

        result = { interactiveConfig: config };
      } else {
        // Standard text extraction path
        const extractedContent = await processContentExtraction(
          input.archetype as LeadMagnetArchetype,
          input.concept as LeadMagnetConcept,
          input.answers,
          input.transcriptInsights,
          userId
        );
        result = { extractedContent };
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

      // Persist content to lead_magnets table if leadMagnetId provided
      if (payload.leadMagnetId) {
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (input.action === 'generate-interactive') {
          updateData.interactive_config = (result as { interactiveConfig: unknown }).interactiveConfig;
        } else {
          updateData.extracted_content = (result as { extractedContent: unknown }).extractedContent;
        }

        const { error: updateError } = await supabase
          .from("lead_magnets")
          .update(updateData)
          .eq("id", payload.leadMagnetId)
          .eq("user_id", userId);

        if (updateError) {
          logApiError("extract-content/persist-lead-magnet", updateError, {
            userId, leadMagnetId: payload.leadMagnetId,
          });
        }
      }

      return { success: true, jobId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logApiError("extract-content", error, { userId, jobId });

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
