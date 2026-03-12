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
    const { meetingId, callRecordingId, userId: fallbackUserId } = payload;
    const supabase = createSupabaseAdminClient();
    const externalId = `attio:${callRecordingId}`;

    logger.info('Importing Attio recording', { meetingId, callRecordingId });

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

    // --- Resolve owner: match meeting participant emails to MagnetLab users ---
    const participantEmails = meeting
      ? meeting.participants.map((p) => p.email_address).filter(Boolean)
      : [];

    let resolvedUserId = fallbackUserId;

    if (participantEmails.length > 0) {
      // Find MagnetLab users whose email matches a meeting participant
      const { data: matchedUsers } = await supabase
        .from('users')
        .select('id, email')
        .in('email', participantEmails);

      if (matchedUsers && matchedUsers.length > 0) {
        // Prefer the organizer if they're a matched user
        const organizerEmail = meeting?.participants.find((p) => p.is_organizer)?.email_address;
        const organizer = organizerEmail
          ? matchedUsers.find((u) => u.email === organizerEmail)
          : null;
        resolvedUserId = organizer?.id ?? matchedUsers[0].id;

        logger.info('Resolved transcript owner from participants', {
          resolvedUserId,
          resolvedEmail: organizer?.email ?? matchedUsers[0].email,
          fallbackUserId,
        });
      }
    }

    // Dedup check using resolved user
    const { data: existing } = await supabase
      .from('cp_call_transcripts')
      .select('id')
      .eq('external_id', externalId)
      .eq('user_id', resolvedUserId)
      .maybeSingle();

    if (existing) {
      logger.info('Duplicate — already imported', { transcriptId: existing.id });
      return { duplicate: true, transcriptId: existing.id };
    }

    // Build record
    const title = meeting?.title || null;
    const callDate = meeting?.start?.datetime || null;
    const durationMinutes = meeting ? calcDurationMinutes(meeting.start, meeting.end) : null;
    const participants = meeting ? extractParticipants(meeting) : [];
    const speakerNames = extractSpeakerNames(segmentsRes.data);
    const speakerMap = meeting ? buildSpeakerMap(meeting.participants, speakerNames) : null;

    // Resolve team_id — check ownership first, then team_profiles membership
    const { data: ownedTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('owner_id', resolvedUserId)
      .maybeSingle();

    let teamId = ownedTeam?.id ?? null;

    if (!teamId) {
      const { data: profile } = await supabase
        .from('team_profiles')
        .select('team_id')
        .eq('user_id', resolvedUserId)
        .maybeSingle();
      teamId = profile?.team_id ?? null;
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
        team_id: teamId,
      })
      .select()
      .single();

    if (insertError || !saved) {
      throw new Error(`Failed to insert transcript: ${insertError?.message}`);
    }

    logger.info('Transcript saved, triggering AI processing', {
      transcriptId: saved.id,
      title,
      resolvedUserId,
      teamId,
      durationMinutes,
      transcriptLength: rawTranscript.length,
    });

    // Trigger AI processing pipeline
    await tasks.trigger<typeof processTranscript>('process-transcript', {
      userId: resolvedUserId,
      transcriptId: saved.id,
      teamId: teamId ?? undefined,
    });

    return { transcriptId: saved.id, title, resolvedUserId };
  },
});
