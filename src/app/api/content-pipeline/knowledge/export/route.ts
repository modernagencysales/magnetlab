import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as knowledgeService from '@/server/services/knowledge.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const topic = searchParams.get('topic');
    const format = searchParams.get('format') || 'structured';
    const teamId = searchParams.get('team_id') || undefined;

    if (!topic) {
      return NextResponse.json({ error: 'topic parameter is required' }, { status: 400 });
    }

    if (teamId) await knowledgeService.assertTeamMembership(session.user.id, teamId);

    const result = await knowledgeService.exportKnowledge(session.user.id, topic, format, teamId);
    return NextResponse.json(result);
  } catch (error) {
    const status = knowledgeService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
