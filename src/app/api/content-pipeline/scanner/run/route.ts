/**
 * Scanner Run Route.
 * POST /api/content-pipeline/scanner/run — trigger a manual content scan for the current user.
 * Never contains business logic; delegates to Trigger.dev task.
 */

import { NextResponse } from 'next/server';
import { tasks } from '@trigger.dev/sdk/v3';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const handle = await tasks.trigger('scan-content-sources-manual', {
      userId: session.user.id,
    });

    return NextResponse.json({ triggered: true, taskId: handle.id });
  } catch (error) {
    logError('api/scanner/run', error, { step: 'trigger_scan' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
