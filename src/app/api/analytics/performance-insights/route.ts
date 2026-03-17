/**
 * GET /api/analytics/performance-insights
 * Returns top archetypes, top lead magnets, and totals for a given period.
 * Phase 1 — aggregates from funnel_leads and page_views.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import { VALID_PERIODS, type Period } from '@/server/services/analytics.service';
import * as analyticsService from '@/server/services/analytics.service';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return ApiErrors.unauthorized();
  const userId = session.user.id;

  try {
    const url = new URL(request.url);
    const period = (url.searchParams.get('period') ?? 'last_30_days') as Period;
    if (!(VALID_PERIODS as readonly string[]).includes(period)) {
      return ApiErrors.validationError(
        `Invalid period "${period}". Must be one of: ${VALID_PERIODS.join(', ')}`
      );
    }

    const scope = await getDataScope(userId);
    const result = await analyticsService.getPerformanceInsights(scope, period);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('analytics/performance-insights', error, { userId });
    return ApiErrors.internalError('Failed to fetch performance insights');
  }
}
