import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const scope = await getDataScope(session.user.id);
    const leadMagnet = await leadMagnetsService.getLeadMagnetById(scope, id);
    if (!leadMagnet) return ApiErrors.notFound('Lead magnet');
    return NextResponse.json(leadMagnet);
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const body = await request.json();
    const scope = await getDataScope(session.user.id);
    const data = await leadMagnetsService.updateLeadMagnet(scope, id, body);
    return NextResponse.json(data);
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const scope = await getDataScope(session.user.id);
    await leadMagnetsService.deleteLeadMagnet(scope, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
