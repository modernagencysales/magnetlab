import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as postsService from '@/server/services/posts.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { post_id, scheduled_time } = body;

    if (!post_id) {
      return NextResponse.json({ error: 'post_id is required' }, { status: 400 });
    }

    await postsService.schedulePost(session.user.id, post_id, scheduled_time);
    return NextResponse.json({ success: true, scheduled_via: 'pending' });
  } catch (error) {
    logError('cp/posts/schedule', error, { step: 'post_schedule_error' });
    const status = postsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
