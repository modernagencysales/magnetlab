import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as externalResourcesService from '@/server/services/external-resources.service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await externalResourcesService.list(session.user.id, limit, offset);
    const response = NextResponse.json(result);
    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    logApiError('external-resources/list', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to fetch external resources');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { title, url, icon } = body;

    if (!title?.trim()) return ApiErrors.validationError('title is required');
    if (!url?.trim()) return ApiErrors.validationError('url is required');
    try {
      new URL(url);
    } catch {
      return ApiErrors.validationError('url must be a valid URL');
    }

    const result = await externalResourcesService.create(session.user.id, {
      title: title.trim(),
      url: url.trim(),
      icon,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logApiError('external-resources/create', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to create external resource');
  }
}
