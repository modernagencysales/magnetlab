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
    const start = searchParams.get('start');
    const end = searchParams.get('end');

    if (!start || !end) {
      return NextResponse.json({ error: 'start and end query params are required' }, { status: 400 });
    }

    const posts = await postsService.getPostsByDateRange(scope, start, end);
    return NextResponse.json({ posts });
  } catch (error) {
    logError('cp/posts', error, { step: 'posts_by_date_range_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
