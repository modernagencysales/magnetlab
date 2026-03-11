/**
 * @jest-environment node
 */

jest.mock('@/lib/services/accelerator-scheduler', () => ({
  getSchedulesByEnrollment: jest.fn(),
  createSchedule: jest.fn(),
  toggleSchedule: jest.fn(),
}));

jest.mock('@/lib/services/accelerator-program', () => ({
  getEnrollmentByUserId: jest.fn(),
  getProgramState: jest.fn(),
  updateModuleStatus: jest.fn(),
  createDeliverable: jest.fn(),
  updateDeliverableStatus: jest.fn(),
  getSopsByModule: jest.fn(),
  updateEnrollmentIntake: jest.fn(),
}));

jest.mock('@/lib/services/accelerator-validation', () => ({
  validateDeliverable: jest.fn(),
}));

jest.mock('@/lib/services/accelerator-usage', () => ({
  trackUsageEvent: jest.fn(),
}));

import { executeAction } from '@/lib/actions';
import {
  getSchedulesByEnrollment,
  createSchedule,
  toggleSchedule,
} from '@/lib/services/accelerator-scheduler';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';

import '@/lib/actions/schedules';

const ctx = { userId: 'user-1', teamId: null as unknown as string, sessionId: 'sess-1' };

describe('schedule actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEnrollmentByUserId as jest.Mock).mockResolvedValue({ id: 'enroll-1' });
  });

  it('list_schedules returns schedules for enrollment', async () => {
    (getSchedulesByEnrollment as jest.Mock).mockResolvedValue([
      { id: 's-1', task_type: 'collect_metrics', is_active: true },
    ]);
    const result = await executeAction(ctx, 'list_schedules', {});
    expect(result.success).toBe(true);
    expect(result.data.schedules).toHaveLength(1);
  });

  it('create_schedule creates and returns schedule', async () => {
    (createSchedule as jest.Mock).mockResolvedValue({ id: 's-new', task_type: 'weekly_digest' });
    const result = await executeAction(ctx, 'create_schedule', {
      task_type: 'weekly_digest',
      cron_expression: '0 9 * * 1',
    });
    expect(result.success).toBe(true);
    expect(result.data.task_type).toBe('weekly_digest');
  });

  it('toggle_schedule activates/deactivates', async () => {
    (getSchedulesByEnrollment as jest.Mock).mockResolvedValue([{ id: 's-1' }]);
    (toggleSchedule as jest.Mock).mockResolvedValue(true);
    const result = await executeAction(ctx, 'toggle_schedule', {
      schedule_id: 's-1',
      is_active: false,
    });
    expect(result.success).toBe(true);
  });

  it('toggle_schedule rejects non-owned schedule', async () => {
    (getSchedulesByEnrollment as jest.Mock).mockResolvedValue([{ id: 's-other' }]);
    const result = await executeAction(ctx, 'toggle_schedule', {
      schedule_id: 's-not-mine',
      is_active: false,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
