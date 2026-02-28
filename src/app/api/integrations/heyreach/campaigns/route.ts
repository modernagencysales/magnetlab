// HeyReach Campaigns API
// GET /api/integrations/heyreach/campaigns
// Lists all HeyReach campaigns for the connected account

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { HeyReachClient } from '@/lib/integrations/heyreach/client';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { ApiErrors, logApiError } from '@/lib/api/errors';

export async function GET() {
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

    // Fetch campaigns from HeyReach
    const client = new HeyReachClient(integration.api_key);
    const result = await client.listCampaigns({ limit: 100 });

    if (result.error) {
      return ApiErrors.internalError(result.error);
    }

    return NextResponse.json({
      campaigns: result.campaigns,
      total: result.total,
    });
  } catch (error) {
    logApiError('heyreach/campaigns', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to fetch campaigns'
    );
  }
}
