import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as qualificationFormsService from '@/server/services/qualification-forms.service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await qualificationFormsService.listForms(session.user.id, limit, offset);
    const response = NextResponse.json(result);
    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    logApiError('qualification-forms/list', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError('Failed to fetch forms');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const name = body.name;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return ApiErrors.validationError('name is required');
    }

    const result = await qualificationFormsService.createForm(session.user.id, name);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logApiError('qualification-forms/create', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError('Failed to create form');
  }
}
