/** DM Coach Suggest — Generate AI coaching suggestion for a contact. */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as service from '@/server/services/dm-coach.service';
import { logError } from '@/lib/utils/logger';

// ─── POST — get AI suggestion ───────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { contactId } = await params;
    const suggestion = await service.getSuggestion(session.user.id, contactId);
    return NextResponse.json({ suggestion }, { status: 201 });
  } catch (err) {
    logError('api/dm-coach/[contactId]/suggest/POST', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: service.getStatusCode(err) }
    );
  }
}
