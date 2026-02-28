import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as knowledgeService from '@/server/services/knowledge.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { question, team_id: teamId } = body;

    if (teamId) await knowledgeService.assertTeamMembership(session.user.id, teamId);

    const result = await knowledgeService.askKnowledge(session.user.id, question, teamId);
    return NextResponse.json(result);
  } catch (error) {
    logError('cp/knowledge/ask', error);
    const status = knowledgeService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
