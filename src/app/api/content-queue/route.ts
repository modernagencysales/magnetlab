/**
 * Content Queue — List Route.
 * GET /api/content-queue — list all draft posts grouped by team.
 * Never contains business logic; delegates to contentQueueService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as contentQueueService from '@/server/services/content-queue.service';

// ─── GET handler ───────────────────────────────────────────────────────────

export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await contentQueueService.getQueue(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    logError('content-queue/list', error, { step: 'queue_list_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
