/**
 * Creative Strategy Signals [id] Route — PATCH (review).
 * Super-admin only. Delegates to cs-signals service.
 * Never contains business logic.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { updateSignalSchema } from '@/lib/validations/creative-strategy';
import * as signalsService from '@/server/services/cs-signals.service';
import { logError } from '@/lib/utils/logger';

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
  const parsed = updateSignalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const signal = await signalsService.reviewSignal(id, parsed.data.status);
    return NextResponse.json(signal);
  } catch (err) {
    const status = signalsService.getStatusCode(err);
    logError('api/creative-strategy/signals/[id].PATCH', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
