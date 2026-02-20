import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { generateAndCacheTopicSummary } from '@/lib/services/knowledge-brain';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { slug } = await params;
    const { searchParams } = request.nextUrl;
    const force = searchParams.get('force') === 'true';

    const result = await generateAndCacheTopicSummary(session.user.id, slug, force);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
