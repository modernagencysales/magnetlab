import { task } from "@trigger.dev/sdk/v3";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import { generateFullContent } from "@/lib/ai/generate-lead-magnet-content";
import { polishLeadMagnetContent } from "@/lib/ai/lead-magnet-generator";
import { getRelevantContext } from "@/lib/services/knowledge-brain";
import { logApiError } from "@/lib/api/errors";
import type { ExtractedContent, LeadMagnetConcept } from "@/lib/types/lead-magnet";

export interface PolishLeadMagnetContentPayload {
  jobId: string;
  userId: string;
  leadMagnetId: string;
  mode: "generate-and-polish" | "polish-only";
}

export const polishLeadMagnetContentTask = task({
  id: "polish-lead-magnet-content",
  maxDuration: 600,
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: PolishLeadMagnetContentPayload) => {
    const { jobId, userId, leadMagnetId, mode } = payload;
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
      // Fetch lead magnet
      const { data: leadMagnet, error: fetchError } = await supabase
        .from("lead_magnets")
        .select("id, title, concept, extracted_content, user_id")
        .eq("id", leadMagnetId)
        .single();

      if (fetchError || !leadMagnet) {
        throw new Error("Lead magnet not found");
      }

      if (!leadMagnet.concept) {
        throw new Error("Lead magnet has no concept");
      }

      const concept = leadMagnet.concept as LeadMagnetConcept;
      let extractedContent: ExtractedContent;
      let savedExtracted = false;

      if (mode === "generate-and-polish") {
        // Fetch knowledge context (best-effort)
        let knowledgeContext = "";
        try {
          const searchQuery = `${leadMagnet.title} ${concept.painSolved || ""} ${concept.contents || ""}`;
          const knowledge = await getRelevantContext(userId, searchQuery, 15);
          if (knowledge.entries.length > 0) {
            knowledgeContext = knowledge.entries
              .map((e) => `[${e.category}] ${e.content}`)
              .join("\n\n");
          }
        } catch {
          // Continue without knowledge context
        }

        // Generate full content
        extractedContent = await generateFullContent(leadMagnet.title, concept, knowledgeContext);

        // Save extracted_content immediately
        const { error: saveError } = await supabase
          .from("lead_magnets")
          .update({ extracted_content: extractedContent })
          .eq("id", leadMagnetId);

        if (saveError) {
          logApiError("polish-lead-magnet-content/save-extracted", saveError, { userId, leadMagnetId });
          throw new Error("Failed to save generated content");
        }
        savedExtracted = true;
      } else {
        // polish-only: read existing extracted_content
        if (!leadMagnet.extracted_content) {
          throw new Error("Lead magnet has no extracted content to polish");
        }
        extractedContent = leadMagnet.extracted_content as ExtractedContent;
      }

      // Polish into rich block format
      const polishedContent = await polishLeadMagnetContent(extractedContent, concept);
      const polishedAt = new Date().toISOString();

      // Save polished content
      const { error: polishError } = await supabase
        .from("lead_magnets")
        .update({
          polished_content: polishedContent,
          polished_at: polishedAt,
        })
        .eq("id", leadMagnetId);

      if (polishError) {
        logApiError("polish-lead-magnet-content/save-polished", polishError, { userId, leadMagnetId });
        // If we already saved extracted content, that's a partial success
      }

      // Build result
      const result = {
        ...(savedExtracted ? { extractedContent } : {}),
        polishedContent,
        polishedAt,
      };

      // Mark job as completed
      await supabase
        .from("background_jobs")
        .update({
          status: "completed",
          result,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return { success: true, jobId, mode };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logApiError("polish-lead-magnet-content", error, { userId, jobId, leadMagnetId, mode });

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
