/** DM Coach Messages — Add messages to a contact conversation. */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as service from '@/server/services/dm-coach.service';
import { logError } from '@/lib/utils/logger';

// ─── POST — add messages ────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { contactId } = await params;
    const body = await req.json();
    const messages = await service.addMessages(session.user.id, contactId, body);
    return NextResponse.json({ messages }, { status: 201 });
  } catch (err) {
    logError('api/dm-coach/[contactId]/messages/POST', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: service.getStatusCode(err) }
    );
  }
}
