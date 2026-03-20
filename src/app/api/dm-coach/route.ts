/** DM Coach Contacts — List + Create. Thin route layer; validation in service. */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as service from '@/server/services/dm-coach.service';
import { logError } from '@/lib/utils/logger';

import type { ContactStatus, ConversationGoal } from '@/lib/types/dm-coach';

// ─── GET — list contacts ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const filters = {
      status: (searchParams.get('status') as ContactStatus) || undefined,
      goal: (searchParams.get('goal') as ConversationGoal) || undefined,
      search: searchParams.get('search') || undefined,
    };

    const result = await service.listContacts(session.user.id, filters);

    if (!result.success) {
      if (result.error === 'database')
        return NextResponse.json({ error: result.message }, { status: 500 });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ contacts: result.data });
  } catch (err) {
    logError('api/dm-coach/GET', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST — create contact ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const result = await service.createContact(session.user.id, null, body);

    if (!result.success) {
      if (result.error === 'validation')
        return NextResponse.json({ error: result.message }, { status: 400 });
      if (result.error === 'database')
        return NextResponse.json({ error: result.message }, { status: 500 });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ contact: result.data }, { status: 201 });
  } catch (err) {
    logError('api/dm-coach/POST', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
