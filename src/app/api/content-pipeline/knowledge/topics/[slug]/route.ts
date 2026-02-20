import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTopicDetail } from '@/lib/services/knowledge-brain';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const teamId = request.nextUrl.searchParams.get('team_id') || undefined;
    // TODO: pass teamId to getTopicDetail once team-aware version is implemented
    void teamId;
    const detail = await getTopicDetail(session.user.id, slug);

    if (!detail.topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
