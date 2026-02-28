import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, isValidUUID } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid lead magnet ID');

    const body = await request.json();
    const scope = await getDataScope(session.user.id);
    const result = await leadMagnetsService.updatePolishedContent(scope, id, body);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
