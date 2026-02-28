// HeyReach Status API
// GET /api/integrations/heyreach/status
// Returns whether the user has an active HeyReach connection

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const integration = await getUserIntegration(session.user.id, 'heyreach');
    const connected = !!(integration?.api_key && integration?.is_active);

    return NextResponse.json({ connected });
  } catch (error) {
    logApiError('heyreach/status', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to check connection status'
    );
  }
}
