import { NextRequest, NextResponse } from 'next/server';
import { logError, logWarn } from '@/lib/utils/logger';
import * as webhooksIncomingService from '@/server/services/webhooks-incoming.service';

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;

    const secret = request.nextUrl.searchParams.get('secret');
    if (!secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();

    const result = await webhooksIncomingService.handleFathom(userId, secret, payload);

    if (!result.success && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Unauthorized' ? 401 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...(result.skipped && { skipped: true, reason: result.reason }),
      ...(result.duplicate && { duplicate: true, transcript_id: result.transcript_id }),
      ...(result.transcript_id && !result.duplicate && { transcript_id: result.transcript_id }),
    });
  } catch (error) {
    logError('webhooks/fathom', error, { step: 'fathom_webhook_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
