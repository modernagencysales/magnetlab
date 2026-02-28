import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import * as catalogService from '@/server/services/catalog.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const result = await catalogService.getCatalog(session.user.id, scope);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('catalog-list', error, { userId: (await auth())?.user?.id });
    return ApiErrors.databaseError();
  }
}
