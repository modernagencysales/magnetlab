import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { tasks } from '@trigger.dev/sdk/v3';
import type { broadcastPostVariations } from '@/trigger/broadcast-post-variations';
import { logError } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { source_post_id, target_profile_ids, stagger_days } = body;

    // Validate required fields
    if (!source_post_id) {
      return NextResponse.json(
        { error: 'source_post_id is required' },
        { status: 400 }
      );
    }

    if (!target_profile_ids || !Array.isArray(target_profile_ids) || target_profile_ids.length === 0) {
      return NextResponse.json(
        { error: 'target_profile_ids must be a non-empty array' },
        { status: 400 }
      );
    }

    // Validate stagger_days if provided
    const parsedStagger = stagger_days != null ? Number(stagger_days) : NaN;
    const staggerDays = Number.isFinite(parsedStagger)
      ? Math.max(1, Math.min(5, parsedStagger))
      : 2;

    // Trigger the broadcast task
    const handle = await tasks.trigger<typeof broadcastPostVariations>(
      'broadcast-post-variations',
      {
        sourcePostId: source_post_id,
        targetProfileIds: target_profile_ids,
        userId: session.user.id,
        staggerDays,
      }
    );

    return NextResponse.json({
      success: true,
      run_id: handle.id,
      message: `Broadcasting to ${target_profile_ids.length} team members`,
    });
  } catch (error) {
    logError('cp/broadcast', error, { step: 'broadcast_trigger_error' });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
