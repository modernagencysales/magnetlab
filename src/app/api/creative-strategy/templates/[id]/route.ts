/**
 * Creative Strategy Templates [id] Route — PATCH + DELETE.
 * Super-admin only. Delegates to cs-plays service.
 * Never contains business logic.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import { updateTemplateSchema } from '@/lib/validations/creative-strategy';
import * as playsService from '@/server/services/cs-plays.service';
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
  const parsed = updateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const template = await playsService.updateTemplate(id, parsed.data);
    return NextResponse.json(template);
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/templates/[id].PATCH', err);
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
    await playsService.deleteTemplate(id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/templates/[id].DELETE', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
