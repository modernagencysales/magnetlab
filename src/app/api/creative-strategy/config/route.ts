/**
 * Creative Strategy Config Route — GET (list configs) + PUT (upsert config).
 * Super-admin only. Delegates to cs-signals service.
 * Never contains business logic.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { scrapeConfigSchema } from '@/lib/validations/creative-strategy';
import * as signalsService from '@/server/services/cs-signals.service';
import { logError } from '@/lib/utils/logger';

export async function GET(_request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const configs = await signalsService.listScrapeConfigs();
    return NextResponse.json(configs);
  } catch (err) {
    const status = signalsService.getStatusCode(err);
    logError('api/creative-strategy/config.GET', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}

export async function PUT(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = scrapeConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const config = await signalsService.updateScrapeConfig(parsed.data);
    return NextResponse.json(config);
  } catch (err) {
    const status = signalsService.getStatusCode(err);
    logError('api/creative-strategy/config.PUT', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
