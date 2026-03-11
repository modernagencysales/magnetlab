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
  chain.update = jest.fn().mockReturnValue(chain);
  chain.upsert = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  chain.then = jest.fn((resolve: (v: typeof result) => void) => Promise.resolve(resolve(result)));
  return chain;
}

import {
  getDueSchedules,
  createSchedule,
  markScheduleRun,
  getSchedulesByEnrollment,
  computeNextRun,
} from '@/lib/services/accelerator-scheduler';

describe('accelerator-scheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue(createChain([]));
  });

  describe('computeNextRun', () => {
    it('computes next run for daily cron', () => {
      const now = new Date('2026-03-11T10:00:00Z');
      const next = computeNextRun('0 8 * * *', now);
      expect(next.getUTCHours()).toBe(8);
      expect(next.getUTCDate()).toBe(12);
    });

    it('computes next run for weekly Monday cron', () => {
      const now = new Date('2026-03-11T10:00:00Z'); // Wednesday
      const next = computeNextRun('0 9 * * 1', now);
      expect(next.getUTCDay()).toBe(1);
      expect(next.getUTCHours()).toBe(9);
    });
  });

  describe('getDueSchedules', () => {
    it('returns schedules where next_run_at <= now', async () => {
      const schedules = [
        { id: 's-1', task_type: 'collect_metrics', enrollment_id: 'e-1', config: {} },
      ];
      mockFrom.mockReturnValue(createChain(schedules));
      const result = await getDueSchedules();
      expect(result).toHaveLength(1);
      expect(result[0].task_type).toBe('collect_metrics');
    });
  });

  describe('createSchedule', () => {
    it('creates a schedule with computed next_run_at', async () => {
      const chain = createChain({ id: 's-new' });
      mockFrom.mockReturnValue(chain);

      const result = await createSchedule('e-1', 'weekly_digest', '0 9 * * 1', {}, true);
      expect(result).toBeTruthy();
      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          enrollment_id: 'e-1',
          task_type: 'weekly_digest',
          is_system: true,
        })
      );
    });
  });

  describe('markScheduleRun', () => {
    it('updates last_run_at and next_run_at', async () => {
      const chain = createChain(null);
      mockFrom.mockReturnValue(chain);
      await markScheduleRun('s-1', '0 9 * * 1');
      expect(chain.update).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 's-1');
    });
  });

  describe('getSchedulesByEnrollment', () => {
    it('returns all schedules for enrollment', async () => {
      mockFrom.mockReturnValue(createChain([{ id: 's-1' }, { id: 's-2' }]));
      const result = await getSchedulesByEnrollment('e-1');
      expect(result).toHaveLength(2);
    });
  });
});
