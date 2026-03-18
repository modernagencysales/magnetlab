/**
 * RBAC (Role-Based Access Control).
 * Backward-compatible wrapper around hasTeamAccess from team.repo.
 * checkTeamRole is kept for existing callers that haven't migrated yet.
 * New code should use hasTeamAccess() directly.
 */

import { hasTeamAccess } from '@/server/repositories/team.repo';

export type TeamRole = 'owner' | 'member' | null;

/**
 * Check a user's role in a specific team.
 * Delegates to hasTeamAccess() which handles direct membership AND agency team links.
 * Returns 'owner' if the user owns the team, 'member' if they are an active
 * member (direct or via team link), or null if they have no access.
 */
export async function checkTeamRole(userId: string, teamId: string): Promise<TeamRole> {
  const result = await hasTeamAccess(userId, teamId);
  if (!result.access) return null;
  return result.role;
}

/**
 * Check whether a role meets the minimum required level.
 * Role hierarchy: owner > member > null
 */
export function hasMinimumRole(actual: TeamRole, required: 'owner' | 'member'): boolean {
  if (!actual) return false;
  if (required === 'member') return true; // owner or member both pass
  return actual === 'owner';
}
