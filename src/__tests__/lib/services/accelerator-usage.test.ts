/**
 * @jest-environment node
 */

/** Tests for accelerator-usage service.
 *  Verifies that checkUsageAllocation issues three parallel DB count queries
 *  instead of loading all rows client-side. */

// ─── Mock helpers ────────────────────────────────────────────────────────────

/** Each entry is resolved by one count query (sessions, deliverables, api_calls). */
const countResults: Array<{ count: number | null; error: unknown }> = [];

function makeCountChain() {
  // Fluent chain: .eq(...).eq(...).gte(...) → resolves with the next count result
  const chain: Record<string, jest.Mock> = {
    eq: jest.fn(),
    gte: jest.fn(),
  };
  chain.eq.mockReturnValue(chain);
  chain.gte.mockImplementation(() => {
    const result = countResults.shift();
    return Promise.resolve(result ?? { count: 0, error: null });
  });
  return chain;
}

const mockFrom = jest.fn();

jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { checkUsageAllocation, trackUsageEvent } from '@/lib/services/accelerator-usage';
import { logError } from '@/lib/utils/logger';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('accelerator-usage service', () => {
  beforeEach(() => {
    countResults.length = 0;
    jest.clearAllMocks();

    // Each .from() call gets a fresh count chain (one per parallel query)
    mockFrom.mockImplementation(() => {
      const chain = makeCountChain();
      return {
        select: jest.fn().mockReturnValue(chain),
        insert: jest.fn().mockResolvedValue({ error: null }),
      };
    });
  });

  // ─── checkUsageAllocation ──────────────────────────────────────────────────

  describe('checkUsageAllocation', () => {
    it('returns withinLimits=true when usage is well under allocation', async () => {
      countResults.push(
        { count: 5, error: null }, // sessions
        { count: 3, error: null }, // deliverables
        { count: 10, error: null } // api_calls
      );

      const result = await checkUsageAllocation('enrollment-abc');

      expect(result.withinLimits).toBe(true);
      expect(result.usage).toEqual({ sessions: 5, deliverables: 3, api_calls: 10 });
      expect(result.limits).toEqual({ sessions: 30, deliverables: 15, api_calls: 500 });
    });

    it('issues three separate .from() calls (parallel DB count queries)', async () => {
      countResults.push(
        { count: 1, error: null },
        { count: 1, error: null },
        { count: 1, error: null }
      );

      await checkUsageAllocation('enrollment-abc');

      expect(mockFrom).toHaveBeenCalledTimes(3);
      expect(mockFrom).toHaveBeenCalledWith('program_usage_events');
    });

    it('returns withinLimits=false when sessions exceed limit (30)', async () => {
      countResults.push(
        { count: 31, error: null }, // sessions over limit
        { count: 5, error: null }, // deliverables fine
        { count: 0, error: null } // api_calls fine
      );

      const result = await checkUsageAllocation('enrollment-abc');

      expect(result.withinLimits).toBe(false);
      expect(result.usage.sessions).toBe(31);
    });

    it('returns withinLimits=false when deliverables exceed limit (15)', async () => {
      countResults.push(
        { count: 0, error: null }, // sessions fine
        { count: 16, error: null }, // deliverables over limit
        { count: 0, error: null } // api_calls fine
      );

      const result = await checkUsageAllocation('enrollment-abc');

      expect(result.withinLimits).toBe(false);
      expect(result.usage.deliverables).toBe(16);
    });

    it('withinLimits is not affected by api_calls exceeding 500', async () => {
      // api_calls are tracked but NOT included in withinLimits check
      countResults.push(
        { count: 0, error: null }, // sessions
        { count: 0, error: null }, // deliverables
        { count: 600, error: null } // api_calls over limit
      );

      const result = await checkUsageAllocation('enrollment-abc');

      expect(result.withinLimits).toBe(true);
      expect(result.usage.api_calls).toBe(600);
    });

    it('treats null count as zero', async () => {
      countResults.push(
        { count: null, error: null },
        { count: null, error: null },
        { count: null, error: null }
      );

      const result = await checkUsageAllocation('enrollment-abc');

      expect(result.usage).toEqual({ sessions: 0, deliverables: 0, api_calls: 0 });
      expect(result.withinLimits).toBe(true);
    });

    it('returns safe fallback and logs error when a count query fails', async () => {
      const dbError = { message: 'connection refused', code: '08006' };
      countResults.push(
        { count: null, error: dbError },
        { count: null, error: null },
        { count: null, error: null }
      );

      const result = await checkUsageAllocation('enrollment-abc');

      expect(result.withinLimits).toBe(true);
      expect(result.usage).toEqual({ sessions: 0, deliverables: 0, api_calls: 0 });
      expect(logError).toHaveBeenCalledWith(
        'accelerator-usage',
        dbError,
        expect.objectContaining({
          enrollmentId: 'enrollment-abc',
        })
      );
    });

    it('returns exact boundary values (sessions=30, deliverables=15) as withinLimits=true', async () => {
      countResults.push(
        { count: 30, error: null },
        { count: 15, error: null },
        { count: 0, error: null }
      );

      const result = await checkUsageAllocation('enrollment-abc');

      expect(result.withinLimits).toBe(true);
    });
  });

  // ─── trackUsageEvent ──────────────────────────────────────────────────────

  describe('trackUsageEvent', () => {
    it('inserts a usage event row', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      await trackUsageEvent('enrollment-abc', 'session_start', { tool: 'post-generator' });

      expect(mockFrom).toHaveBeenCalledWith('program_usage_events');
      expect(mockInsert).toHaveBeenCalledWith({
        enrollment_id: 'enrollment-abc',
        event_type: 'session_start',
        metadata: { tool: 'post-generator' },
      });
    });

    it('logs error on insert failure without throwing', async () => {
      const dbError = { message: 'insert failed' };
      const mockInsert = jest.fn().mockResolvedValue({ error: dbError });
      mockFrom.mockReturnValue({ insert: mockInsert });

      await expect(trackUsageEvent('enrollment-abc', 'session_start')).resolves.toBeUndefined();

      expect(logError).toHaveBeenCalledWith('accelerator-usage', dbError, {
        enrollmentId: 'enrollment-abc',
        eventType: 'session_start',
      });
    });

    it('defaults metadata to empty object', async () => {
      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ insert: mockInsert });

      await trackUsageEvent('enrollment-abc', 'api_call');

      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ metadata: {} }));
    });
  });
});
