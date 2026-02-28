import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import * as cpBroadcastService from '@/server/services/cp-broadcast.service';

const broadcastSchema = z.object({
  source_post_id: z.string().uuid(),
  target_profile_ids: z.array(z.string().uuid()).min(1),
  stagger_days: z.number().int().min(1).max(5).optional().default(2),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = broadcastSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { source_post_id, target_profile_ids, stagger_days: staggerDays } = parsed.data;

    const result = await cpBroadcastService.triggerBroadcast(session.user.id, {
      sourcePostId: source_post_id,
      targetProfileIds: target_profile_ids,
      staggerDays,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      run_id: result.runId,
      message: `Broadcasting to ${target_profile_ids.length} team members`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
