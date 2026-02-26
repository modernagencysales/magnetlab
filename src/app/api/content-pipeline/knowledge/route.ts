import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { getAllRecentKnowledge, getFilteredKnowledge, getKnowledgeTags, searchKnowledgeV2, verifyTeamMembership } from '@/lib/services/knowledge-brain';
import type { KnowledgeSortOption } from '@/lib/services/knowledge-brain';
import type { KnowledgeCategory, KnowledgeSpeaker, KnowledgeType } from '@/lib/types/content-pipeline';

import { logError } from '@/lib/utils/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const query = searchParams.get('q');
    const category = searchParams.get('category') as KnowledgeCategory | null;
    const speaker = searchParams.get('speaker') as KnowledgeSpeaker | null;
    const tag = searchParams.get('tag');
    const view = searchParams.get('view'); // 'tags' for tag list
    const limit = parseInt(searchParams.get('limit') || '30', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // V2 filter params
    const knowledgeType = searchParams.get('type') as KnowledgeType | null;
    const topicSlug = searchParams.get('topic');
    const minQuality = searchParams.get('min_quality') ? parseInt(searchParams.get('min_quality')!, 10) : undefined;
    const since = searchParams.get('since');
    // Read team_id from query param, fall back to server-side cookie
    let teamId: string | undefined = searchParams.get('team_id') || undefined;
    if (!teamId) {
      const cookieStore = await cookies();
      teamId = cookieStore.get('ml-team-context')?.value || undefined;
    }
    const sortParam = searchParams.get('sort');
    const sort: KnowledgeSortOption = sortParam && ['newest', 'oldest', 'quality'].includes(sortParam)
      ? (sortParam as KnowledgeSortOption)
      : 'newest';

    if (teamId) {
      const isMember = await verifyTeamMembership(session.user.id, teamId);
      if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Resolve effective user ID(s) for team-scoped queries
    let effectiveUserId = session.user.id;
    if (teamId) {
      // For team context, use the team owner's user_id so knowledge entries are scoped to the team
      const supabase = (await import('@/lib/utils/supabase-server')).createSupabaseAdminClient();
      const { data: ownerProfile } = await supabase
        .from('team_profiles')
        .select('user_id')
        .eq('team_id', teamId)
        .eq('role', 'owner')
        .limit(1)
        .single();
      if (ownerProfile) {
        effectiveUserId = ownerProfile.user_id;
      }
    }

    // Tags endpoint
    if (view === 'tags') {
      const tags = await getKnowledgeTags(effectiveUserId);
      return NextResponse.json({ tags });
    }

    // V2 enhanced search (when any new filter is present)
    const hasV2Filters = knowledgeType || topicSlug || minQuality || since;
    if (query || hasV2Filters) {
      const result = await searchKnowledgeV2(effectiveUserId, {
        query: query || undefined,
        knowledgeType: knowledgeType || undefined,
        topicSlug: topicSlug || undefined,
        minQuality,
        since: since || undefined,
        category: category || undefined,
        tags: tag ? [tag] : undefined,
        limit,
        threshold: 0.6,
        teamId,
        sort: query ? undefined : sort,
      });
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      let entries = result.entries;
      if (speaker) {
        entries = entries.filter((e) => e.speaker === speaker);
      }
      return NextResponse.json({ entries, total_count: entries.length });
    }

    // Filtered browse (any combination of category, speaker, tag)
    const hasFilters = category || speaker || tag;
    if (hasFilters) {
      const entries = await getFilteredKnowledge(effectiveUserId, {
        category: category || undefined,
        speaker: speaker || undefined,
        tag: tag || undefined,
        limit,
        offset,
        sort,
      });
      return NextResponse.json({ entries, total_count: entries.length });
    }

    // Default: return recent entries across all categories
    const entries = await getAllRecentKnowledge(effectiveUserId, limit, sort);
    return NextResponse.json({ entries, total_count: entries.length });
  } catch (error) {
    logError('cp/knowledge', error, { step: 'knowledge_api_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
