/**
 * @jest-environment node
 */

jest.mock('@/lib/services/accelerator-enrollment');
jest.mock('@/lib/services/accelerator-program');
jest.mock('@/lib/services/accelerator-usage');

import { getAction } from '@/lib/actions/registry';

// Import the module to trigger registerAction calls
import '@/lib/actions/enrollment';

import { hasAcceleratorAccess } from '@/lib/services/accelerator-enrollment';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import { checkUsageAllocation } from '@/lib/services/accelerator-usage';
import type { ProgramEnrollment } from '@/lib/types/accelerator';

const mockHasAccess = hasAcceleratorAccess as jest.MockedFunction<typeof hasAcceleratorAccess>;
const mockGetEnrollment = getEnrollmentByUserId as jest.MockedFunction<
  typeof getEnrollmentByUserId
>;
const mockCheckUsage = checkUsageAllocation as jest.MockedFunction<typeof checkUsageAllocation>;

const ctx = { userId: 'user-1' };

describe('enrollment actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get_enrollment_status', () => {
    it('is registered', () => {
      const action = getAction('get_enrollment_status');
      expect(action).toBeDefined();
      expect(action!.name).toBe('get_enrollment_status');
    });

    it('returns enrolled status when user has access', async () => {
      mockHasAccess.mockResolvedValue(true);
      mockGetEnrollment.mockResolvedValue({
        id: 'e1',
        status: 'active',
        selected_modules: ['m0', 'm1'],
        coaching_mode: 'guide_me',
      } as unknown as ProgramEnrollment);

      const action = getAction('get_enrollment_status')!;
      const result = await action.handler(ctx, {});
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({ enrolled: true, status: 'active' }));
    });

    it('returns not enrolled when no access', async () => {
      mockHasAccess.mockResolvedValue(false);

      const action = getAction('get_enrollment_status')!;
      const result = await action.handler(ctx, {});
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({ enrolled: false }));
    });
  });

  describe('check_usage', () => {
    it('is registered', () => {
      const action = getAction('check_usage');
      expect(action).toBeDefined();
    });

    it('returns usage data for enrolled user', async () => {
      mockGetEnrollment.mockResolvedValue({
        id: 'e1',
        status: 'active',
      } as unknown as ProgramEnrollment);
      mockCheckUsage.mockResolvedValue({
        withinLimits: true,
        usage: { sessions: 5, deliverables: 2, api_calls: 50 },
        limits: { sessions: 30, deliverables: 15, api_calls: 500 },
      });

      const action = getAction('check_usage')!;
      const result = await action.handler(ctx, {});
      expect(result.success).toBe(true);
      expect(result.data).toEqual(expect.objectContaining({ withinLimits: true }));
    });

    it('returns error when not enrolled', async () => {
      mockGetEnrollment.mockResolvedValue(null);

      const action = getAction('check_usage')!;
      const result = await action.handler(ctx, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('No active enrollment');
    });
  });
});
