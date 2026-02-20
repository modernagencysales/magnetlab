import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { listKnowledgeTopics, getTopicDetail } from '@/lib/services/knowledge-brain';
import { analyzeTopicGaps } from '@/lib/ai/content-pipeline/knowledge-gap-analyzer';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const topics = await listKnowledgeTopics(session.user.id, { limit: 50 });

    const gaps = await Promise.all(
      topics.map(async (topic) => {
        const detail = await getTopicDetail(session.user.id, topic.slug);
        return analyzeTopicGaps(
          topic.slug,
          topic.display_name,
          detail.type_breakdown,
          topic.avg_quality,
          topic.last_seen
        );
      })
    );

    // Sort by coverage score ascending (worst gaps first)
    gaps.sort((a, b) => a.coverage_score - b.coverage_score);

    return NextResponse.json({ gaps, total_topics: topics.length });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
