import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/utils/logger';
import * as webhooksIncomingService from '@/server/services/webhooks-incoming.service';

export async function POST(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get('secret');
    if (!secret || secret !== process.env.FIREFLIES_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    if (!payload.meeting_id || !payload.transcript || !payload.user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: meeting_id, transcript, user_id' },
        { status: 400 }
      );
    }

    const result = await webhooksIncomingService.handleFireflies(payload);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ...(result.duplicate && { duplicate: true }),
      transcript_id: result.transcript_id,
    });
  } catch (error) {
    logError('webhooks/fireflies', error, { step: 'fireflies_webhook_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
