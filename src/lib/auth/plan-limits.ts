// Plan limits configuration and enforcement for billing tiers

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { DataScope } from '@/lib/utils/team-context';
import { applyScope } from '@/lib/utils/team-context';

export interface PlanLimits {
  maxLeadMagnets: number;
  maxFunnelPages: number;
  maxEmailSequences: number;
  features: {
    customDomain: boolean;
    teamMembers: boolean;
    apiAccess: boolean;
  };
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  free: {
    maxLeadMagnets: Infinity,
    maxFunnelPages: Infinity,
    maxEmailSequences: Infinity,
    features: { customDomain: true, teamMembers: true, apiAccess: true },
  },
  pro: {
    maxLeadMagnets: 25,
    maxFunnelPages: 25,
    maxEmailSequences: 10,
    features: { customDomain: true, teamMembers: true, apiAccess: true },
  },
  unlimited: {
    maxLeadMagnets: Infinity,
    maxFunnelPages: Infinity,
    maxEmailSequences: Infinity,
    features: { customDomain: true, teamMembers: true, apiAccess: true },
  },
};

export async function getUserPlanLimits(userId: string): Promise<PlanLimits> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  return PLAN_LIMITS[data?.plan || 'free'];
}

/**
 * Check resource limits. Accepts either a DataScope (team-aware) or a plain userId (legacy).
 * In team mode, checks the team owner's plan and counts resources within the team scope.
 */
export async function checkResourceLimit(
  scopeOrUserId: DataScope | string,
  resource: 'lead_magnets' | 'funnel_pages' | 'email_sequences',
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const scope: DataScope = typeof scopeOrUserId === 'string'
    ? { type: 'user', userId: scopeOrUserId }
    : scopeOrUserId;

  // Check the owner's plan (not the logged-in member's)
  const billingUserId = scope.ownerId || scope.userId;
  const limits = await getUserPlanLimits(billingUserId);

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from(resource)
    .select('id', { count: 'exact', head: true });

  query = applyScope(query, scope);
  const { count } = await query;

  const limitMap: Record<string, number> = {
    lead_magnets: limits.maxLeadMagnets,
    funnel_pages: limits.maxFunnelPages,
    email_sequences: limits.maxEmailSequences,
  };

  const limit = limitMap[resource];
  return { allowed: (count || 0) < limit, current: count || 0, limit };
}

export async function getUserPlan(userId: string): Promise<string> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  return data?.plan || 'free';
}
