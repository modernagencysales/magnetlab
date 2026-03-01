import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors } from '@/lib/api/errors';
import * as funnelsService from '@/server/services/funnels.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const scope = await getDataScope(session.user.id);
    const { questions, error } = await funnelsService.getQuestions(scope, id);
    if (error) return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    return NextResponse.json({ questions });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const body = await request.json();
    const scope = await getDataScope(session.user.id);
    const question = await funnelsService.createQuestion(scope, id, body);
    return NextResponse.json({ question }, { status: 201 });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const body = await request.json();
    if (!body.questionIds || !Array.isArray(body.questionIds)) {
      return ApiErrors.validationError('questionIds array is required');
    }

    const scope = await getDataScope(session.user.id);
    await funnelsService.reorderQuestions(scope, id, body.questionIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = funnelsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
