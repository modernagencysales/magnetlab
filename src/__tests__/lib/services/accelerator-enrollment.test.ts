/**
 * @jest-environment node
 */

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));
jest.mock('@/lib/services/accelerator-scheduler', () => ({
  initializeSystemSchedules: jest.fn().mockResolvedValue(undefined),
}));

function createChain(data: unknown = null, error: unknown = null) {
  const result = { data, error };
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);
  chain.then = jest.fn((resolve: (v: typeof result) => void) => Promise.resolve(resolve(result)));
  return chain;
}

import {
  hasAcceleratorAccess,
  getEnrollmentByPaymentId,
  createPaidEnrollment,
} from '@/lib/services/accelerator-enrollment';
import { initializeSystemSchedules } from '@/lib/services/accelerator-scheduler';

describe('accelerator-enrollment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hasAcceleratorAccess', () => {
    it('returns true when user has active enrollment', async () => {
      mockFrom.mockReturnValue(createChain({ id: 'e1', status: 'active' }));

      const result = await hasAcceleratorAccess('user-1');
      expect(result).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('program_enrollments');
    });

    it('returns false when no enrollment exists', async () => {
      mockFrom.mockReturnValue(createChain(null, { code: 'PGRST116' }));

      const result = await hasAcceleratorAccess('user-2');
      expect(result).toBe(false);
    });

    it('returns false on database error', async () => {
      mockFrom.mockReturnValue(createChain(null, { code: 'UNKNOWN', message: 'DB error' }));

      const result = await hasAcceleratorAccess('user-3');
      expect(result).toBe(false);
    });
  });

  describe('getEnrollmentByPaymentId', () => {
    it('returns enrollment when found', async () => {
      const enrollment = { id: 'e1', stripe_customer_id: 'cus_123', status: 'active' };
      mockFrom.mockReturnValue(createChain(enrollment));

      const result = await getEnrollmentByPaymentId('pi_123');
      expect(result).toEqual(enrollment);
    });

    it('returns null when not found', async () => {
      mockFrom.mockReturnValue(createChain(null, { code: 'PGRST116' }));

      const result = await getEnrollmentByPaymentId('pi_not_found');
      expect(result).toBeNull();
    });
  });

  describe('createPaidEnrollment', () => {
    it('creates enrollment with all modules and stripe fields', async () => {
      const enrollment = {
        id: 'e1',
        user_id: 'user-1',
        status: 'active',
        selected_modules: ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'],
        stripe_customer_id: 'cus_123',
      };

      // First call: idempotency check (not found)
      const idempotencyChain = createChain(null, { code: 'PGRST116' });
      // Second call: insert enrollment
      const insertChain = createChain(enrollment);
      // Third call: insert module rows
      const moduleChain = createChain([]);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return idempotencyChain;
        if (callCount === 2) return insertChain;
        return moduleChain;
      });

      const result = await createPaidEnrollment('user-1', 'cus_123', 'pi_123');
      expect(result).toEqual(enrollment);
    });

    it('returns null on insert error', async () => {
      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        // First call: idempotency check (not found)
        if (callCount === 1) return createChain(null, { code: 'PGRST116' });
        // Second call: insert fails
        return createChain(null, { message: 'Unique constraint' });
      });

      const result = await createPaidEnrollment('user-1', 'cus_123', 'pi_123');
      expect(result).toBeNull();
    });

    it('calls initializeSystemSchedules with enrollment id after module creation', async () => {
      const enrollment = {
        id: 'e1',
        user_id: 'user-1',
        status: 'active',
        selected_modules: ['m0', 'm1'],
        stripe_customer_id: 'cus_123',
      };

      const idempotencyChain = createChain(null, { code: 'PGRST116' });
      const insertChain = createChain(enrollment);
      const moduleChain = createChain([]);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return idempotencyChain;
        if (callCount === 2) return insertChain;
        return moduleChain;
      });

      await createPaidEnrollment('user-1', 'cus_123', 'pi_123');
      expect(initializeSystemSchedules).toHaveBeenCalledWith('e1');
    });

    it('still returns enrollment when initializeSystemSchedules throws', async () => {
      const enrollment = {
        id: 'e2',
        user_id: 'user-2',
        status: 'active',
        selected_modules: ['m0'],
        stripe_customer_id: 'cus_456',
      };

      const idempotencyChain = createChain(null, { code: 'PGRST116' });
      const insertChain = createChain(enrollment);
      const moduleChain = createChain([]);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return idempotencyChain;
        if (callCount === 2) return insertChain;
        return moduleChain;
      });

      (initializeSystemSchedules as jest.Mock).mockRejectedValueOnce(new Error('schedule error'));

      const result = await createPaidEnrollment('user-2', 'cus_456', 'pi_456');
      expect(result).toEqual(enrollment);
    });

    it('returns existing enrollment when payment intent already processed (idempotent)', async () => {
      const existing = {
        id: 'e1',
        user_id: 'user-1',
        status: 'active',
        stripe_customer_id: 'cus_123',
      };

      // Idempotency check finds existing enrollment
      mockFrom.mockReturnValue(createChain(existing));

      const result = await createPaidEnrollment('user-1', 'cus_123', 'pi_123');
      expect(result).toEqual(existing);
      // Only 1 call — the idempotency lookup. No insert attempted.
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });

    it('recovers from 23505 race condition by falling back to lookup', async () => {
      const enrollment = {
        id: 'e1',
        user_id: 'user-1',
        status: 'active',
        stripe_customer_id: 'cus_123',
      };

      // Call 1: idempotency check — not found
      const idempotencyChain = createChain(null, { code: 'PGRST116' });
      // Call 2: insert fails with unique constraint (another webhook beat us)
      const insertChain = createChain(null, { code: '23505', message: 'duplicate key' });
      // Call 3: fallback lookup succeeds
      const fallbackChain = createChain(enrollment);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return idempotencyChain;
        if (callCount === 2) return insertChain;
        return fallbackChain;
      });

      const result = await createPaidEnrollment('user-1', 'cus_123', 'pi_123');
      expect(result).toEqual(enrollment);
      expect(mockFrom).toHaveBeenCalledTimes(3);
    });
  });
});
