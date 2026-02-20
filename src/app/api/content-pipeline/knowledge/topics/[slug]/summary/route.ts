import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateAndCacheTopicSummary, verifyTeamMembership } from '@/lib/services/knowledge-brain';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const { searchParams } = request.nextUrl;
    const force = searchParams.get('force') === 'true';
    const teamId = searchParams.get('team_id') || undefined;

    if (teamId) {
      const isMember = await verifyTeamMembership(session.user.id, teamId);
      if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await generateAndCacheTopicSummary(session.user.id, slug, force, teamId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
