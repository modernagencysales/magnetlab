import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { tasks } from '@trigger.dev/sdk/v3';
import { getBufferSize, getNextScheduledTime, getPillarCounts } from '@/lib/services/autopilot';
import type { runAutopilot } from '@/trigger/run-autopilot';

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
    console.error('Autopilot status error:', error);
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
    const { postsPerBatch = 3, bufferTarget = 5, autoPublish = false } = body;

    const handle = await tasks.trigger<typeof runAutopilot>('run-autopilot', {
      userId: session.user.id,
      postsPerBatch,
      bufferTarget,
      autoPublish,
    });

    return NextResponse.json({
      triggered: true,
      runId: handle.id,
    });
  } catch (error) {
    console.error('Autopilot trigger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
