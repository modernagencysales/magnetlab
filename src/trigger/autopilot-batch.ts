import { schedules, logger, tasks } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { runNightlyBatch } from '@/lib/services/autopilot';
import type { processTranscript } from './process-transcript';

export const nightlyAutopilotBatch = schedules.task({
  id: 'nightly-autopilot-batch',
  cron: '0 2 * * *', // 2 AM UTC daily
  maxDuration: 600,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    logger.info('Starting nightly autopilot batch');

    // Find all users with active posting slots
    const { data: activeSlots } = await supabase
      .from('cp_posting_slots')
      .select('user_id')
      .eq('is_active', true);

    const userIds = [...new Set(activeSlots?.map((s) => s.user_id) || [])];

    if (userIds.length === 0) {
      logger.info('No users with active posting slots');
      return { usersProcessed: 0 };
    }

    logger.info('Processing users', { count: userIds.length });

    const results = [];

    for (const userId of userIds) {
      try {
        logger.info('Processing user', { userId });

        // Step 1: Process unprocessed transcripts
        const { data: newTranscripts } = await supabase
          .from('cp_call_transcripts')
          .select('*')
          .eq('user_id', userId)
          .is('ideas_extracted_at', null)
          .order('created_at', { ascending: true })
          .limit(5);

        if (newTranscripts?.length) {
          logger.info('Processing new transcripts', { count: newTranscripts.length, userId });

          for (const transcript of newTranscripts) {
            try {
              const result = await tasks.triggerAndWait<typeof processTranscript>(
                'process-transcript',
                { userId, transcriptId: transcript.id }
              );

              if (result.ok) {
                logger.info('Processed transcript', {
                  transcriptId: transcript.id,
                  ideas: result.output?.contentIdeas ?? 0,
                });
              } else {
                logger.error('process-transcript task failed', {
                  transcriptId: transcript.id,
                });
              }
            } catch (transcriptError) {
              logger.error('Failed to process transcript', {
                transcriptId: transcript.id,
                error: transcriptError instanceof Error ? transcriptError.message : String(transcriptError),
              });
            }
          }
        }

        // Step 2: Run autopilot batch
        const batchResult = await runNightlyBatch({
          userId,
          postsPerBatch: 3,
          bufferTarget: 5,
          autoPublish: false,
          autoPublishDelayHours: 24,
        });

        results.push({
          userId,
          transcriptsProcessed: newTranscripts?.length || 0,
          ...batchResult,
        });

        logger.info('User batch complete', {
          userId,
          postsCreated: batchResult.postsCreated,
          postsScheduled: batchResult.postsScheduled,
        });
      } catch (userError) {
        logger.error('Failed to process user', {
          userId,
          error: userError instanceof Error ? userError.message : String(userError),
        });
        results.push({ userId, error: String(userError) });
      }
    }

    logger.info('Nightly batch complete', {
      usersProcessed: userIds.length,
      totalPostsCreated: results.reduce((sum, r) => sum + ((r as { postsCreated?: number }).postsCreated || 0), 0),
    });

    return { usersProcessed: userIds.length, results };
  },
});
