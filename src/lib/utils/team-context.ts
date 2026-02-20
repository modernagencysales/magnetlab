import { cookies, headers } from 'next/headers';
import { checkTeamRole } from '@/lib/auth/rbac';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logWarn } from '@/lib/utils/logger';

export interface DataScope {
  type: 'user' | 'team';
  userId: string;       // Always the logged-in user
  teamId?: string;      // Set when in team context
  ownerId?: string;     // Team owner's user_id (for billing lookups)
}

/**
 * Get the current data scope based on session and team context.
 * The ml-team-context cookie now stores a **team ID** directly.
 * For API key requests (no cookies), falls back to the user's team membership.
 * Falls back to user scope if no team context or membership check fails.
 */
export async function getDataScope(userId: string): Promise<DataScope> {
  const cookieStore = await cookies();
  const contextTeamId = cookieStore.get('ml-team-context')?.value;

  if (contextTeamId) {
    const supabase = createSupabaseAdminClient();
    const { data: team } = await supabase
      .from('teams')
      .select('id, owner_id')
      .eq('id', contextTeamId)
      .single();

    if (team) {
      const role = await checkTeamRole(userId, team.id);
      if (role) {
        return { type: 'team', userId, teamId: team.id, ownerId: team.owner_id };
      }
    }
  }

  // For API key requests (no cookie mechanism), resolve team from membership.
  // Browser requests without the cookie mean the user chose personal mode,
  // but API key requests never have cookies — so we fall back to their team.
  if (!contextTeamId) {
    let isApiKeyRequest = false;
    try {
      const headerList = await headers();
      isApiKeyRequest = !!headerList.get('authorization')?.startsWith('Bearer ml_live_');
    } catch {
      // headers() can throw outside request context (build, static gen)
    }

    if (isApiKeyRequest) {
      try {
        const scope = await resolveTeamForApiKey(userId);
        if (scope) return scope;
      } catch (err) {
        logWarn('getDataScope', 'Failed to resolve team for API key', { userId, error: err });
      }
    }
  }

  return { type: 'user', userId };
}

/**
 * Get team scope, falling back to team ownership/membership lookup if no
 * team context cookie is set. Use this for features that require a team
 * (e.g. email system) — it ensures users who own or belong to a team
 * always resolve to team mode, even without the ml-team-context cookie.
 * Returns null if the user truly has no team.
 */
export async function requireTeamScope(userId: string): Promise<DataScope | null> {
  const scope = await getDataScope(userId);
  if (scope.type === 'team' && scope.teamId) return scope;

  // Cookie didn't resolve — try membership lookup (same logic as API key path)
  const resolved = await resolveTeamForApiKey(userId);
  return resolved;
}

/**
 * Resolve team context for an API key user by checking membership tables.
 * Priority: owned team → V2 team_profiles → V1 team_members.
 * Returns null if user has no team membership.
 */
async function resolveTeamForApiKey(userId: string): Promise<DataScope | null> {
  const supabase = createSupabaseAdminClient();

  // 1. Check if user owns a team (maybeSingle returns null for 0 rows)
  const { data: ownedTeam, error: ownedErr } = await supabase
    .from('teams')
    .select('id, owner_id')
    .eq('owner_id', userId)
    .limit(1)
    .maybeSingle();

  if (ownedErr) {
    logWarn('getDataScope', 'Owned team lookup failed', { userId, error: ownedErr });
  } else if (ownedTeam) {
    return { type: 'team', userId, teamId: ownedTeam.id, ownerId: ownedTeam.owner_id };
  }

  // 2. Check team_profiles (V2 membership)
  const { data: v2Profile, error: v2Err } = await supabase
    .from('team_profiles')
    .select('team_id, teams!inner(id, owner_id)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (v2Err) {
    logWarn('getDataScope', 'V2 team_profiles lookup failed', { userId, error: v2Err });
  } else if (v2Profile) {
    const team = v2Profile.teams as unknown as { id: string; owner_id: string };
    return { type: 'team', userId, teamId: team.id, ownerId: team.owner_id };
  }

  // 3. Check team_members (V1 membership — owner_id + member_id pattern)
  const { data: v1Member, error: v1Err } = await supabase
    .from('team_members')
    .select('owner_id')
    .eq('member_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (v1Err) {
    logWarn('getDataScope', 'V1 team_members lookup failed', { userId, error: v1Err });
  } else if (v1Member) {
    const { data: ownerTeam } = await supabase
      .from('teams')
      .select('id, owner_id')
      .eq('owner_id', v1Member.owner_id)
      .limit(1)
      .maybeSingle();

    if (ownerTeam) {
      return { type: 'team', userId, teamId: ownerTeam.id, ownerId: ownerTeam.owner_id };
    }
  }

  return null;
}

/**
 * Apply the current data scope to a Supabase query builder.
 * - Team mode: filter by team_id
 * - Personal mode: filter by user_id where team_id is null
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyScope(query: any, scope: DataScope): any {
  if (scope.type === 'team' && scope.teamId) {
    return query.eq('team_id', scope.teamId);
  }
  return query.eq('user_id', scope.userId).is('team_id', null);
}
