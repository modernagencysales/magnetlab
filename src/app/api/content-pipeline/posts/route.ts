import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { logError } from '@/lib/utils/logger';
import * as postsService from '@/server/services/posts.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scope = await getDataScope(session.user.id);

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') ?? undefined;
    const isBufferParam = searchParams.get('is_buffer');
    const teamProfileId = searchParams.get('team_profile_id') ?? undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const isBuffer =
      isBufferParam === 'true' ? true : isBufferParam === 'false' ? false : undefined;

    const posts = await postsService.getPosts(scope, {
      status,
      isBuffer,
      teamProfileId,
      limit,
    });

    return NextResponse.json({ posts });
  } catch (error) {
    logError('cp/posts', error, { step: 'posts_list_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
