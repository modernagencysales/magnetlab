import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as keysService from '@/server/services/keys.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const name = body.name?.trim();
    if (!name || name.length > 100) {
      return ApiErrors.validationError('name is required (max 100 chars)');
    }

    const result = await keysService.createKey(session.user.id, name);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logApiError('keys/create', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to create API key');
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await keysService.listKeys(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('keys/list', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to list API keys');
  }
}
