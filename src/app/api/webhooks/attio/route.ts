import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';
import { verifyAttioWebhook } from '@/lib/webhooks/verify';
import {
  createAttioClient,
  assembleTranscript,
  calcDurationMinutes,
  extractParticipants,
  type AttioCallRecordingCreatedEvent,
} from '@/lib/integrations/attio';
import { logError, logInfo, logWarn } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    // Read raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get('Attio-Signature');

    const verification = verifyAttioWebhook(rawBody, signature);
    if (!verification.valid) {
      logWarn('webhooks/attio', 'Signature verification failed', {
        error: verification.error,
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event: AttioCallRecordingCreatedEvent = JSON.parse(rawBody);

    // Only handle call-recording.created events
    if (event.event_type !== 'call-recording.created') {
      return NextResponse.json({ success: true, skipped: true });
    }

    const { meeting_id, call_recording_id } = event.id;

    logInfo('webhooks/attio', 'Processing call-recording.created', {
      meeting_id,
      call_recording_id,
    });

    // Determine which MagnetLab user to attribute this to
    const userId = process.env.ATTIO_DEFAULT_USER_ID;
    if (!userId) {
      logError('webhooks/attio', new Error('ATTIO_DEFAULT_USER_ID not configured'), {});
      return NextResponse.json(
        { error: 'Server misconfiguration: no default user' },
        { status: 500 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const externalId = `attio:${call_recording_id}`;

    // Deduplicate
    const { data: existing } = await supabase
      .from('cp_call_transcripts')
      .select('id')
      .eq('external_id', externalId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        transcript_id: existing.id,
      });
    }

    // Fetch meeting details + full paginated transcript from Attio API
    const attio = createAttioClient();

    const [meetingRes, segmentsRes] = await Promise.all([
      attio.getMeeting(meeting_id),
      attio.getFullTranscript(meeting_id, call_recording_id),
    ]);

    if (!segmentsRes.data || segmentsRes.data.length === 0) {
      logWarn('webhooks/attio', 'Empty transcript received', {
        meeting_id,
        call_recording_id,
        error: segmentsRes.error,
      });
      return NextResponse.json({ success: true, skipped: true, reason: 'empty_transcript' });
    }

    const meeting = meetingRes.data;
    const rawTranscript = assembleTranscript(segmentsRes.data);

    if (rawTranscript.length === 0) {
      logWarn('webhooks/attio', 'Assembled transcript is empty', { meeting_id, call_recording_id });
      return NextResponse.json({ success: true, skipped: true, reason: 'empty_transcript' });
    }

    // Build record
    const title = meeting?.title || null;
    const callDate = meeting?.start?.datetime || null;
    const durationMinutes = meeting ? calcDurationMinutes(meeting.start, meeting.end) : null;
    const participants = meeting ? extractParticipants(meeting) : [];

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
      })
      .select()
      .single();

    if (insertError || !saved) {
      logError('webhooks/attio', new Error(String(insertError?.message)), {
        step: 'failed_to_insert_attio_transcript',
      });
      return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
    }

    logInfo('webhooks/attio', 'Transcript saved', {
      transcript_id: saved.id,
      title,
      duration_minutes: durationMinutes,
      transcript_length: rawTranscript.length,
    });

    // Trigger AI processing pipeline
    try {
      await tasks.trigger<typeof processTranscript>('process-transcript', {
        userId,
        transcriptId: saved.id,
      });
    } catch (triggerError) {
      logWarn('webhooks/attio', 'Failed to trigger process-transcript', {
        detail: String(triggerError),
      });
    }

    return NextResponse.json({
      success: true,
      transcript_id: saved.id,
    });
  } catch (error) {
    logError('webhooks/attio', error, { step: 'attio_webhook_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
