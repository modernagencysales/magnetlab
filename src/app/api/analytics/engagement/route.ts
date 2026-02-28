import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as analyticsService from '@/server/services/analytics.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await analyticsService.getEngagement(session.user.id);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('analytics/engagement', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to fetch engagement analytics');
  }
}
