/** Position Synthesis API. GET = cached position, POST = force fresh synthesis. */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCachedPosition, listPositions } from '@/lib/services/knowledge-brain';

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
