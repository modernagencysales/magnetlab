/** DM Coach Contact — Get, Update, Delete. Thin route layer; validation in service. */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as service from '@/server/services/dm-coach.service';
import { logError } from '@/lib/utils/logger';

type Params = { params: Promise<{ contactId: string }> };

// ─── GET — get contact with messages ────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { contactId } = await params;
    const { messages, latest_suggestion, ...contact } = await service.getContactWithMessages(
      session.user.id,
      contactId
    );
    return NextResponse.json({ contact, messages, latest_suggestion });
  } catch (err) {
    logError('api/dm-coach/[contactId]/GET', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: service.getStatusCode(err) }
    );
  }
}

// ─── PATCH — update contact ─────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { contactId } = await params;
    const body = await req.json();
    const contact = await service.updateContact(session.user.id, contactId, body);
    return NextResponse.json({ contact });
  } catch (err) {
    logError('api/dm-coach/[contactId]/PATCH', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: service.getStatusCode(err) }
    );
  }
}

// ─── DELETE — delete contact ────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { contactId } = await params;
    await service.deleteContact(session.user.id, contactId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    logError('api/dm-coach/[contactId]/DELETE', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: service.getStatusCode(err) }
    );
  }
}
