import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTopicDetail } from '@/lib/services/knowledge-brain';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const topic = searchParams.get('topic');
    const format = searchParams.get('format') || 'structured';

    if (!topic) {
      return NextResponse.json({ error: 'topic parameter is required' }, { status: 400 });
    }

    const detail = await getTopicDetail(session.user.id, topic);

    if (format === 'markdown') {
      const lines: string[] = [`# ${detail.topic?.display_name || topic}\n`];
      for (const [type, entries] of Object.entries(detail.top_entries)) {
        if (entries.length === 0) continue;
        lines.push(`## ${type} (${detail.type_breakdown[type] || entries.length})\n`);
        for (const entry of entries) {
          lines.push(`- ${entry.content}\n`);
        }
      }
      return NextResponse.json({ export: lines.join('\n'), format: 'markdown' });
    }

    const totalEntries = Object.values(detail.type_breakdown).reduce((s, n) => s + n, 0);

    return NextResponse.json({
      export: {
        topic: detail.topic,
        type_breakdown: detail.type_breakdown,
        top_entries: detail.top_entries,
        entry_count: totalEntries,
      },
      format: 'structured',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
