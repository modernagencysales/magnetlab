import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getScopeForResource } from '@/lib/utils/team-context';
import { ApiErrors } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';
import { getFunnelTeamId } from '@/server/repositories/funnels.repo';

interface RouteParams {
  params: Promise<{ id: string; qid: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id, qid } = await params;
    const body = await request.json();
    const teamId = await getFunnelTeamId(id);
    const scope = await getScopeForResource(session.user.id, teamId);
    const question = await funnelsService.updateQuestion(scope, id, qid, body);
    return NextResponse.json({ question });
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

    const { id, qid } = await params;
    const teamId = await getFunnelTeamId(id);
    const scope = await getScopeForResource(session.user.id, teamId);
    await funnelsService.deleteQuestion(scope, id, qid);
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
