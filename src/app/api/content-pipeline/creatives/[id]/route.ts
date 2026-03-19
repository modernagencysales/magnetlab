/**
 * Content Pipeline — Single Creative Route
 * GET    /api/content-pipeline/creatives/:id — fetch one creative
 * PATCH  /api/content-pipeline/creatives/:id — update status or image_url
 * DELETE /api/content-pipeline/creatives/:id — remove creative
 * Never contains business logic; delegates to creativesService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { UpdateCreativeSchema } from '@/lib/validations/exploits';
import { formatZodError } from '@/lib/validations/api';
import * as creativesService from '@/server/services/creatives.service';

// ─── GET handler ─────────────────────────────────────────────────────────────

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const creative = await creativesService.getCreativeById(session.user.id, id);

    if (!creative) {
      return NextResponse.json({ error: 'Creative not found' }, { status: 404 });
    }

    return NextResponse.json({ creative });
  } catch (error) {
    logError('cp/creatives', error, { step: 'creative_fetch_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH handler ───────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const rawBody = await request.json();
    const parsed = UpdateCreativeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const creative = await creativesService.updateCreative(session.user.id, id, parsed.data);

    if (!creative) {
      return NextResponse.json({ error: 'Creative not found' }, { status: 404 });
    }

    return NextResponse.json({ creative });
  } catch (error) {
    logError('cp/creatives', error, { step: 'creative_update_error' });
    return NextResponse.json(
      {
        error:
          creativesService.getStatusCode(error) < 500
            ? (error as Error).message
            : 'Internal server error',
      },
      { status: creativesService.getStatusCode(error) }
    );
  }
}

// ─── DELETE handler ──────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const deleted = await creativesService.deleteCreative(session.user.id, id);

    if (!deleted) {
      return NextResponse.json({ error: 'Creative not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('cp/creatives', error, { step: 'creative_delete_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
