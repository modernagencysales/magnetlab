/**
 * @jest-environment node
 */

// Build a fluent mock that always returns itself and resolves single() calls in order
const singleResults: Array<{ data: unknown; error: unknown }> = [];
const selectResults: Array<{ count: number | null; error: unknown }> = [];

function createMockChain() {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    neq: jest.fn(),
    not: jest.fn(),
    single: jest.fn(),
  };
  // Every method returns the chain (fluent API)
  for (const key of Object.keys(chain)) {
    if (key === 'single') {
      chain[key].mockImplementation(() => {
        const result = singleResults.shift();
        return Promise.resolve(result || { data: null, error: null });
      });
    } else if (key === 'select') {
      chain[key].mockImplementation((_cols: string, opts?: { count?: string; head?: boolean }) => {
        if (opts?.count === 'exact' && opts?.head === true) {
          // This is a count query — return the next count result directly
          // The chain should resolve immediately after the final .eq()
          const countChain: Record<string, jest.Mock> = {
            eq: jest.fn(),
          };
          countChain.eq.mockImplementation(() => {
            const countResult = selectResults.shift();
            return Promise.resolve(countResult || { count: 0, error: null });
          });
          return countChain;
        }
        return chain;
      });
    } else {
      chain[key].mockReturnValue(chain);
    }
  }
  return chain;
}

const mockChain = createMockChain();
const mockFrom = jest.fn().mockReturnValue(mockChain);

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock team-context (plan-limits now uses applyScope for multi-team scoping)
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyScope: jest.fn((query: any, scope: any) => query.eq('user_id', scope.userId)),
}));

import {
  PLAN_LIMITS,
  getUserPlanLimits,
  checkResourceLimit,
  getUserPlan,
} from '@/lib/auth/plan-limits';

