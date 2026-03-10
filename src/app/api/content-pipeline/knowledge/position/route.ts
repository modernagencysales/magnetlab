/** Position Synthesis API. GET = cached/list, POST = force fresh or bulk recompute. */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getCachedPosition,
  listPositions,
  synthesizeAndCachePosition,
} from '@/lib/services/knowledge-brain';
import { logApiError } from '@/lib/api/errors';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const topicSlug = searchParams.get('topic');

  // If no topic specified, list all positions
  if (!topicSlug) {
    const positions = await listPositions(session.user.id, { includeStale: true });
    return NextResponse.json({ positions });
  }

  const position = await getCachedPosition(session.user.id, topicSlug);
  if (!position) {
    return NextResponse.json(
      {
        error:
          'Not enough knowledge entries to synthesize a position on this topic (need at least 3)',
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ position });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  // Bulk recompute: re-synthesize all existing positions
  if (body.recompute_all === true) {
    const positions = await listPositions(session.user.id, { includeStale: true });
    if (positions.length === 0) {
      return NextResponse.json({ recomputed: 0, errors: 0, message: 'No positions to recompute' });
    }

    let recomputed = 0;
    let errors = 0;
    for (const row of positions) {
      try {
        const result = await synthesizeAndCachePosition(session.user.id, row.topic_slug);
        if (result) recomputed++;
      } catch (err) {
        errors++;
        logApiError('position/recompute', err, { topicSlug: row.topic_slug });
      }
    }

    return NextResponse.json({ recomputed, errors, total: positions.length });
  }

  // Single topic: force fresh synthesis
  const topicSlug = body.topic as string;
  if (!topicSlug) {
    return NextResponse.json({ error: 'topic is required' }, { status: 400 });
  }

  const position = await getCachedPosition(session.user.id, topicSlug, {
    forceFresh: true,
  });

  if (!position) {
    return NextResponse.json(
      {
        error:
          'Not enough knowledge entries to synthesize a position on this topic (need at least 3)',
      },
      { status: 404 }
    );
  }

  return NextResponse.json({ position });
}
