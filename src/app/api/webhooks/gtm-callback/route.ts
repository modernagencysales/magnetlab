import { NextRequest, NextResponse } from 'next/server';
import { verifyGtmCallbackWebhook } from '@/lib/webhooks/verify';
import { logError, logWarn } from '@/lib/utils/logger';
import * as webhooksIncomingService from '@/server/services/webhooks-incoming.service';

export async function POST(request: NextRequest) {
  try {
    const verification = await verifyGtmCallbackWebhook(request);
    if (!verification.valid) {
      logWarn('webhooks/gtm-callback', 'Verification failed', { error: verification.error });
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    const payload = await request.json();
    if (!payload.event || !payload.data) {
      return NextResponse.json(
        { error: 'Missing required fields: event, data' },
        { status: 400 }
      );
    }

    const result = await webhooksIncomingService.handleGtmCallback(payload);

    if (!result.success) {
      const isBadRequest =
        result.error?.includes('Missing') || result.error?.includes('Unknown');
      return NextResponse.json(
        { error: result.error },
        { status: isBadRequest ? 400 : 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('webhooks/gtm-callback', error, { step: 'processing' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
