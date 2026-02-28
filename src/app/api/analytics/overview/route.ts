import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import { VALID_RANGES, type Range } from '@/lib/utils/analytics-helpers';
import * as analyticsService from '@/server/services/analytics.service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const url = new URL(request.url);
    const rangeParam = url.searchParams.get('range') || '30d';
    if (!VALID_RANGES.includes(rangeParam as Range)) {
      return ApiErrors.validationError(
        `Invalid range "${rangeParam}". Must be one of: ${VALID_RANGES.join(', ')}`,
      );
    }

    const scope = await getDataScope(session.user.id);
    const result = await analyticsService.getOverview(scope, rangeParam as Range);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('analytics/overview', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to fetch analytics');
  }
}
