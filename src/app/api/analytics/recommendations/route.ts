/**
 * GET /api/analytics/recommendations
 * Phase 1 stub: combines knowledge topics and performance data to generate
 * basic improvement suggestions. Full ML intelligence arrives in Phase 4.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import * as analyticsService from '@/server/services/analytics.service';

export async function GET(_request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);
    const result = await analyticsService.getRecommendations(scope);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('analytics/recommendations', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to fetch recommendations');
  }
}
