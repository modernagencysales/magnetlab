import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KajabiClient } from '@/lib/integrations/kajabi/client';
import { getUserIntegration, updateIntegrationVerified } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const integration = await getUserIntegration(session.user.id, 'kajabi');
    if (!integration?.api_key) {
      return ApiErrors.notFound('Integration');
    }

    const siteId = (integration.metadata as { site_id?: string })?.site_id;
    if (!siteId) {
      return ApiErrors.notFound('Integration');
    }

    const client = new KajabiClient(integration.api_key, siteId);
    const verified = await client.testConnection();

    if (verified) {
      await updateIntegrationVerified(session.user.id, 'kajabi');
    }

    return NextResponse.json({ verified });
  } catch (error) {
    logApiError('kajabi/verify', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to verify connection'
    );
  }
}
