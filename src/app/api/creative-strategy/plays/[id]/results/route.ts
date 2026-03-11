/**
 * Creative Strategy Play Results Route — GET.
 * Any authenticated user can view results.
 * Delegates to cs-plays service. Never contains business logic.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import * as playsService from '@/server/services/cs-plays.service';
import { logError } from '@/lib/utils/logger';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const results = await playsService.getPlayResults(id);
    return NextResponse.json(results);
  } catch (err) {
    const status = playsService.getStatusCode(err);
    logError('api/creative-strategy/plays/[id]/results.GET', err);
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
}
