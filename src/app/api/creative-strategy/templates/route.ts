/**
 * Creative Strategy Templates Route — GET (list by play_id) + POST (create).
 * Super-admin only. Delegates to cs-plays service.
 * Never contains business logic.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { createTemplateSchema } from '@/lib/validations/creative-strategy';
import * as playsService from '@/server/services/cs-plays.service';
import { logError } from '@/lib/utils/logger';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const playId = url.searchParams.get('play_id');
  if (!playId) {
    return NextResponse.json({ error: 'play_id query parameter is required' }, { status: 400 });
  }

  try {
    const templates = await playsService.getTemplatesByPlayId(playId);
    return NextResponse.json(templates);
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/templates.GET', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
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
  const parsed = createTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const template = await playsService.createTemplate(parsed.data);
    return NextResponse.json(template, { status: 201 });
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/templates.POST', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
