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

    const contacts = await service.listContacts(session.user.id, filters);
    return NextResponse.json({ contacts });
  } catch (err) {
    logError('api/dm-coach/GET', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: service.getStatusCode(err) }
    );
  }
}

// ─── POST — create contact ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const contact = await service.createContact(session.user.id, null, body);
    return NextResponse.json({ contact }, { status: 201 });
  } catch (err) {
    logError('api/dm-coach/POST', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: service.getStatusCode(err) }
    );
  }
}
