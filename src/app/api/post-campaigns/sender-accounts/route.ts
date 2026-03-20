/** Sender Accounts. Lists team profiles with connected LinkedIn (Unipile) accounts.
 *  Never contains business logic — reads from team-integrations service. */

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getTeamProfilesWithConnections } from '@/lib/services/team-integrations';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const scope = await getDataScope(session.user.id);

    // Personal scope — no team profiles to list
    if (scope.type !== 'team' || !scope.teamId) {
      return NextResponse.json({ accounts: [] });
    }

    const profiles = await getTeamProfilesWithConnections(scope.teamId);
    const accounts = profiles
      .filter((p) => p.linkedin_connected && p.unipile_account_id)
      .map((p) => ({
        team_profile_id: p.id,
        name: p.full_name || '',
        unipile_account_id: p.unipile_account_id,
      }));

    return NextResponse.json({ accounts });
  } catch (error) {
    logApiError('post-campaigns/sender-accounts', error);
    return ApiErrors.internalError('Failed to list sender accounts');
  }
}
