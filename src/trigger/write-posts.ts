import { task } from "@trigger.dev/sdk/v3";
import { createSupabaseAdminClient } from "@/lib/utils/supabase-server";
import { generatePostVariations } from "@/lib/ai/lead-magnet-generator";
import { logApiError } from "@/lib/api/errors";
import type { PostWriterInput } from "@/lib/types/lead-magnet";

export interface WritePostsPayload {
  jobId: string;
  userId: string;
  input: PostWriterInput;
}

export const writePosts = task({
  id: "write-posts",
  maxDuration: 300, // 5 minutes
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: WritePostsPayload) => {
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
      const result = await generatePostVariations(input, userId);

      // Mark job as completed
      await supabase
        .from("background_jobs")
        .update({
          status: "completed",
          result,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      return { success: true, jobId, variationCount: result.variations.length };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      logApiError("write-posts", error, { userId, jobId });

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
