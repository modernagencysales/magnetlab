import { schedules, logger, tasks } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { runNightlyBatch } from '@/lib/services/autopilot';
import type { processTranscript } from './process-transcript';

interface ProfileTarget {
  userId: string;
  teamId: string | null;
  profileId: string | null;
  profileName: string | null;
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

    // Build profile targets: for users with teams, run once per active profile;
    // for users without teams, run once with no profile context
    const profileTargets: ProfileTarget[] = [];

    for (const userId of userIds) {
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', userId)
        .single();

      if (team) {
        const { data: profiles } = await supabase
          .from('team_profiles')
          .select('id, full_name')
          .eq('team_id', team.id)
          .eq('status', 'active');

        if (profiles?.length) {
          for (const profile of profiles) {
            profileTargets.push({ userId, teamId: team.id, profileId: profile.id, profileName: profile.full_name });
          }
        } else {
          // Team exists but no active profiles — run without profile context
          profileTargets.push({ userId, teamId: team.id, profileId: null, profileName: null });
        }
      } else {
        profileTargets.push({ userId, teamId: null, profileId: null, profileName: null });
      }
    }

    logger.info('Processing profile targets', { count: profileTargets.length, users: userIds.length });

    const results = [];

    for (const target of profileTargets) {
      const { userId, teamId, profileId, profileName } = target;
      try {
        logger.info('Processing target', { userId, profileId, profileName });

        // Step 1: Process unprocessed transcripts (scoped to profile if available)
        let transcriptsQuery = supabase
          .from('cp_call_transcripts')
          .select('id, user_id, source, external_id, title, call_date, duration_minutes, participants, raw_transcript, summary, extracted_topics, transcript_type, ideas_extracted_at, knowledge_extracted_at, speaker_profile_id, created_at')
          .eq('user_id', userId)
          .is('ideas_extracted_at', null)
          .order('created_at', { ascending: true })
          .limit(5);

        // For profile-specific runs, process transcripts assigned to this profile
        // or unassigned transcripts (which belong to the default/owner profile)
        if (profileId) {
          transcriptsQuery = transcriptsQuery.or(`speaker_profile_id.eq.${profileId},speaker_profile_id.is.null`);
        }

        const { data: newTranscripts } = await transcriptsQuery;

        if (newTranscripts?.length) {
          logger.info('Processing new transcripts', { count: newTranscripts.length, userId, profileId });

          for (const transcript of newTranscripts) {
            try {
              const result = await tasks.triggerAndWait<typeof processTranscript>(
                'process-transcript',
                {
                  userId,
                  transcriptId: transcript.id,
                  teamId: teamId || undefined,
                  speakerProfileId: transcript.speaker_profile_id || profileId || undefined,
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

        // Step 2: Run autopilot batch (with team/profile context)
        const batchResult = await runNightlyBatch({
          userId,
          postsPerBatch: 3,
          bufferTarget: 5,
          autoPublish: false,
          autoPublishDelayHours: 24,
          teamId: teamId || undefined,
          profileId: profileId || undefined,
        });

        results.push({
          userId,
          profileId,
          profileName,
          transcriptsProcessed: newTranscripts?.length || 0,
          ...batchResult,
        });

        logger.info('Target batch complete', {
          userId,
          profileId,
          profileName,
          postsCreated: batchResult.postsCreated,
          postsScheduled: batchResult.postsScheduled,
        });
      } catch (userError) {
        logger.error('Failed to process target', {
          userId,
          profileId,
          error: userError instanceof Error ? userError.message : String(userError),
        });
        results.push({ userId, profileId, error: String(userError) });
      }
    }

    logger.info('Nightly batch complete', {
      usersProcessed: userIds.length,
      profileTargetsProcessed: profileTargets.length,
      totalPostsCreated: results.reduce((sum, r) => sum + ((r as { postsCreated?: number }).postsCreated || 0), 0),
    });

    return { usersProcessed: userIds.length, profileTargets: profileTargets.length, results };
  },
});
