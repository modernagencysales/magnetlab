import { schedules, tasks, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUserFathomClient } from '@/lib/integrations/fathom';

export const syncFathomTranscripts = schedules.task({
  id: 'sync-fathom-transcripts',
  cron: '*/30 * * * *', // Every 30 minutes
  maxDuration: 300,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    logger.info('Starting Fathom transcript sync');

    // Find all active Fathom integrations
    const { data: integrations, error: queryError } = await supabase
      .from('user_integrations')
      .select('user_id, metadata')
      .eq('service', 'fathom')
      .eq('is_active', true);

    if (queryError) {
      logger.error('Failed to query Fathom integrations', { error: queryError.message });
      return { synced: 0, users: 0, errors: [queryError.message] };
    }

    if (!integrations || integrations.length === 0) {
      logger.info('No active Fathom integrations found');
      return { synced: 0, users: 0, errors: [] };
    }

    logger.info(`Found ${integrations.length} active Fathom integration(s)`);

    let totalSynced = 0;
    const errors: string[] = [];

    for (const integration of integrations) {
      const userId = integration.user_id;
      const metadata = integration.metadata as {
        refresh_token?: string;
        token_expires_at?: string;
        last_synced_at?: string;
      };

      try {
        const client = await getUserFathomClient(userId);
        if (!client) {
          logger.warn(`Could not get Fathom client for user ${userId} (token may be revoked)`);
          continue;
        }

        // Determine sync start time
        const syncSince = metadata.last_synced_at
          ? metadata.last_synced_at
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days ago for first sync

        logger.info(`Syncing meetings for user ${userId} since ${syncSince}`);

        let cursor: string | undefined;
        let userSynced = 0;

        // Paginate through all meetings
        do {
          const response = await client.listMeetings({
            created_after: syncSince,
            cursor,
          });

          if (response.error || !response.data) {
            logger.error(`Failed to list meetings for user ${userId}`, { error: response.error });
            errors.push(`User ${userId}: ${response.error}`);
            break;
          }

          const { meetings, has_more, next_cursor } = response.data;

          for (const meeting of meetings) {
            const externalId = `fathom:${meeting.id}`;

            // Dedup check
            const { data: existing } = await supabase
              .from('cp_call_transcripts')
              .select('id')
              .eq('user_id', userId)
              .eq('external_id', externalId)
              .single();

            if (existing) {
              logger.info(`Skipping duplicate: ${externalId}`);
              continue;
            }

            // Fetch transcript
            const transcriptResponse = await client.getTranscript(meeting.id);
            if (transcriptResponse.error || !transcriptResponse.data) {
              logger.warn(`Failed to fetch transcript for meeting ${meeting.id}`, {
                error: transcriptResponse.error,
              });
              continue;
            }

            const transcriptText = transcriptResponse.data.transcript;

            // Skip very short transcripts
            if (!transcriptText || transcriptText.length < 100) {
              logger.info(`Skipping short transcript for meeting ${meeting.id} (${transcriptText?.length ?? 0} chars)`);
              continue;
            }

            // Insert into cp_call_transcripts
            const { data: inserted, error: insertError } = await supabase
              .from('cp_call_transcripts')
              .insert({
                user_id: userId,
                source: 'fathom',
                external_id: externalId,
                title: meeting.title || 'Fathom Meeting',
                call_date: meeting.created_at,
                duration_minutes: meeting.duration_seconds
                  ? Math.round(meeting.duration_seconds / 60)
                  : null,
                participants: meeting.attendees || [],
                raw_transcript: transcriptText,
              })
              .select('id')
              .single();

            if (insertError) {
              logger.error(`Failed to insert transcript for meeting ${meeting.id}`, {
                error: insertError.message,
              });
              errors.push(`Insert failed for ${externalId}: ${insertError.message}`);
              continue;
            }

            // Trigger processing
            await tasks.trigger('process-transcript', {
              userId,
              transcriptId: inserted.id,
            });

            userSynced++;
            logger.info(`Synced meeting ${meeting.id} → transcript ${inserted.id}`);

            // Rate limit: 1.1s between transcript fetches (Fathom limit: 60/min)
            await new Promise((resolve) => setTimeout(resolve, 1100));
          }

          cursor = has_more ? (next_cursor ?? undefined) : undefined;
        } while (cursor);

        // Update last_synced_at (targeted update to avoid nullifying api_key)
        await supabase
          .from('user_integrations')
          .update({
            metadata: {
              ...metadata,
              last_synced_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('service', 'fathom');

        totalSynced += userSynced;
        logger.info(`User ${userId}: synced ${userSynced} new transcript(s)`);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Sync failed for user ${userId}`, { error: message });
        errors.push(`User ${userId}: ${message}`);
      }
    }

    logger.info(`Fathom sync complete: ${totalSynced} transcripts from ${integrations.length} user(s)`);

    return {
      synced: totalSynced,
      users: integrations.length,
      errors,
    };
  },
});
