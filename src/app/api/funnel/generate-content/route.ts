import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { leadMagnetId, useAI = true } = body;
    if (!leadMagnetId) return ApiErrors.validationError('leadMagnetId is required');

    const scope = await getDataScope(session.user.id);
    const content = await funnelsService.generateFunnelContent(scope, leadMagnetId, useAI);
    return NextResponse.json({ content });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
