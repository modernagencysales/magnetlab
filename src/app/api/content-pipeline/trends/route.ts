/**
 * Content Pipeline — Trends Route
 * GET /api/content-pipeline/trends — get trending topics for the authenticated user
 * Never contains business logic; delegates to trendsService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as trendsService from '@/server/services/trends.service';

// ─── GET handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10), 1), 100) : 10;

    const topics = await trendsService.getTrendingTopics(session.user.id, limit);

    return NextResponse.json({ topics });
  } catch (error) {
    logError('cp/trends', error, { step: 'trends_get_error' });
    return NextResponse.json(
      {
        error:
          trendsService.getStatusCode(error) < 500
            ? (error as Error).message
            : 'Internal server error',
      },
      { status: trendsService.getStatusCode(error) }
    );
  }
}
