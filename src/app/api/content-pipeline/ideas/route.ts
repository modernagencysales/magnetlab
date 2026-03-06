import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { logError } from '@/lib/utils/logger';
import * as ideasService from '@/server/services/ideas.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scope = await getDataScope(session.user.id);

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') ?? undefined;
    const pillar = searchParams.get('pillar') ?? undefined;
    const contentType = searchParams.get('content_type') ?? undefined;
    const teamProfileId = searchParams.get('team_profile_id') ?? undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const ideas = await ideasService.getIdeas(scope, { status, pillar, contentType, teamProfileId, limit });
    return NextResponse.json({ ideas });
  } catch (error) {
    logError('cp/ideas', error, { step: 'ideas_list_error' });
    const status = ideasService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scope = await getDataScope(session.user.id);

    const body = await request.json();
    const { ideaId } = body;

    if (!ideaId || typeof ideaId !== 'string') {
      return NextResponse.json({ error: 'ideaId is required' }, { status: 400 });
    }

    const idea = await ideasService.updateIdea(scope, ideaId, body);
    return NextResponse.json({ idea });
  } catch (error) {
    logError('cp/ideas', error, { step: 'idea_update_error' });
    const status = ideasService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
