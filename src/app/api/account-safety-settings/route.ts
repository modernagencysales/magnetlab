/**
 * GET /api/account-safety-settings
 * Returns all account safety settings for the authenticated user.
 */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as safetyService from '@/server/services/account-safety.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const settings = await safetyService.getAllAccountSettings(session.user.id);
    return NextResponse.json({ settings });
  } catch (error) {
    logApiError('account-safety-settings/GET', error);
    return ApiErrors.internalError('Failed to fetch account safety settings');
  }
}
