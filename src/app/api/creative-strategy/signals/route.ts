/**
 * Creative Strategy Signals Route — GET (list) + POST (submit).
 * Super-admin only. Delegates to cs-signals service.
 * Never contains business logic.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { submitSignalSchema } from '@/lib/validations/creative-strategy';
import * as signalsService from '@/server/services/cs-signals.service';
import { logError } from '@/lib/utils/logger';

import type { SignalFilters } from '@/lib/types/creative-strategy';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const filters: SignalFilters = {
    status: (url.searchParams.get('status') as SignalFilters['status']) ?? undefined,
    source: (url.searchParams.get('source') as SignalFilters['source']) ?? undefined,
    niche: url.searchParams.get('niche') ?? undefined,
    min_multiplier: url.searchParams.get('min_multiplier')
      ? Number(url.searchParams.get('min_multiplier'))
      : undefined,
    limit: url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined,
    offset: url.searchParams.get('offset') ? Number(url.searchParams.get('offset')) : undefined,
  };

  const result = await signalsService.listSignals(filters);
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
  const parsed = submitSignalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const signal = await signalsService.submitSignal(parsed.data, session.user.id);
    return NextResponse.json(signal, { status: 201 });
  } catch (err) {
    const status = signalsService.getStatusCode(err);
    logError('api/creative-strategy/signals.POST', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
