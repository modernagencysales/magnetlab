import {
  runNightlyBatch
} from "../../../../../chunk-LWFTZJXI.mjs";
import "../../../../../chunk-RWH646ED.mjs";
import "../../../../../chunk-DKPAWPJO.mjs";
import "../../../../../chunk-HJL3WNPY.mjs";
import "../../../../../chunk-POHWGI23.mjs";
import {
  createSupabaseAdminClient
} from "../../../../../chunk-MDZYQ24F.mjs";
import {
  logger,
  schedules_exports,
  tasks
} from "../../../../../chunk-RPAAZZEF.mjs";
import "../../../../../chunk-NAHNRDWS.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-R7N3VW3I.mjs";

// src/trigger/autopilot-batch.ts
init_esm();
var nightlyAutopilotBatch = schedules_exports.task({
  id: "nightly-autopilot-batch",
  cron: "0 2 * * *",
  // 2 AM UTC daily
  maxDuration: 600,
  run: /* @__PURE__ */ __name(async () => {
    const supabase = createSupabaseAdminClient();
    logger.info("Starting nightly autopilot batch");
    const { data: activeSlots } = await supabase.from("cp_posting_slots").select("user_id").eq("is_active", true);
    const userIds = [...new Set(activeSlots?.map((s) => s.user_id) || [])];
    if (userIds.length === 0) {
      logger.info("No users with active posting slots");
      return { usersProcessed: 0 };
    }
    logger.info("Processing users", { count: userIds.length });
    const results = [];
    for (const userId of userIds) {
      try {
        logger.info("Processing user", { userId });
        const { data: newTranscripts } = await supabase.from("cp_call_transcripts").select("id, user_id, source, external_id, title, call_date, duration_minutes, participants, raw_transcript, summary, extracted_topics, transcript_type, ideas_extracted_at, knowledge_extracted_at, created_at").eq("user_id", userId).is("ideas_extracted_at", null).order("created_at", { ascending: true }).limit(5);
        if (newTranscripts?.length) {
          logger.info("Processing new transcripts", { count: newTranscripts.length, userId });
          for (const transcript of newTranscripts) {
            try {
              const result = await tasks.triggerAndWait(
                "process-transcript",
                { userId, transcriptId: transcript.id }
              );
              if (result.ok) {
                logger.info("Processed transcript", {
                  transcriptId: transcript.id,
                  ideas: result.output?.contentIdeas ?? 0
                });
              } else {
                logger.error("process-transcript task failed", {
                  transcriptId: transcript.id
                });
              }
            } catch (transcriptError) {
              logger.error("Failed to process transcript", {
                transcriptId: transcript.id,
                error: transcriptError instanceof Error ? transcriptError.message : String(transcriptError)
              });
            }
          }
        }
        const batchResult = await runNightlyBatch({
          userId,
          postsPerBatch: 3,
          bufferTarget: 5,
          autoPublish: false,
          autoPublishDelayHours: 24
        });
        results.push({
          userId,
          transcriptsProcessed: newTranscripts?.length || 0,
          ...batchResult
        });
        logger.info("User batch complete", {
          userId,
          postsCreated: batchResult.postsCreated,
          postsScheduled: batchResult.postsScheduled
        });
      } catch (userError) {
        logger.error("Failed to process user", {
          userId,
          error: userError instanceof Error ? userError.message : String(userError)
        });
        results.push({ userId, error: String(userError) });
      }
    }
    logger.info("Nightly batch complete", {
      usersProcessed: userIds.length,
      totalPostsCreated: results.reduce((sum, r) => sum + (r.postsCreated || 0), 0)
    });
    return { usersProcessed: userIds.length, results };
  }, "run")
});
export {
  nightlyAutopilotBatch
};
//# sourceMappingURL=autopilot-batch.mjs.map
