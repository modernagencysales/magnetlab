import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as analyticsService from '@/server/services/analytics.service';

const VALID_RANGES = ['7d', '30d', '90d'];

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const url = new URL(request.url);
    const rangeParam = url.searchParams.get('range') || '30d';
    if (!VALID_RANGES.includes(rangeParam)) {
      return ApiErrors.validationError(
        `Invalid range "${rangeParam}". Must be one of: ${VALID_RANGES.join(', ')}`,
      );
    }

    const result = await analyticsService.getEmailAnalytics(session.user.id, rangeParam);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('analytics/email', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to fetch email analytics');
  }
}
