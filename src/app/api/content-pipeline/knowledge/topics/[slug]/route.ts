import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as knowledgeService from '@/server/services/knowledge.service';

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

    if (teamId) await knowledgeService.assertTeamMembership(session.user.id, teamId);

    const detail = await knowledgeService.getTopicBySlug(session.user.id, slug, teamId);

    if (!detail.topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (error) {
    const status = knowledgeService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
