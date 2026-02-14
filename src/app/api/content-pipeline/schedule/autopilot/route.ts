import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { tasks } from '@trigger.dev/sdk/v3';
import { getBufferSize, getNextScheduledTime, getPillarCounts } from '@/lib/services/autopilot';
import type { runAutopilot } from '@/trigger/run-autopilot';

import { logError } from '@/lib/utils/logger';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [bufferSize, nextSlot, pillarCounts] = await Promise.all([
      getBufferSize(session.user.id),
      getNextScheduledTime(session.user.id),
      getPillarCounts(session.user.id),
    ]);

    return NextResponse.json({
      bufferSize,
      nextScheduledSlot: nextSlot.toISOString(),
      pillarCounts,
    });
  } catch (error) {
    logError('cp/schedule/autopilot', error, { step: 'autopilot_status_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const postsPerBatch = Math.max(1, Math.min(10, Number(body.postsPerBatch) || 3));
    const bufferTarget = Math.max(1, Math.min(20, Number(body.bufferTarget) || 5));
    const autoPublish = body.autoPublish === true;
    const profileId = body.profileId || undefined;
    const teamId = body.teamId || undefined;

    const handle = await tasks.trigger<typeof runAutopilot>('run-autopilot', {
      userId: session.user.id,
      postsPerBatch,
      bufferTarget,
      autoPublish,
      teamId,
      profileId,
    });

    return NextResponse.json({
      triggered: true,
      runId: handle.id,
    });
  } catch (error) {
    logError('cp/schedule/autopilot', error, { step: 'autopilot_trigger_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
