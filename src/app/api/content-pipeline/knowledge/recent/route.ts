import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRecentKnowledgeDigest } from '@/lib/services/knowledge-brain';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const days = parseInt(searchParams.get('days') || '7', 10);

    const digest = await getRecentKnowledgeDigest(session.user.id, Math.min(days, 90));
    return NextResponse.json(digest);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
