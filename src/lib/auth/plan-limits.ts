// Plan limits configuration and enforcement for billing tiers

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

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
    maxLeadMagnets: 3,
    maxFunnelPages: 3,
    maxEmailSequences: 1,
    features: { customDomain: false, teamMembers: false, apiAccess: false },
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

export async function checkResourceLimit(
  userId: string,
  resource: 'lead_magnets' | 'funnel_pages' | 'email_sequences',
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const limits = await getUserPlanLimits(userId);
  const supabase = createSupabaseAdminClient();

  const { count } = await supabase
    .from(resource)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

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
