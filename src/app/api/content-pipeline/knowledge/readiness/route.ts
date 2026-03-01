import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as knowledgeService from '@/server/services/knowledge.service';
import type { ReadinessGoal } from '@/server/services/knowledge.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const topic = searchParams.get('topic');
    const goal = searchParams.get('goal') as ReadinessGoal | null;
    const teamId = searchParams.get('team_id') || undefined;

    if (!topic) {
      return NextResponse.json({ error: 'topic parameter is required' }, { status: 400 });
    }

    if (!goal) {
      return NextResponse.json(
        { error: 'goal must be one of: lead_magnet, blog_post, course, sop, content_week' },
        { status: 400 },
      );
    }

    if (teamId) await knowledgeService.assertTeamMembership(session.user.id, teamId);

    const readiness = await knowledgeService.assessKnowledgeReadiness(
      session.user.id,
      topic,
      goal,
      teamId,
    );
    return NextResponse.json({ readiness });
  } catch (error) {
    const status = knowledgeService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
