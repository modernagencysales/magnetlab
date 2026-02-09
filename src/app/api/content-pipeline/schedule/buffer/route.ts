import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getBufferStatus, approvePost, rejectPost } from '@/lib/services/autopilot';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const buffer = await getBufferStatus(session.user.id);

    return NextResponse.json({ buffer });
  } catch (error) {
    console.error('Buffer fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { postId, action } = body;

    if (!postId || typeof postId !== 'string') {
      return NextResponse.json({ error: 'postId is required and must be a string' }, { status: 400 });
    }

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    if (action === 'approve') {
      await approvePost(session.user.id, postId);
      return NextResponse.json({ success: true, action: 'approved' });
    }

    if (action === 'reject') {
      await rejectPost(session.user.id, postId);
      return NextResponse.json({ success: true, action: 'rejected' });
    }

    return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
  } catch (error) {
    console.error('Buffer action error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
