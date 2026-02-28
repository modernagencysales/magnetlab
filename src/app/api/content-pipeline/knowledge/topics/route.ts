import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import * as knowledgeService from '@/server/services/knowledge.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    let teamId: string | undefined = searchParams.get('team_id') || undefined;
    if (!teamId) {
      const cookieStore = await cookies();
      teamId = cookieStore.get('ml-team-context')?.value || undefined;
    }

    if (teamId) await knowledgeService.assertTeamMembership(session.user.id, teamId);

    const topics = await knowledgeService.getTopics(session.user.id, teamId, limit);
    return NextResponse.json({ topics });
  } catch (error) {
    const status = knowledgeService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
