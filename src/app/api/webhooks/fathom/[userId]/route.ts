import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/utils/logger';
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = await webhooksIncomingService.handleFathom(userId, secret, payload);

    if (!result.success && result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.error === 'Unauthorized' ? 401 : 400 }
      );
    }

    const response: Record<string, unknown> = { success: true };
    if (result.skipped) { response.skipped = true; response.reason = result.reason; }
    if (result.duplicate) { response.duplicate = true; response.transcript_id = result.transcript_id; }
    if (result.transcript_id && !result.duplicate) { response.transcript_id = result.transcript_id; }
    return NextResponse.json(response);
  } catch (error) {
    logError('webhooks/fathom', error, { step: 'fathom_webhook_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
