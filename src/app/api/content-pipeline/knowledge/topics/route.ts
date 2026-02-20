import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listKnowledgeTopics } from '@/lib/services/knowledge-brain';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const teamId = searchParams.get('team_id') || undefined;

    const topics = await listKnowledgeTopics(session.user.id, { teamId, limit });
    return NextResponse.json({ topics });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
