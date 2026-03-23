/**
 * Direct Publish Route.
 * Creates a cp_pipeline_posts record and publishes immediately to LinkedIn in one call.
 * Validates Unipile account ownership before delegating to postsService.directPublish.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as postsService from '@/server/services/posts.service';
import { validateUnipileAccountAccess } from '@/server/services/linkedin-accounts.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { unipile_account_id, text } = body ?? {};

    if (!unipile_account_id || typeof unipile_account_id !== 'string') {
      return NextResponse.json({ error: 'unipile_account_id is required' }, { status: 400 });
    }
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const hasAccess = await validateUnipileAccountAccess(session.user.id, unipile_account_id);
    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied to this Unipile account' }, { status: 403 });
    }

    const result = await postsService.directPublish(session.user.id, body);
    return NextResponse.json(result);
  } catch (error) {
    logError('cp/posts/direct-publish', error, { step: 'handler' });
    const status = postsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
