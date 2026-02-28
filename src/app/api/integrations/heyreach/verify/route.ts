// HeyReach Verify API
// POST /api/integrations/heyreach/verify
// Re-validates stored API key against HeyReach

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { HeyReachClient } from '@/lib/integrations/heyreach/client';
import { getUserIntegration, updateIntegrationVerified } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Get stored credentials
    const integration = await getUserIntegration(session.user.id, 'heyreach');
    if (!integration?.api_key) {
      return ApiErrors.notFound('Integration');
    }

    // Validate API key against HeyReach
    const client = new HeyReachClient(integration.api_key);
    const verified = await client.testConnection();

    // Update verification timestamp on success
    if (verified) {
      await updateIntegrationVerified(session.user.id, 'heyreach');
    }

    return NextResponse.json({ verified });
  } catch (error) {
    logApiError('heyreach/verify', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to verify connection'
    );
  }
}
