import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const stats = await funnelsService.getFunnelStats(scope, session.user.id);
    return NextResponse.json({ stats });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
