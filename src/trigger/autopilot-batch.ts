/**
 * Nightly Autopilot Batch.
 * Scheduled task that runs at 2 AM UTC daily.
 * For team users: calls runNightlyBatch once per team (generates for all profiles).
 * For personal users: calls runNightlyBatch once per user.
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { schedules, logger, tasks } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { runNightlyBatch } from '@/lib/services/autopilot';
import type { processTranscript } from './process-transcript';

interface BatchTarget {
  userId: string;
  teamId: string | null;
}

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

    // Build batch targets: one per team (team mode) or one per user (personal mode)
    const batchTargets: BatchTarget[] = [];

    for (const userId of userIds) {
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', userId)
        .single();

      batchTargets.push({
        userId,
        teamId: team?.id ?? null,
      });
    }

    logger.info('Processing batch targets', { count: batchTargets.length });

    const results = [];

    for (const target of batchTargets) {
      const { userId, teamId } = target;
      try {
        logger.info('Processing target', { userId, teamId });

        // Step 1: Process unprocessed transcripts
        const { data: newTranscripts } = await supabase
          .from('cp_call_transcripts')
          .select('id, user_id, source, external_id, title, call_date, duration_minutes, participants, raw_transcript, summary, extracted_topics, transcript_type, ideas_extracted_at, knowledge_extracted_at, speaker_profile_id, created_at')
          .eq('user_id', userId)
          .is('ideas_extracted_at', null)
          .order('created_at', { ascending: true })
          .limit(10);

        if (newTranscripts?.length) {
          logger.info('Processing new transcripts', { count: newTranscripts.length, userId });

          for (const transcript of newTranscripts) {
            try {
              const result = await tasks.triggerAndWait<typeof processTranscript>(
                'process-transcript',
                {
                  userId,
                  transcriptId: transcript.id,
                  teamId: teamId || undefined,
                  speakerProfileId: transcript.speaker_profile_id || undefined,
                }
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
        // In team mode (teamId set, no profileId): runNightlyBatch generates for ALL profiles
        // In personal mode: generates for the single user
        const batchResult = await runNightlyBatch({
          userId,
          postsPerBatch: 3,
          bufferTarget: 5,
          autoPublish: false,
          autoPublishDelayHours: 24,
          teamId: teamId || undefined,
          // profileId intentionally omitted for team mode — batch handles all profiles
        });

        results.push({
          userId,
          teamId,
          transcriptsProcessed: newTranscripts?.length || 0,
          ...batchResult,
        });

        logger.info('Target batch complete', {
          userId,
          teamId,
          postsCreated: batchResult.postsCreated,
          postsScheduled: batchResult.postsScheduled,
          profileResults: batchResult.profileResults?.length ?? 0,
        });
      } catch (userError) {
        logger.error('Failed to process target', {
          userId,
          teamId,
          error: userError instanceof Error ? userError.message : String(userError),
        });
        results.push({ userId, teamId, error: String(userError) });
      }
    }

    logger.info('Nightly batch complete', {
      usersProcessed: userIds.length,
      totalPostsCreated: results.reduce((sum, r) => sum + ((r as { postsCreated?: number }).postsCreated || 0), 0),
    });

    return { usersProcessed: userIds.length, results };
  },
});
