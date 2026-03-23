/**
 * LinkedIn Accounts Service.
 * Validates Unipile account access and lists connected LinkedIn accounts.
 * Never imports from Next.js HTTP layer (no NextRequest, NextResponse, cookies).
 */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUnipileClient } from '@/lib/integrations/unipile';
import { logError } from '@/lib/utils/logger';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface LinkedInAccount {
  unipile_account_id: string;
  name: string | null;
  status: string | null;
  source: 'user' | 'team';
}

// ─── Column constants ───────────────────────────────────────────────────────

const USER_INTEGRATION_COLUMNS = 'id, metadata' as const;
const TEAM_PROFILE_COLUMNS = 'id' as const;
const TEAM_PROFILE_INTEGRATION_COLUMNS = 'id, metadata' as const;

// ─── Validation ────────────────────────────────────────────────────────────

/**
 * Validate that a userId owns or has access to the given Unipile account ID.
 * Checks user_integrations first, then team_profile_integrations.
 * Returns true if access is granted, false otherwise.
 */
export async function validateUnipileAccountAccess(
  userId: string,
  accountId: string
): Promise<boolean> {
  const supabase = createSupabaseAdminClient();

  // 1. Check user_integrations
  const { data: userIntegrations, error: userError } = await supabase
    .from('user_integrations')
    .select(USER_INTEGRATION_COLUMNS)
    .eq('user_id', userId)
    .eq('service', 'unipile')
    .eq('is_active', true);

  if (userError) {
    logError('linkedin-accounts/validate/user-integrations', userError, { userId, accountId });
  }

  const userRows = userIntegrations ?? [];
  const foundInUser = userRows.some(
    (row) => (row.metadata as Record<string, unknown>)?.unipile_account_id === accountId
  );
  if (foundInUser) return true;

  // 2. Check team_profile_integrations via team_profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('team_profiles')
    .select(TEAM_PROFILE_COLUMNS)
    .eq('user_id', userId);

  if (profilesError) {
    logError('linkedin-accounts/validate/team-profiles', profilesError, { userId, accountId });
    return false;
  }

  const profileIds = (profiles ?? []).map((p) => p.id);
  if (profileIds.length === 0) return false;

  const { data: teamIntegrations, error: teamError } = await supabase
    .from('team_profile_integrations')
    .select(TEAM_PROFILE_INTEGRATION_COLUMNS)
    .in('team_profile_id', profileIds)
    .eq('service', 'unipile')
    .eq('is_active', true);

  if (teamError) {
    logError('linkedin-accounts/validate/team-integrations', teamError, { userId, accountId });
    return false;
  }

  return (teamIntegrations ?? []).some(
    (row) => (row.metadata as Record<string, unknown>)?.unipile_account_id === accountId
  );
}

// ─── Listing ───────────────────────────────────────────────────────────────

/**
 * List LinkedIn accounts connected to a user (and optionally their team).
 * When refresh=true, enriches with live status from the Unipile accounts API.
 */
export async function listLinkedInAccounts(
  userId: string,
  teamId?: string,
  refresh?: boolean
): Promise<LinkedInAccount[]> {
  const supabase = createSupabaseAdminClient();
  const accounts: LinkedInAccount[] = [];

  // ─── 1. User-level integrations ──────────────────────────────────────
  const { data: userIntegrations, error: userError } = await supabase
    .from('user_integrations')
    .select(USER_INTEGRATION_COLUMNS)
    .eq('user_id', userId)
    .eq('service', 'unipile')
    .eq('is_active', true);

  if (userError) {
    logError('linkedin-accounts/list/user-integrations', userError, { userId });
  }

  for (const row of userIntegrations ?? []) {
    const accountId = (row.metadata as Record<string, unknown>)?.unipile_account_id;
    if (typeof accountId === 'string') {
      accounts.push({ unipile_account_id: accountId, name: null, status: null, source: 'user' });
    }
  }

  // ─── 2. Team-level integrations (when teamId provided) ───────────────
  if (teamId) {
    const { data: profiles, error: profilesError } = await supabase
      .from('team_profiles')
      .select(TEAM_PROFILE_COLUMNS)
      .eq('user_id', userId)
      .eq('team_id', teamId);

    if (profilesError) {
      logError('linkedin-accounts/list/team-profiles', profilesError, { userId, teamId });
    } else {
      const profileIds = (profiles ?? []).map((p) => p.id);

      if (profileIds.length > 0) {
        const { data: teamIntegrations, error: teamError } = await supabase
          .from('team_profile_integrations')
          .select(TEAM_PROFILE_INTEGRATION_COLUMNS)
          .in('team_profile_id', profileIds)
          .eq('service', 'unipile')
          .eq('is_active', true);

        if (teamError) {
          logError('linkedin-accounts/list/team-integrations', teamError, { userId, teamId });
        }

        for (const row of teamIntegrations ?? []) {
          const accountId = (row.metadata as Record<string, unknown>)?.unipile_account_id;
          if (typeof accountId === 'string') {
            accounts.push({
              unipile_account_id: accountId,
              name: null,
              status: null,
              source: 'team',
            });
          }
        }
      }
    }
  }

  // ─── 3. Optional Unipile enrichment ──────────────────────────────────
  if (refresh && accounts.length > 0) {
    try {
      const client = getUnipileClient();
      const result = await client.listAccounts();

      if (result.data?.items) {
        const liveById = new Map<string, { id: string; name?: string; status?: string }>(
          result.data.items.map((item) => [item.id, item])
        );

        for (const account of accounts) {
          const live = liveById.get(account.unipile_account_id);
          if (live) {
            account.name = live.name ?? null;
            account.status = live.status ?? null;
          }
        }
      }
    } catch (err) {
      // Graceful degradation: log but return cached data
      logError('linkedin-accounts/list/unipile-enrichment', err, { userId });
    }
  }

  return accounts;
}

// ─── Error helper ──────────────────────────────────────────────────────────

/** Extract HTTP status from a service error (defaults to 500). */
export function getStatusCode(err: unknown): number {
  if (err && typeof err === 'object' && 'statusCode' in err) {
    return (err as { statusCode: number }).statusCode;
  }
  return 500;
}
