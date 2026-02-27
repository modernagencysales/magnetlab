// Team Profile Integrations Service
// Manages LinkedIn connections per team profile via team_profile_integrations table
// Falls back to user_integrations for profiles linked to a user account

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { getUnipileClient, isUnipileConfigured } from '@/lib/integrations/unipile';
import { logError } from '@/lib/utils/logger';
import type {
  TeamProfile,
  TeamProfileIntegration,
  TeamProfileWithConnection,
} from '@/lib/types/content-pipeline';
import type { UnipilePost, UnipilePostStats } from '@/lib/types/integrations';

// ============================================
// GET UNIPILE ACCOUNT ID
// ============================================

/**
 * Returns the Unipile account ID for a team profile.
 * Checks team_profile_integrations first, then falls back to
 * user_integrations via the profile's user_id.
 */
export async function getTeamProfileUnipileAccountId(
  teamProfileId: string
): Promise<string | null> {
  const supabase = createSupabaseAdminClient();

  // 1. Check team_profile_integrations for a direct Unipile integration
  const { data: teamIntegration, error: teamError } = await supabase
    .from('team_profile_integrations')
    .select('metadata, is_active')
    .eq('team_profile_id', teamProfileId)
    .eq('service', 'unipile')
    .single();

  if (!teamError && teamIntegration?.is_active) {
    const accountId = (teamIntegration.metadata as Record<string, unknown>)
      ?.unipile_account_id;
    if (typeof accountId === 'string') {
      return accountId;
    }
  }

  // 2. Fall back to user_integrations via the profile's user_id
  const { data: profile, error: profileError } = await supabase
    .from('team_profiles')
    .select('user_id')
    .eq('id', teamProfileId)
    .single();

  if (profileError || !profile?.user_id) {
    return null;
  }

  const userIntegration = await getUserIntegration(profile.user_id, 'unipile');
  if (!userIntegration?.is_active) {
    return null;
  }

  const accountId = (userIntegration.metadata as Record<string, unknown>)
    ?.unipile_account_id;
  return typeof accountId === 'string' ? accountId : null;
}

// ============================================
// GET LINKEDIN PUBLISHER
// ============================================

export interface TeamProfilePublisher {
  publishNow: (text: string) => Promise<UnipilePost | null>;
  getPostStats: (postId: string) => Promise<UnipilePostStats | null>;
}

/**
 * Returns a publisher object for a team profile, or null if LinkedIn is not connected.
 * The publisher wraps UnipileClient with the profile's account ID pre-bound.
 */
export async function getTeamProfileLinkedInPublisher(
  teamProfileId: string
): Promise<TeamProfilePublisher | null> {
  if (!isUnipileConfigured()) {
    return null;
  }

  const accountId = await getTeamProfileUnipileAccountId(teamProfileId);
  if (!accountId) {
    return null;
  }

  const client = getUnipileClient();

  return {
    async publishNow(text: string): Promise<UnipilePost | null> {
      const result = await client.createPost(accountId, text);
      if (result.error) {
        logError('team-integrations', new Error(result.error), {
          action: 'publishNow',
          teamProfileId,
        });
        return null;
      }
      return result.data;
    },

    async getPostStats(postId: string): Promise<UnipilePostStats | null> {
      const result = await client.getPost(postId, accountId);
      if (result.error) {
        logError('team-integrations', new Error(result.error), {
          action: 'getPostStats',
          teamProfileId,
        });
        return null;
      }
      return result.data;
    },
  };
}

// ============================================
// GET TEAM PROFILES WITH CONNECTIONS
// ============================================

/**
 * Returns all active team profiles enriched with linkedin_connected boolean
 * and unipile_account_id. Checks both team_profile_integrations and
 * user_integrations fallback.
 */
export async function getTeamProfilesWithConnections(
  teamId: string
): Promise<TeamProfileWithConnection[]> {
  const supabase = createSupabaseAdminClient();

  // 1. Fetch all active team profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('team_profiles')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'active');

  if (profilesError || !profiles?.length) {
    return [];
  }

  const profileIds = profiles.map((p: TeamProfile) => p.id);

  // 2. Batch-fetch team_profile_integrations for unipile
  const { data: teamIntegrations } = await supabase
    .from('team_profile_integrations')
    .select('team_profile_id, metadata, is_active')
    .in('team_profile_id', profileIds)
    .eq('service', 'unipile');

  // Build a map: profileId -> unipile_account_id from team integrations
  const teamIntegrationMap = new Map<string, string>();
  if (teamIntegrations) {
    for (const ti of teamIntegrations) {
      if (ti.is_active) {
        const accountId = (ti.metadata as Record<string, unknown>)
          ?.unipile_account_id;
        if (typeof accountId === 'string') {
          teamIntegrationMap.set(ti.team_profile_id, accountId);
        }
      }
    }
  }

  // 3. For profiles without team integration, check user_integrations fallback
  const userIds = profiles
    .filter((p: TeamProfile) => p.user_id && !teamIntegrationMap.has(p.id))
    .map((p: TeamProfile) => p.user_id as string);

  const userIntegrationMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: userIntegrations } = await supabase
      .from('user_integrations')
      .select('user_id, metadata, is_active')
      .in('user_id', userIds)
      .eq('service', 'unipile');

    if (userIntegrations) {
      for (const ui of userIntegrations) {
        if (ui.is_active) {
          const accountId = (ui.metadata as Record<string, unknown>)
            ?.unipile_account_id;
          if (typeof accountId === 'string') {
            userIntegrationMap.set(ui.user_id, accountId);
          }
        }
      }
    }
  }

  // 4. Enrich profiles
  return profiles.map((profile: TeamProfile): TeamProfileWithConnection => {
    // Check team integration first, then user integration
    let unipileAccountId = teamIntegrationMap.get(profile.id) ?? null;
    if (!unipileAccountId && profile.user_id) {
      unipileAccountId = userIntegrationMap.get(profile.user_id) ?? null;
    }

    return {
      ...profile,
      linkedin_connected: !!unipileAccountId,
      unipile_account_id: unipileAccountId,
    };
  });
}

// ============================================
// CONNECT TEAM PROFILE LINKEDIN
// ============================================

/**
 * Upserts a team profile's LinkedIn integration into team_profile_integrations.
 */
export async function connectTeamProfileLinkedIn(
  teamProfileId: string,
  unipileAccountId: string,
  connectedBy: string
): Promise<TeamProfileIntegration | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('team_profile_integrations')
    .upsert(
      {
        team_profile_id: teamProfileId,
        service: 'unipile',
        is_active: true,
        metadata: { unipile_account_id: unipileAccountId },
        connected_by: connectedBy,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'team_profile_id,service',
      }
    )
    .select('*')
    .single();

  if (error) {
    logError('team-integrations', error, {
      action: 'connectTeamProfileLinkedIn',
      teamProfileId,
    });
    return null;
  }

  return data as TeamProfileIntegration;
}
