/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

function createChain(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  chain.then = jest.fn((resolve: (v: typeof result) => void) => Promise.resolve(resolve(result)));
  return chain;
}

import {
  recordMetrics,
  getLatestMetrics,
  getMetricHistory,
  getMetricsSummary,
  computeMetricStatus,
} from '@/lib/services/accelerator-metrics';

describe('accelerator-metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue(createChain([]));
  });

  describe('computeMetricStatus', () => {
    it('returns "below" when value < benchmark_low', () => {
      expect(computeMetricStatus(5, 10, 20)).toBe('below');
    });
    it('returns "above" when value > benchmark_high', () => {
      expect(computeMetricStatus(25, 10, 20)).toBe('above');
    });
    it('returns "at" when value is within range', () => {
      expect(computeMetricStatus(15, 10, 20)).toBe('at');
    });
    it('returns "at" when no benchmarks provided', () => {
      expect(computeMetricStatus(15, null, null)).toBe('at');
    });
  });

  describe('recordMetrics', () => {
    it('inserts metrics rows', async () => {
      const chain = createChain(null);
      mockFrom.mockReturnValue(chain);

      await recordMetrics('enroll-1', [
        { module_id: 'm4', metric_key: 'email_sent', value: 100, source: 'plusvibe' },
      ]);

      expect(mockFrom).toHaveBeenCalledWith('program_metrics');
      expect(chain.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            enrollment_id: 'enroll-1',
            metric_key: 'email_sent',
            value: 100,
          }),
        ])
      );
    });
  });

  describe('getLatestMetrics', () => {
    it('returns latest metrics for enrollment', async () => {
      const metrics = [
        {
          metric_key: 'email_sent',
          value: 100,
          status: 'at',
          collected_at: '2026-03-11T00:00:00Z',
        },
      ];
      mockFrom.mockReturnValue(createChain(metrics));

      const result = await getLatestMetrics('enroll-1');
      expect(result).toHaveLength(1);
      expect(result[0].metric_key).toBe('email_sent');
    });

    it('returns empty array on error', async () => {
      mockFrom.mockReturnValue(createChain(null, { code: '42P01', message: 'table not found' }));
      const result = await getLatestMetrics('enroll-1');
      expect(result).toEqual([]);
    });
  });

  describe('getMetricHistory', () => {
    it('returns metric history for a key', async () => {
      const history = [
        { value: 100, collected_at: '2026-03-10' },
        { value: 120, collected_at: '2026-03-11' },
      ];
      mockFrom.mockReturnValue(createChain(history));

      const result = await getMetricHistory('enroll-1', 'email_sent', 7);
      expect(result).toHaveLength(2);
    });
  });

  describe('getMetricsSummary', () => {
    it('groups metrics by module with status counts', async () => {
      const metrics = [
        {
          module_id: 'm4',
          metric_key: 'email_sent',
          value: 100,
          status: 'at',
          benchmark_low: 50,
          benchmark_high: 200,
        },
        {
          module_id: 'm4',
          metric_key: 'email_open_rate',
          value: 5,
          status: 'below',
          benchmark_low: 15,
          benchmark_high: 30,
        },
        {
          module_id: 'm3',
          metric_key: 'dm_sent',
          value: 20,
          status: 'at',
          benchmark_low: 10,
          benchmark_high: 30,
        },
      ];
      mockFrom.mockReturnValue(createChain(metrics));

      const result = await getMetricsSummary('enroll-1');
      expect(result.modules).toHaveLength(2);
      expect(result.belowCount).toBe(1);
      expect(result.totalMetrics).toBe(3);
    });
  });
});
