import { task, logger, tasks } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  createAttioClient,
  assembleTranscript,
  calcDurationMinutes,
  extractParticipants,
  extractSpeakerNames,
  buildSpeakerMap,
} from '@/lib/integrations/attio';
import type { processTranscript } from './process-transcript';

interface ImportAttioRecordingPayload {
  meetingId: string;
  callRecordingId: string;
  userId: string;
}

export const importAttioRecording = task({
  id: 'import-attio-recording',
  maxDuration: 120, // 2 minutes — Attio API pagination + Supabase insert
  retry: { maxAttempts: 3 },
  run: async (payload: ImportAttioRecordingPayload) => {
    const { meetingId, callRecordingId, userId } = payload;
    const supabase = createSupabaseAdminClient();
    const externalId = `attio:${callRecordingId}`;

    logger.info('Importing Attio recording', { meetingId, callRecordingId });

    // Dedup check (in case of retries or race conditions)
    const { data: existing } = await supabase
      .from('cp_call_transcripts')
      .select('id')
      .eq('external_id', externalId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      logger.info('Duplicate — already imported', { transcriptId: existing.id });
      return { duplicate: true, transcriptId: existing.id };
    }

    // Fetch meeting details + full paginated transcript from Attio API
    const attio = createAttioClient();

    const [meetingRes, segmentsRes] = await Promise.all([
      attio.getMeeting(meetingId),
      attio.getFullTranscript(meetingId, callRecordingId),
    ]);

    if (!segmentsRes.data || segmentsRes.data.length === 0) {
      logger.warn('Empty transcript', { meetingId, callRecordingId, error: segmentsRes.error });
      return { skipped: true, reason: 'empty_transcript' };
    }

    const meeting = meetingRes.data;
    const rawTranscript = assembleTranscript(segmentsRes.data);

    if (rawTranscript.length === 0) {
      logger.warn('Assembled transcript is empty', { meetingId, callRecordingId });
      return { skipped: true, reason: 'empty_assembled_transcript' };
    }

    // Build record
    const title = meeting?.title || null;
    const callDate = meeting?.start?.datetime || null;
    const durationMinutes = meeting ? calcDurationMinutes(meeting.start, meeting.end) : null;
    const participants = meeting ? extractParticipants(meeting) : [];
    const speakerNames = extractSpeakerNames(segmentsRes.data);
    const speakerMap = meeting ? buildSpeakerMap(meeting.participants, speakerNames) : null;

    // ─── DFY User Routing ──────────────────────────────────────────────
    // Check if this recording matches a DFY client engagement.
    // If so, route the transcript to the client's magnetlab user instead of the default.
    let resolvedUserId = userId;
    try {
      if (participants.length > 0) {
        const { data: match } = await supabase
          .from('dfy_engagements')
          .select('magnetlab_user_id')
          .in('client_email', participants)
          .not('magnetlab_user_id', 'is', null)
          .eq('status', 'active')
          .limit(1)
          .maybeSingle();

        if (match?.magnetlab_user_id) {
          resolvedUserId = match.magnetlab_user_id;
          logger.info('DFY client match — routing transcript to magnetlab user', {
            magnetlabUserId: resolvedUserId,
            originalUserId: userId,
          });
        }
      }
    } catch (err) {
      // Fallback to original user on error — DFY routing is best-effort
      logger.warn('DFY user routing failed, using original userId', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Insert
    const { data: saved, error: insertError } = await supabase
      .from('cp_call_transcripts')
      .insert({
        user_id: resolvedUserId,
        source: 'attio',
        external_id: externalId,
        title,
        call_date: callDate,
        duration_minutes: durationMinutes,
        participants: participants.length > 0 ? participants : null,
        raw_transcript: rawTranscript,
        speaker_map: speakerMap,
      })
      .select()
      .single();

    if (insertError || !saved) {
      throw new Error(`Failed to insert transcript: ${insertError?.message}`);
    }

    logger.info('Transcript saved, triggering AI processing', {
      transcriptId: saved.id,
      title,
      durationMinutes,
      transcriptLength: rawTranscript.length,
    });

    // Trigger AI processing pipeline
    await tasks.trigger<typeof processTranscript>('process-transcript', {
      userId: resolvedUserId,
      transcriptId: saved.id,
    });

    return { transcriptId: saved.id, title };
  },
});
