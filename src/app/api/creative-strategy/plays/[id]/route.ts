/**
 * Creative Strategy Plays [id] Route — GET + PATCH + DELETE.
 * GET: any authenticated user. PATCH/DELETE: super-admin only.
 * Delegates to cs-plays service. Never contains business logic.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { updatePlaySchema } from '@/lib/validations/creative-strategy';
import * as playsService from '@/server/services/cs-plays.service';
import { logError } from '@/lib/utils/logger';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const play = await playsService.getPlayById(id);
    if (!play) {
      return NextResponse.json({ error: 'Play not found' }, { status: 404 });
    }
    return NextResponse.json(play);
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/plays/[id].GET', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = updatePlaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const play = await playsService.updatePlay(id, parsed.data);
    return NextResponse.json(play);
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/plays/[id].PATCH', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  try {
    await playsService.deletePlay(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/plays/[id].DELETE', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
