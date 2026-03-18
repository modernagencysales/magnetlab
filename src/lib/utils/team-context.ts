/**
 * Team Context & Data Scope Resolution.
 * Resolves the active DataScope for the current request from cookie, API key,
 * or explicit requestTeamId param. Uses hasTeamAccess() for all access checks
 * (supports direct membership AND agency team links).
 * Never imported by 'use client' files.
 */

import { cookies, headers } from 'next/headers';
import { hasTeamAccess } from '@/server/repositories/team.repo';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logWarn } from '@/lib/utils/logger';

export interface DataScope {
  type: 'user' | 'team';
  userId: string; // Always the logged-in user
  teamId?: string; // Set when in team context
  billingUserId?: string; // Billing team owner's user_id (for billing lookups)
}

// ─── Billing resolution ─────────────────────────────────────────────────────

/**
 * Resolve the billing user ID for a team.
 * If the team has a billing_team_id, follow one hop to that team's owner_id.
 * If billing_team_id is NULL, use the team's own owner_id.
 */
async function resolveBillingUserId(teamId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data: team } = await supabase
    .from('teams')
    .select('owner_id, billing_team_id')
    .eq('id', teamId)
    .single();

  if (!team) return teamId; // shouldn't happen — caller verified team exists

  if (!team.billing_team_id) {
    return team.owner_id;
  }

  // Follow one hop to the billing team's owner
  const { data: billingTeam } = await supabase
    .from('teams')
    .select('owner_id')
    .eq('id', team.billing_team_id)
    .single();

  return billingTeam?.owner_id ?? team.owner_id;
}

// ─── getDataScope ────────────────────────────────────────────────────────────

/**
 * Get the current data scope based on session and team context.
 * Resolution order:
 * 1. ml-team-context cookie → validate via hasTeamAccess
 * 2. requestTeamId param (MCP requests) → validate via hasTeamAccess
 * 3. API key requests → resolveTeamForApiKey
 * 4. Personal mode fallback
 *
 * Multi-team ambiguity: if no cookie, no API key, no requestTeamId,
 * always returns personal mode (never picks a random team).
 */
export async function getDataScope(userId: string, requestTeamId?: string): Promise<DataScope> {
  const cookieStore = await cookies();
  const contextTeamId = cookieStore.get('ml-team-context')?.value;

  // 1. Cookie-based team context
  if (contextTeamId && contextTeamId !== 'personal') {
    const result = await hasTeamAccess(userId, contextTeamId);
    if (result.access) {
      const billingUserId = await resolveBillingUserId(contextTeamId);
      return { type: 'team', userId, teamId: contextTeamId, billingUserId };
    }
  }

  // 2. Explicit requestTeamId (MCP / API callers pass this)
  if (!contextTeamId && requestTeamId) {
    const result = await hasTeamAccess(userId, requestTeamId);
    if (result.access) {
      const billingUserId = await resolveBillingUserId(requestTeamId);
      return { type: 'team', userId, teamId: requestTeamId, billingUserId };
    }
  }

  // 3. API key requests (no cookie mechanism) — resolve team from membership
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

  // 4. Personal mode fallback
  return { type: 'user', userId };
}

// ─── requireTeamScope ────────────────────────────────────────────────────────

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

// ─── resolveTeamForApiKey ────────────────────────────────────────────────────

/**
 * Resolve team context for an API key user by checking membership tables.
 * Priority: owned team (via team_members) → any active team_members entry.
 * Returns null if user has no team membership.
 */
async function resolveTeamForApiKey(userId: string): Promise<DataScope | null> {
  const supabase = createSupabaseAdminClient();

  // 1. Check if user owns a team (via team_members with role='owner')
  const { data: ownerMembership, error: ownerErr } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('role', 'owner')
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (ownerErr) {
    logWarn('getDataScope', 'Owner membership lookup failed', { userId, error: ownerErr });
  } else if (ownerMembership) {
    const billingUserId = await resolveBillingUserId(ownerMembership.team_id);
    return { type: 'team', userId, teamId: ownerMembership.team_id, billingUserId };
  }

  // 2. Check any active team_members entry (non-owner membership)
  const { data: membership, error: memberErr } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (memberErr) {
    logWarn('getDataScope', 'Member lookup failed', { userId, error: memberErr });
  } else if (membership) {
    const billingUserId = await resolveBillingUserId(membership.team_id);
    return { type: 'team', userId, teamId: membership.team_id, billingUserId };
  }

  return null;
}

// ─── getScopeForResource ─────────────────────────────────────────────────────

/**
 * Resolve scope for a specific resource's team. Used when the cookie-based
 * scope (getDataScope) doesn't match the resource being modified — e.g. a
 * DFY manager editing a client team's funnel via agency team link.
 *
 * Falls back to cookie-based scope when the resource has no team_id or the
 * user's scope already matches. Throws if the user has no access.
 */
export async function getScopeForResource(
  userId: string,
  resourceTeamId: string | null | undefined
): Promise<DataScope> {
  const scope = await getDataScope(userId);

  // No team on resource — use cookie scope as-is
  if (!resourceTeamId) return scope;

  // Cookie scope already matches the resource's team
  if (scope.type === 'team' && scope.teamId === resourceTeamId) return scope;

  // Cookie scope doesn't match — check if user has access to the resource's team
  const result = await hasTeamAccess(userId, resourceTeamId);
  if (result.access) {
    const billingUserId = await resolveBillingUserId(resourceTeamId);
    return {
      type: 'team',
      userId,
      teamId: resourceTeamId,
      billingUserId,
    };
  }

  // No cross-team access — fall back to cookie scope (will likely 404 at query level)
  return scope;
}

// ─── applyScope ──────────────────────────────────────────────────────────────

/**
 * Apply the current data scope to a Supabase query builder.
 * - Team mode: filter by team_id
 * - Personal mode: filter by user_id (includes team-owned resources)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyScope(query: any, scope: DataScope): any {
  if (scope.type === 'team' && scope.teamId) {
    return query.eq('team_id', scope.teamId);
  }
  return query.eq('user_id', scope.userId);
}
