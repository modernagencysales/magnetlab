import { NextRequest, NextResponse } from 'next/server';
import { verifyGtmCallbackWebhook } from '@/lib/webhooks/verify';
import { logError, logWarn } from '@/lib/utils/logger';
import * as webhooksIncomingService from '@/server/services/webhooks-incoming.service';

export async function POST(request: NextRequest) {
  try {
    const verification = await verifyGtmCallbackWebhook(request);
    if (!verification.valid) {
      logWarn('webhooks/dfy', 'Verification failed', { error: verification.error });
      return NextResponse.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    const payload = await request.json();
    if (!payload.action || !payload.userId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, userId' },
        { status: 400 }
      );
    }

    const result = await webhooksIncomingService.handleDfy(payload);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...(result.leadMagnetId && { leadMagnetId: result.leadMagnetId }),
      ...(result.runId && { runId: result.runId }),
    });
  } catch (error) {
    logError('webhooks/dfy', error, { step: 'processing' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
