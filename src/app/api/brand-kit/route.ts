// API Route: Brand Kit CRUD
// GET /api/brand-kit — get; POST /api/brand-kit — create/update

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import * as brandKitService from '@/server/services/brand-kit.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const result = await brandKitService.getBrandKit(scope);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('brand-kit/get', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError('Failed to fetch brand kit');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const scope = await getDataScope(session.user.id);
    const payload = brandKitService.buildBrandKitPayload(session.user.id, scope, body);
    const data = await brandKitService.upsertBrandKit(scope, payload);
    return NextResponse.json(data);
  } catch (error) {
    logApiError('brand-kit/save', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError('Failed to save brand kit');
  }
}
