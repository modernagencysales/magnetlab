/**
 * Creative Strategy Play Assign Route — POST.
 * Super-admin only. Assigns a play to a user.
 * Delegates to cs-plays service. Never contains business logic.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as playsService from '@/server/services/cs-plays.service';
import { logError } from '@/lib/utils/logger';

const assignPlaySchema = z.object({
  user_id: z.string().min(1, 'user_id is required'),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!(await isSuperAdmin(session.user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const parsed = assignPlaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation error', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const assignment = await playsService.assignPlay(id, parsed.data.user_id, session.user.id);
    return NextResponse.json(assignment, { status: 201 });
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/plays/[id]/assign.POST', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