describe('Plan limits', () => {
  beforeEach(() => {
    singleResults.length = 0;
    selectResults.length = 0;
    jest.clearAllMocks();
    // Re-setup chain after clearing
    for (const key of Object.keys(mockChain)) {
      if (key === 'single') {
        mockChain[key].mockImplementation(() => {
          const result = singleResults.shift();
          return Promise.resolve(result || { data: null, error: null });
        });
      } else if (key === 'select') {
        mockChain[key].mockImplementation((_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (opts?.count === 'exact' && opts?.head === true) {
            const countChain: Record<string, jest.Mock> = {
              eq: jest.fn(),
            };
            countChain.eq.mockImplementation(() => {
              const countResult = selectResults.shift();
              return Promise.resolve(countResult || { count: 0, error: null });
            });
            return countChain;
          }
          return mockChain;
        });
      } else {
        mockChain[key].mockReturnValue(mockChain);
      }
    }
    mockFrom.mockReturnValue(mockChain);
  });

  describe('PLAN_LIMITS constants', () => {
    it('defines free plan with limited resources', () => {
      expect(PLAN_LIMITS.free.maxLeadMagnets).toBe(3);
      expect(PLAN_LIMITS.free.maxFunnelPages).toBe(3);
      expect(PLAN_LIMITS.free.maxEmailSequences).toBe(1);
      expect(PLAN_LIMITS.free.features.customDomain).toBe(false);
      expect(PLAN_LIMITS.free.features.teamMembers).toBe(false);
      expect(PLAN_LIMITS.free.features.apiAccess).toBe(false);
    });

    it('defines pro plan with higher limits and all features', () => {
      expect(PLAN_LIMITS.pro.maxLeadMagnets).toBe(25);
      expect(PLAN_LIMITS.pro.maxFunnelPages).toBe(25);
      expect(PLAN_LIMITS.pro.maxEmailSequences).toBe(10);
      expect(PLAN_LIMITS.pro.features.customDomain).toBe(true);
      expect(PLAN_LIMITS.pro.features.teamMembers).toBe(true);
      expect(PLAN_LIMITS.pro.features.apiAccess).toBe(true);
    });

    it('defines unlimited plan with infinite resources', () => {
      expect(PLAN_LIMITS.unlimited.maxLeadMagnets).toBe(Infinity);
      expect(PLAN_LIMITS.unlimited.maxFunnelPages).toBe(Infinity);
      expect(PLAN_LIMITS.unlimited.maxEmailSequences).toBe(Infinity);
      expect(PLAN_LIMITS.unlimited.features.customDomain).toBe(true);
    });
  });

  describe('getUserPlanLimits', () => {
    it('returns free plan limits when no subscription found', async () => {
      singleResults.push({ data: null, error: { code: 'PGRST116' } });

      const limits = await getUserPlanLimits('user-1');
      expect(limits).toEqual(PLAN_LIMITS.free);
      expect(mockFrom).toHaveBeenCalledWith('subscriptions');
    });

    it('returns pro plan limits for active pro subscription', async () => {
      singleResults.push({ data: { plan: 'pro' }, error: null });

      const limits = await getUserPlanLimits('user-1');
      expect(limits).toEqual(PLAN_LIMITS.pro);
    });

    it('returns unlimited plan limits for active unlimited subscription', async () => {
      singleResults.push({ data: { plan: 'unlimited' }, error: null });

      const limits = await getUserPlanLimits('user-1');
      expect(limits).toEqual(PLAN_LIMITS.unlimited);
    });

    it('defaults to free plan when no data returned', async () => {
      singleResults.push({ data: null, error: null });

      const limits = await getUserPlanLimits('user-1');
      expect(limits).toEqual(PLAN_LIMITS.free);
    });
  });

  describe('checkResourceLimit', () => {
    it('returns allowed=true when under limit', async () => {
      // getUserPlanLimits call — no subscription (free plan)
      singleResults.push({ data: null, error: { code: 'PGRST116' } });
      // count query result
      selectResults.push({ count: 1, error: null });

      const result = await checkResourceLimit('user-1', 'lead_magnets');
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(3);
    });

    it('returns allowed=false when at limit', async () => {
      // free plan
      singleResults.push({ data: null, error: { code: 'PGRST116' } });
      // at limit
      selectResults.push({ count: 3, error: null });

      const result = await checkResourceLimit('user-1', 'lead_magnets');
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(3);
      expect(result.limit).toBe(3);
    });

    it('returns allowed=true for pro plan with more resources', async () => {
      // pro plan subscription
      singleResults.push({ data: { plan: 'pro' }, error: null });
      // 10 resources used (under pro limit of 25)
      selectResults.push({ count: 10, error: null });

      const result = await checkResourceLimit('user-1', 'lead_magnets');
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(10);
      expect(result.limit).toBe(25);
    });

    it('handles null count as zero', async () => {
      // free plan
      singleResults.push({ data: null, error: { code: 'PGRST116' } });
      // null count
      selectResults.push({ count: null, error: null });

      const result = await checkResourceLimit('user-1', 'lead_magnets');
      expect(result.allowed).toBe(true);
      expect(result.current).toBe(0);
      expect(result.limit).toBe(3);
    });

    it('checks funnel_pages limit correctly', async () => {
      // free plan
      singleResults.push({ data: null, error: { code: 'PGRST116' } });
      // at limit
      selectResults.push({ count: 3, error: null });

      const result = await checkResourceLimit('user-1', 'funnel_pages');
      expect(result.allowed).toBe(false);
      expect(result.limit).toBe(3);
    });

    it('checks email_sequences limit correctly', async () => {
      // free plan (limit: 1)
      singleResults.push({ data: null, error: { code: 'PGRST116' } });
      // 1 already exists
      selectResults.push({ count: 1, error: null });

      const result = await checkResourceLimit('user-1', 'email_sequences');
      expect(result.allowed).toBe(false);
      expect(result.current).toBe(1);
      expect(result.limit).toBe(1);
    });
  });

  describe('getUserPlan', () => {
    it('returns "free" when no subscription', async () => {
      singleResults.push({ data: null, error: { code: 'PGRST116' } });

      const plan = await getUserPlan('user-1');
      expect(plan).toBe('free');
    });

    it('returns the plan name for active subscription', async () => {
      singleResults.push({ data: { plan: 'pro' }, error: null });

      const plan = await getUserPlan('user-1');
      expect(plan).toBe('pro');
    });
  });
});
