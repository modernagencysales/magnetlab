/**
 * Content Pipeline — Recyclable Posts Route
 * GET /api/content-pipeline/posts/recyclable
 * Lists posts ready for recycling (recycle_after <= now, status = published).
 * Never contains business logic; delegates to recyclingService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as recyclingService from '@/server/services/recycling.service';

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 20, 1), 100) : 20;

    const posts = await recyclingService.listRecyclablePosts(session.user.id, limit);

    return NextResponse.json({ posts });
  } catch (error) {
    logError('cp/posts/recyclable', error, { step: 'list_recyclable_posts_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
