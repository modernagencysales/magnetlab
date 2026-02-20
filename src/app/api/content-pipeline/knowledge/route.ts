import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchKnowledge, getAllRecentKnowledge, getFilteredKnowledge, getKnowledgeTags } from '@/lib/services/knowledge-brain';
import type { KnowledgeCategory, KnowledgeSpeaker } from '@/lib/types/content-pipeline';

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

    // Tags endpoint
    if (view === 'tags') {
      const tags = await getKnowledgeTags(session.user.id);
      return NextResponse.json({ tags });
    }

    // Semantic search
    if (query) {
      const result = await searchKnowledge(session.user.id, query, {
        category: category || undefined,
        tags: tag ? [tag] : undefined,
        limit: 20,
        threshold: 0.6,
      });
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }

      // Apply additional filters post-search
      let entries = result.entries;
      if (speaker) {
        entries = entries.filter((e) => e.speaker === speaker);
      }
      return NextResponse.json({ entries, total_count: entries.length });
    }

    // Filtered browse (any combination of category, speaker, tag)
    const hasFilters = category || speaker || tag;
    if (hasFilters) {
      const entries = await getFilteredKnowledge(session.user.id, {
        category: category || undefined,
        speaker: speaker || undefined,
        tag: tag || undefined,
        limit,
        offset,
      });
      return NextResponse.json({ entries, total_count: entries.length });
    }

    // Default: return recent entries across all categories
    const entries = await getAllRecentKnowledge(session.user.id, limit);
    return NextResponse.json({ entries, total_count: entries.length });
  } catch (error) {
    logError('cp/knowledge', error, { step: 'knowledge_api_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
