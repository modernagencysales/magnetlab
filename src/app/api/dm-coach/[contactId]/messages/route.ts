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
    const result = await service.addMessages(session.user.id, contactId, body);

    if (!result.success) {
      if (result.error === 'not_found')
        return NextResponse.json({ error: result.message }, { status: 404 });
      if (result.error === 'validation')
        return NextResponse.json({ error: result.message }, { status: 400 });
      if (result.error === 'database')
        return NextResponse.json({ error: result.message }, { status: 500 });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ messages: result.data }, { status: 201 });
  } catch (err) {
    logError('api/dm-coach/[contactId]/messages/POST', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
