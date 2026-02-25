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
    const speakerMap = meeting
      ? buildSpeakerMap(meeting.participants, speakerNames)
      : null;

    // Insert
    const { data: saved, error: insertError } = await supabase
      .from('cp_call_transcripts')
      .insert({
        user_id: userId,
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
      userId,
      transcriptId: saved.id,
    });

    return { transcriptId: saved.id, title };
  },
});
