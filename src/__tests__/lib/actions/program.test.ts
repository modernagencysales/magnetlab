/**
 * @jest-environment node
 */

// Mock all service dependencies
jest.mock('@/lib/services/accelerator-program');
jest.mock('@/lib/services/accelerator-validation');
jest.mock('@/lib/services/accelerator-usage');

import { getAction } from '@/lib/actions/registry';

// Import the module to trigger registerAction calls
import '@/lib/actions/program';

import { getProgramState, updateModuleStatus } from '@/lib/services/accelerator-program';
import { validateDeliverable } from '@/lib/services/accelerator-validation';
import type { ProgramState, ProgramModule } from '@/lib/types/accelerator';

const mockGetProgramState = getProgramState as jest.MockedFunction<typeof getProgramState>;
const mockUpdateModuleStatus = updateModuleStatus as jest.MockedFunction<typeof updateModuleStatus>;
const mockValidateDeliverable = validateDeliverable as jest.MockedFunction<
  typeof validateDeliverable
>;

const ctx = { userId: 'user-1' };

describe('program actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('get_program_state', () => {
    it('is registered', () => {
      const action = getAction('get_program_state');
      expect(action).toBeDefined();
      expect(action!.name).toBe('get_program_state');
    });

    it('returns program state for enrolled user', async () => {
      const state = {
        enrollment: { id: 'e1', status: 'active' },
        modules: [],
        deliverables: [],
        reviewQueue: [],
        usageThisPeriod: { sessions: 0, deliverables: 0, api_calls: 0 },
      };
      mockGetProgramState.mockResolvedValue(state as unknown as ProgramState);

      const action = getAction('get_program_state')!;
      const result = await action.handler(ctx, {});
      expect(result.success).toBe(true);
      expect(result.data).toEqual(state);
    });

    it('returns error when no enrollment', async () => {
      mockGetProgramState.mockResolvedValue(null);

      const action = getAction('get_program_state')!;
      const result = await action.handler(ctx, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('No active enrollment');
    });
  });

  describe('update_module_progress', () => {
    it('is registered', () => {
      const action = getAction('update_module_progress');
      expect(action).toBeDefined();
    });

    it('updates module status', async () => {
      mockUpdateModuleStatus.mockResolvedValue({
        id: 'mod1',
        status: 'active',
      } as unknown as ProgramModule);

      const action = getAction('update_module_progress')!;
      const result = await action.handler(ctx, { module_id: 'mod1', status: 'active' });
      expect(result.success).toBe(true);
    });
  });

  describe('validate_deliverable', () => {
    it('is registered', () => {
      const action = getAction('validate_deliverable');
      expect(action).toBeDefined();
    });

    it('runs validation and updates deliverable', async () => {
      mockValidateDeliverable.mockResolvedValue({
        passed: true,
        checks: [{ check: 'Test', passed: true, severity: 'critical' }],
        feedback: 'All passed',
      });

      const action = getAction('validate_deliverable')!;
      const result = await action.handler(ctx, {
        deliverable_id: 'd1',
        content: 'test content',
        quality_bars: [{ check: 'Test', severity: 'critical' }],
      });
      expect(result.success).toBe(true);
      expect(result.displayHint).toBe('quality_check');
    });
  });
});
