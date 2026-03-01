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
    const days = parseInt(searchParams.get('days') || '7', 10);
    const teamId = searchParams.get('team_id') || undefined;

    if (teamId) await knowledgeService.assertTeamMembership(session.user.id, teamId);

    const digest = await knowledgeService.getKnowledgeDigest(session.user.id, days, teamId);
    return NextResponse.json(digest);
  } catch (error) {
    const status = knowledgeService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
