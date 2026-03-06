import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/utils/logger';
import * as webhooksIncomingService from '@/server/services/webhooks-incoming.service';

export async function POST(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get('secret');
    if (!secret || secret !== process.env.TRANSCRIPT_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = request.nextUrl.searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required query param: user_id' },
        { status: 400 }
      );
    }

    const payload = await request.json();
    if (!payload.recording_id || !payload.transcript) {
      return NextResponse.json(
        { error: 'Missing required fields: recording_id, transcript' },
        { status: 400 }
      );
    }

    const result = await webhooksIncomingService.handleTranscript(userId, payload);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      ...(result.duplicate && { duplicate: true }),
      transcript_id: result.transcript_id,
    });
  } catch (error) {
    logError('webhooks/transcript', error, { step: 'universal_transcript_webhook_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
