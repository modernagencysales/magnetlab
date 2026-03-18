/**
 * Content Queue — Submit Batch Route.
 * POST /api/content-queue/submit — submit a team's edited posts for client review.
 * Never contains business logic; delegates to contentQueueService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { ContentQueueSubmitSchemaV2 } from '@/lib/validations/content-queue';
import { formatZodError } from '@/lib/validations/api';
import * as contentQueueService from '@/server/services/content-queue.service';

// ─── POST handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = ContentQueueSubmitSchemaV2.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await contentQueueService.submitBatch(
      session.user.id,
      parsed.data.team_id,
      parsed.data.submit_type
    );
    return NextResponse.json(result);
  } catch (error) {
    const status = contentQueueService.getStatusCode(error);
    logError('content-queue/submit', error, { step: 'queue_submit_error' });
    return NextResponse.json(
      { error: status < 500 ? (error as Error).message : 'Internal server error' },
      { status }
    );
  }
}
