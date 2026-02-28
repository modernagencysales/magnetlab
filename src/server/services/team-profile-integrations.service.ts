/**
 * Team Profile Integrations Service
 * List team profiles with connection status (auth + getTeamProfilesWithConnections).
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { verifyTeamMembership, getTeamProfilesWithConnections } from '@/lib/services/team-integrations';

export async function listProfilesWithConnections(
  teamId: string,
  userId: string
): Promise<
  | { success: true; profiles: Awaited<ReturnType<typeof getTeamProfilesWithConnections>> }
  | { success: false; error: string; status: number }
> {
  const supabase = createSupabaseAdminClient();
  const memberCheck = await verifyTeamMembership(supabase, teamId, userId);
  if (!memberCheck.authorized) {
    return { success: false, error: memberCheck.error, status: memberCheck.status };
  }
  const profiles = await getTeamProfilesWithConnections(teamId);
  return { success: true, profiles };
}
