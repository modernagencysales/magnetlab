import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as knowledgeService from '@/server/services/knowledge.service';
import type { KnowledgeCategory, KnowledgeSpeaker, KnowledgeType } from '@/lib/types/content-pipeline';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const query = searchParams.get('q') ?? undefined;
    const category = searchParams.get('category') as KnowledgeCategory | null ?? undefined;
    const speaker = searchParams.get('speaker') as KnowledgeSpeaker | null ?? undefined;
    const tag = searchParams.get('tag') ?? undefined;
    const view = searchParams.get('view') ?? undefined;
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const knowledgeType = searchParams.get('type') as KnowledgeType | null ?? undefined;
    const topicSlug = searchParams.get('topic') ?? undefined;
    const minQuality = searchParams.get('min_quality') ? parseInt(searchParams.get('min_quality')!, 10) : undefined;
    const since = searchParams.get('since') ?? undefined;
    const sortParam = searchParams.get('sort');
    const sort = sortParam && ['newest', 'oldest', 'quality'].includes(sortParam)
      ? (sortParam as knowledgeService.KnowledgeSortOption)
      : 'newest';

    let teamId: string | undefined = searchParams.get('team_id') || undefined;
    if (!teamId) {
      const cookieStore = await cookies();
      teamId = cookieStore.get('ml-team-context')?.value || undefined;
    }

    if (teamId) await knowledgeService.assertTeamMembership(session.user.id, teamId);

    const result = await knowledgeService.listKnowledge(session.user.id, {
      query, category, speaker, tag, view, knowledgeType, topicSlug, minQuality,
      since, teamId, sort, limit, offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    logError('cp/knowledge', error, { step: 'knowledge_api_error' });
    const status = knowledgeService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
