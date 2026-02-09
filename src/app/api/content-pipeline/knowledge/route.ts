import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { searchKnowledge, getKnowledgeByCategory, getKnowledgeTags } from '@/lib/services/knowledge-brain';
import type { KnowledgeCategory } from '@/lib/types/content-pipeline';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const query = searchParams.get('q');
    const category = searchParams.get('category') as KnowledgeCategory | null;
    const view = searchParams.get('view'); // 'tags' for tag list

    // Tags endpoint
    if (view === 'tags') {
      const tags = await getKnowledgeTags(session.user.id);
      return NextResponse.json({ tags });
    }

    // Semantic search
    if (query) {
      const entries = await searchKnowledge(session.user.id, query, {
        category: category || undefined,
        limit: 20,
        threshold: 0.6,
      });
      return NextResponse.json({ entries, total_count: entries.length });
    }

    // Browse by category
    if (category) {
      const entries = await getKnowledgeByCategory(session.user.id, category);
      return NextResponse.json({ entries, total_count: entries.length });
    }

    // Default: return recent entries
    const entries = await getKnowledgeByCategory(session.user.id, 'insight', 30);
    return NextResponse.json({ entries, total_count: entries.length });
  } catch (error) {
    console.error('Knowledge API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
