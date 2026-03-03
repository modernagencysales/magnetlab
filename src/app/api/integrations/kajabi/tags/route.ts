import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { KajabiClient } from '@/lib/integrations/kajabi/client';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const integration = await getUserIntegration(session.user.id, 'kajabi');
    if (!integration?.api_key || !integration.is_active) {
      return ApiErrors.notFound('Integration');
    }

    const siteId = (integration.metadata as { site_id?: string })?.site_id;
    if (!siteId) {
      return ApiErrors.notFound('Integration');
    }

    const client = new KajabiClient(integration.api_key, siteId);
    const tags = await client.listTags();

    return NextResponse.json({ tags });
  } catch (error) {
    logApiError('kajabi/tags', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to fetch tags'
    );
  }
}
