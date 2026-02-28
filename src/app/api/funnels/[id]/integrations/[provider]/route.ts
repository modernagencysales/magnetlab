import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, isValidUUID } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';

interface RouteParams {
  params: Promise<{ id: string; provider: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id: funnelPageId, provider } = await params;
    if (!isValidUUID(funnelPageId)) return ApiErrors.validationError('Invalid funnel page ID');

    await funnelsService.deleteFunnelIntegration(session.user.id, funnelPageId, provider);
    return NextResponse.json({ message: 'Integration removed' });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
