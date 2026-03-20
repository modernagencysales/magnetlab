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
    const result = await service.getSuggestion(session.user.id, contactId);

    if (!result.success) {
      if (result.error === 'not_found')
        return NextResponse.json({ error: result.message }, { status: 404 });
      if (result.error === 'validation')
        return NextResponse.json({ error: result.message }, { status: 400 });
      if (result.error === 'database')
        return NextResponse.json({ error: result.message }, { status: 500 });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ suggestion: result.data }, { status: 201 });
  } catch (err) {
    logError('api/dm-coach/[contactId]/suggest/POST', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
