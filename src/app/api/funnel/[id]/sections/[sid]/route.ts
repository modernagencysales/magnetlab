import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';

interface RouteParams {
  params: Promise<{ id: string; sid: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id, sid } = await params;
    const body = await request.json();
    const scope = await getDataScope(session.user.id);
    const section = await funnelsService.updateSection(scope, id, sid, body);
    return NextResponse.json({ section });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id, sid } = await params;
    const scope = await getDataScope(session.user.id);
    await funnelsService.deleteSection(scope, id, sid);
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
