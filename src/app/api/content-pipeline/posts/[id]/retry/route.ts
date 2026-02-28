import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import * as postsService from '@/server/services/posts.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    await postsService.retryPost(session.user.id, id);
    return NextResponse.json({ success: true, message: 'Post queued for retry' });
  } catch (error) {
    const status = postsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Failed to retry post';
    return NextResponse.json({ error: message }, { status });
  }
}
