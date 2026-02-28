import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, isValidUUID } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid funnel page ID');

    const body = await request.json();
    const { publish } = body;
    if (typeof publish !== 'boolean') return ApiErrors.validationError('publish must be a boolean');

    const scope = await getDataScope(session.user.id);
    const result = await funnelsService.publishFunnel(scope, id, publish);
    return NextResponse.json(result);
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
