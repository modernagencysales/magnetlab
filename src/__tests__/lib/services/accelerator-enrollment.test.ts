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

      // First call: insert enrollment
      const insertChain = createChain(enrollment);
      // Second call: insert module rows
      const moduleChain = createChain([]);

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        return callCount === 1 ? insertChain : moduleChain;
      });

      const result = await createPaidEnrollment('user-1', 'cus_123', 'pi_123');
      expect(result).toEqual(enrollment);
    });

    it('returns null on insert error', async () => {
      mockFrom.mockReturnValue(createChain(null, { message: 'Unique constraint' }));

      const result = await createPaidEnrollment('user-1', 'cus_123', 'pi_123');
      expect(result).toBeNull();
    });
  });
});
