import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as knowledgeService from '@/server/services/knowledge.service';

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

    if (teamId) await knowledgeService.assertTeamMembership(session.user.id, teamId);

    const result = await knowledgeService.getTopicSummary(session.user.id, slug, force, teamId);
    return NextResponse.json(result);
  } catch (error) {
    const status = knowledgeService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    if (message.includes('not found')) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}
