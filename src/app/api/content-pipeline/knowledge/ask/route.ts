import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { answerKnowledgeQuestion } from '@/lib/ai/content-pipeline/knowledge-answerer';
import { verifyTeamMembership } from '@/lib/services/knowledge-brain';
import { logError } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { question, team_id: teamId } = body;

    if (!question || typeof question !== 'string' || question.length < 3) {
      return NextResponse.json({ error: 'Question must be at least 3 characters' }, { status: 400 });
    }

    if (teamId) {
      const isMember = await verifyTeamMembership(session.user.id, teamId);
      if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await answerKnowledgeQuestion(session.user.id, question, teamId);
    return NextResponse.json(result);
  } catch (error) {
    logError('cp/knowledge/ask', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
