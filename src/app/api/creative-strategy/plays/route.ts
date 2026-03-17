/**
 * Creative Strategy Plays Route — GET (list) + POST (create).
 * GET: admin sees all; non-admin sees public+proven/declining if data sharing enabled.
 * POST: super-admin only. Delegates to cs-plays service.
 * Never contains business logic.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { createPlaySchema } from '@/lib/validations/creative-strategy';
import * as playsService from '@/server/services/cs-plays.service';
import { logError } from '@/lib/utils/logger';

import type { PlayFilters } from '@/lib/types/creative-strategy';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const isAdmin = await isSuperAdmin(session.user.id);

  const filters: PlayFilters = {
    status: (url.searchParams.get('status') as PlayFilters['status']) ?? undefined,
    exploit_type:
      (url.searchParams.get('exploit_type') as PlayFilters['exploit_type']) ?? undefined,
    niche: url.searchParams.get('niche') ?? undefined,
    limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
    offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
  };

  if (!isAdmin) {
    filters.visibility = 'public';
  }

  const result = await playsService.listPlays(filters);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createPlaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const play = await playsService.createPlay(parsed.data, session.user.id);
    return NextResponse.json(play, { status: 201 });
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/plays.POST', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
