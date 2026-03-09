// Kajabi Status API
// GET /api/integrations/kajabi/status
// Returns whether the user has an active Kajabi connection

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

    const integration = await getUserIntegration(session.user.id, 'kajabi');
    const connected = !!(integration?.api_key && integration?.is_active);

    return NextResponse.json({ connected });
  } catch (error) {
    logApiError('kajabi/status', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to check connection status'
    );
  }
}
