import { schedules, logger, tasks } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { createAttioClient } from '@/lib/integrations/attio';
import type { importAttioRecording } from './import-attio-recording';

/**
 * Safety net: Poll Attio every 30 minutes for completed recordings
 * that may have been missed by the webhook (e.g. if webhook degrades).
 * Scans the last 7 days of meetings, imports any missing recordings.
 */
export const syncAttioRecordings = schedules.task({
  id: 'sync-attio-recordings',
  cron: '*/30 * * * *', // Every 30 minutes
  maxDuration: 300, // 5 minutes
  run: async () => {
    const userId = process.env.ATTIO_DEFAULT_USER_ID;
    if (!userId) {
      logger.error('ATTIO_DEFAULT_USER_ID not configured');
      return { error: 'no_user_id' };
    }

    const supabase = createSupabaseAdminClient();
    const attio = createAttioClient();

    // --- Step 1: Get all Attio external_ids we already have ---
    const { data: existingRows, error: dbError } = await supabase
      .from('cp_call_transcripts')
      .select('external_id')
      .eq('source', 'attio')
      .eq('user_id', userId);

    if (dbError) {
      logger.error('Failed to query existing transcripts', { error: dbError.message });
      return { error: dbError.message };
    }

    const existingIds = new Set(
      (existingRows || []).map((r) => r.external_id).filter(Boolean)
    );

    logger.info('Existing Attio transcripts in DB', { count: existingIds.size });

    // --- Step 2: Scan Attio meetings from last 7 days ---
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    let cursor: string | undefined;
    let meetingsScanned = 0;
    let recordingsFound = 0;
    let newImports = 0;
    let skippedDuplicates = 0;
    let skippedProcessing = 0;

    do {
      const meetingsRes = await attio.listMeetings(cursor);

      if (meetingsRes.error || !meetingsRes.data) {
        logger.error('Failed to list meetings', { error: meetingsRes.error });
        break;
      }

      const meetings = meetingsRes.data.data || [];
      cursor = meetingsRes.data.pagination?.next_cursor || undefined;

      // Check if we've gone past our 7-day window
      let pastWindow = false;

      for (const meeting of meetings) {
        meetingsScanned++;
        const meetingDate = meeting.start?.datetime
          ? new Date(meeting.start.datetime)
          : null;

        // listMeetings sorts by start_desc — if meeting is older than 7 days, stop
        if (meetingDate && meetingDate < sevenDaysAgo) {
          pastWindow = true;
          break;
        }

        // Check for completed recordings on this meeting
        const meetingId = meeting.id.meeting_id;
        const recordingsRes = await attio.listCallRecordings(meetingId);

        if (recordingsRes.error || !recordingsRes.data) continue;

        for (const recording of recordingsRes.data.data || []) {
          recordingsFound++;
          const callRecordingId = recording.id.call_recording_id;
          const externalId = `attio:${callRecordingId}`;

          if (recording.status !== 'completed') {
            skippedProcessing++;
            continue;
          }

          if (existingIds.has(externalId)) {
            skippedDuplicates++;
            continue;
          }

          // New completed recording — trigger import
          logger.info('Found missing recording, triggering import', {
            meetingId,
            callRecordingId,
          });

          await tasks.trigger<typeof importAttioRecording>('import-attio-recording', {
            meetingId,
            callRecordingId,
            userId,
          });

          existingIds.add(externalId); // Prevent double-triggering in same run
          newImports++;
        }
      }

      if (pastWindow) break;
    } while (cursor);

    // --- Step 3: Check webhook health ---
    let webhookStatus = 'unknown';
    const webhookId = process.env.ATTIO_WEBHOOK_ID;

    if (webhookId) {
      const whRes = await attio.getWebhookStatus(webhookId);
      if (whRes.data) {
        webhookStatus = whRes.data.data?.status || 'unknown';
        if (webhookStatus !== 'active') {
          logger.warn('Attio webhook is NOT active — recordings will be caught by this polling job', {
            webhookId,
            status: webhookStatus,
          });
        }
      } else {
        logger.warn('Failed to check webhook status', { webhookId, error: whRes.error });
      }
    }

    const summary = {
      meetingsScanned,
      recordingsFound,
      newImports,
      skippedDuplicates,
      skippedProcessing,
      webhookStatus,
    };

    logger.info('Attio sync complete', summary);
    return summary;
  },
});
