import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { deleteUserIntegration, getUserIntegration } from '@/lib/utils/encrypted-storage';
import { getUnipileClient, isUnipileConfigured } from '@/lib/integrations/unipile';

import { logError, logWarn } from '@/lib/utils/logger';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Try to disconnect the account from Unipile too
    if (isUnipileConfigured()) {
      const integration = await getUserIntegration(session.user.id, 'unipile');
      const accountId = (integration?.metadata as Record<string, unknown>)?.unipile_account_id;
      if (typeof accountId === 'string') {
        try {
          const client = getUnipileClient();
          await client.deleteAccount(accountId);
        } catch (e) {
          // Non-critical — account may already be removed
          logWarn('api/linkedin', 'Failed to delete Unipile account (non-critical)', { detail: String(e) });
        }
      }
    }

    await deleteUserIntegration(session.user.id, 'unipile');
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('api/linkedin', error, { step: 'linkedin_disconnect_error' });
    return NextResponse.json(
      { error: 'Failed to disconnect' },
      { status: 500 }
    );
  }
}
