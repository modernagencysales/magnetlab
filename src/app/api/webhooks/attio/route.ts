import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { importAttioRecording } from '@/trigger/import-attio-recording';
import { verifyAttioWebhook } from '@/lib/webhooks/verify';
import type { AttioCallRecordingCreatedEvent } from '@/lib/integrations/attio';
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

    logInfo('webhooks/attio', 'Received call-recording.created', {
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

    // Quick dedup check — respond fast, don't re-queue known recordings
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

    // Queue the heavy work (Attio API fetch + Supabase insert + AI pipeline)
    // to a background Trigger.dev task so we respond to Attio within seconds.
    await tasks.trigger<typeof importAttioRecording>('import-attio-recording', {
      meetingId: meeting_id,
      callRecordingId: call_recording_id,
      userId,
    });

    logInfo('webhooks/attio', 'Queued import-attio-recording task', {
      meeting_id,
      call_recording_id,
    });

    return NextResponse.json({ success: true, accepted: true });
  } catch (error) {
    logError('webhooks/attio', error, { step: 'attio_webhook_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
