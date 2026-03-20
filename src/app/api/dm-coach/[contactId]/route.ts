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
    const result = await service.getContactWithMessages(session.user.id, contactId);

    if (!result.success) {
      if (result.error === 'not_found')
        return NextResponse.json({ error: result.message }, { status: 404 });
      if (result.error === 'database')
        return NextResponse.json({ error: result.message }, { status: 500 });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(result.data);
  } catch (err) {
    logError('api/dm-coach/[contactId]/GET', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH — update contact ─────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { contactId } = await params;
    const body = await req.json();
    const result = await service.updateContact(session.user.id, contactId, body);

    if (!result.success) {
      if (result.error === 'not_found')
        return NextResponse.json({ error: result.message }, { status: 404 });
      if (result.error === 'validation')
        return NextResponse.json({ error: result.message }, { status: 400 });
      if (result.error === 'database')
        return NextResponse.json({ error: result.message }, { status: 500 });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ contact: result.data });
  } catch (err) {
    logError('api/dm-coach/[contactId]/PATCH', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE — delete contact ────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { contactId } = await params;
    const result = await service.deleteContact(session.user.id, contactId);

    if (!result.success) {
      if (result.error === 'not_found')
        return NextResponse.json({ error: result.message }, { status: 404 });
      if (result.error === 'database')
        return NextResponse.json({ error: result.message }, { status: 500 });
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json({ deleted: true });
  } catch (err) {
    logError('api/dm-coach/[contactId]/DELETE', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
