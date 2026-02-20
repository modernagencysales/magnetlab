import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { exportTopicKnowledge, verifyTeamMembership } from '@/lib/services/knowledge-brain';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const topic = searchParams.get('topic');
    const format = searchParams.get('format') || 'structured';
    const teamId = searchParams.get('team_id') || undefined;

    if (teamId) {
      const isMember = await verifyTeamMembership(session.user.id, teamId);
      if (!isMember) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!topic) {
      return NextResponse.json({ error: 'topic parameter is required' }, { status: 400 });
    }

    const detail = await exportTopicKnowledge(session.user.id, topic, teamId);

    if (!detail.topic) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }

    if (format === 'markdown') {
      const lines: string[] = [`# ${detail.topic.display_name}\n`];
      for (const [type, entries] of Object.entries(detail.entries_by_type)) {
        if (entries.length === 0) continue;
        lines.push(`## ${type} (${entries.length})\n`);
        for (const entry of entries) {
          lines.push(`- ${entry.content}\n`);
        }
      }
      return NextResponse.json({ export: lines.join('\n'), format: 'markdown', total_count: detail.total_count });
    }

    return NextResponse.json({
      export: {
        topic: detail.topic,
        entries_by_type: detail.entries_by_type,
        total_count: detail.total_count,
      },
      format: 'structured',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
