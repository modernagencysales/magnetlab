import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as postsService from '@/server/services/posts.service';
import { validateUnipileAccountAccess } from '@/server/services/linkedin-accounts.service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const unipileAccountId: string | undefined = body?.unipile_account_id;

    if (unipileAccountId) {
      await validateUnipileAccountAccess(session.user.id, unipileAccountId);
    }

    const result = await postsService.publishPost(session.user.id, id, unipileAccountId);
    return NextResponse.json(result);
  } catch (error) {
    logError('cp/posts/publish', error, { step: 'publish_post_error' });
    const status = postsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
