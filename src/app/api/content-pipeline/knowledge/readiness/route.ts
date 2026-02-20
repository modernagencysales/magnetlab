import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { assessReadiness, type ReadinessGoal } from '@/lib/ai/content-pipeline/knowledge-readiness';

const VALID_GOALS: ReadinessGoal[] = ['lead_magnet', 'blog_post', 'course', 'sop', 'content_week'];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const topic = searchParams.get('topic');
    const goal = searchParams.get('goal') as ReadinessGoal | null;

    if (!topic) {
      return NextResponse.json({ error: 'topic parameter is required' }, { status: 400 });
    }

    if (!goal || !VALID_GOALS.includes(goal)) {
      return NextResponse.json(
        { error: `goal must be one of: ${VALID_GOALS.join(', ')}` },
        { status: 400 }
      );
    }

    const readiness = await assessReadiness(session.user.id, topic, goal);
    return NextResponse.json({ readiness });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
