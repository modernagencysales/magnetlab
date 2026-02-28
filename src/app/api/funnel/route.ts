import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, isValidUUID } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { searchParams } = new URL(request.url);
    const leadMagnetId = searchParams.get('leadMagnetId') ?? undefined;
    const libraryId = searchParams.get('libraryId') ?? undefined;
    const externalResourceId = searchParams.get('externalResourceId') ?? undefined;

    if (!leadMagnetId && !libraryId && !externalResourceId) {
      return ApiErrors.validationError('One of leadMagnetId, libraryId, or externalResourceId is required');
    }
    if (leadMagnetId && !isValidUUID(leadMagnetId)) return ApiErrors.validationError('Invalid leadMagnetId');
    if (libraryId && !isValidUUID(libraryId)) return ApiErrors.validationError('Invalid libraryId');
    if (externalResourceId && !isValidUUID(externalResourceId)) return ApiErrors.validationError('Invalid externalResourceId');

    const scope = await getDataScope(session.user.id);
    const funnel = await funnelsService.getFunnelByTarget(scope, { leadMagnetId, libraryId, externalResourceId });
    return NextResponse.json({ funnel });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const body = await request.json();
    const funnel = await funnelsService.createFunnel(scope, body);
    return NextResponse.json({ funnel }, { status: 201 });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
