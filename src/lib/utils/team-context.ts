import { cookies } from 'next/headers';
import { checkTeamRole } from '@/lib/auth/rbac';

export interface DataScope {
  type: 'user' | 'team';
  userId: string;
  teamId?: string;
}

/**
 * Get the current data scope based on session and team context.
 * If operating in a team context (via ml-team-context cookie),
 * verifies membership before returning a team scope.
 * Falls back to user scope if no team context or membership check fails.
 */
export async function getDataScope(userId: string): Promise<DataScope> {
  const cookieStore = await cookies();
  const teamId = cookieStore.get('ml-team-context')?.value;

  if (teamId) {
    const role = await checkTeamRole(userId, teamId);
    if (role) {
      return { type: 'team', userId, teamId };
    }
  }

  return { type: 'user', userId };
}
