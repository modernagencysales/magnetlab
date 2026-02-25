// GoHighLevel Verify API
// POST /api/integrations/gohighlevel/verify
// Re-validates stored API key against GHL

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { GoHighLevelClient } from '@/lib/integrations/gohighlevel/client';
import { getUserIntegration, updateIntegrationVerified } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Get stored credentials
    const integration = await getUserIntegration(session.user.id, 'gohighlevel');
    if (!integration?.api_key) {
      return ApiErrors.notFound('Integration');
    }

    // Validate API key against GoHighLevel
    const client = new GoHighLevelClient(integration.api_key);
    const verified = await client.testConnection();

    // Update verification timestamp on success
    if (verified) {
      await updateIntegrationVerified(session.user.id, 'gohighlevel');
    }

    return NextResponse.json({ verified });
  } catch (error) {
    logApiError('gohighlevel/verify', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to verify connection'
    );
  }
}
