/** DM Coach — Mark suggestion as used (with optional edited response). */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as service from '@/server/services/dm-coach.service';
import { logError } from '@/lib/utils/logger';

// ─── POST — mark suggestion used ────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ contactId: string; suggestionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { suggestionId } = await params;
    const body = await req.json().catch(() => ({}));
    const result = await service.markSuggestionUsed(
      session.user.id,
      suggestionId,
      body.edited_response
    );

    if (!result.success) {
      if (result.error === 'not_found')
        return NextResponse.json({ error: result.message }, { status: 404 });
      if (result.error === 'validation')
        return NextResponse.json({ error: result.message }, { status: 400 });
      if (result.error === 'database')
        return NextResponse.json({ error: result.message }, { status: 500 });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ suggestion: result.data });
  } catch (err) {
    logError('api/dm-coach/suggestions/[suggestionId]/use/POST', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
