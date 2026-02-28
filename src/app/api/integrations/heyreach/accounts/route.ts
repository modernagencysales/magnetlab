// HeyReach Accounts API
// GET /api/integrations/heyreach/accounts
// Lists all LinkedIn accounts connected to HeyReach

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

    // Fetch LinkedIn accounts from HeyReach
    const client = new HeyReachClient(integration.api_key);
    const result = await client.listLinkedInAccounts();

    if (result.error) {
      return ApiErrors.internalError(result.error);
    }

    return NextResponse.json({
      accounts: result.accounts,
    });
  } catch (error) {
    logApiError('heyreach/accounts', error);
    return ApiErrors.internalError(
      error instanceof Error ? error.message : 'Failed to fetch LinkedIn accounts'
    );
  }
}
