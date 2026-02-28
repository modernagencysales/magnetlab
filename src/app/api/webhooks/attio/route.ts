import { NextRequest, NextResponse } from 'next/server';
import { verifyAttioWebhook } from '@/lib/webhooks/verify';
import type { AttioCallRecordingCreatedEvent } from '@/lib/integrations/attio';
import { logError, logInfo, logWarn } from '@/lib/utils/logger';
import * as webhooksIncomingService from '@/server/services/webhooks-incoming.service';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('Attio-Signature');

    const verification = verifyAttioWebhook(rawBody, signature);
    if (!verification.valid) {
      logWarn('webhooks/attio', 'Signature verification failed', { error: verification.error });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const event: AttioCallRecordingCreatedEvent = JSON.parse(rawBody);

    logInfo('webhooks/attio', 'Received call-recording.created', {
      meeting_id: event.id?.meeting_id,
      call_recording_id: event.id?.call_recording_id,
    });

    const result = await webhooksIncomingService.handleAttio(event);

    if (!result.success && result.error) {
      const status =
        result.error === 'ATTIO_DEFAULT_USER_ID not configured' ? 500 : 401;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      success: result.success,
      ...(result.skipped && { skipped: true }),
      ...(result.duplicate && { duplicate: true, transcript_id: result.transcript_id }),
      ...(result.accepted && { accepted: true }),
    });
  } catch (error) {
    logError('webhooks/attio', error, { step: 'attio_webhook_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
