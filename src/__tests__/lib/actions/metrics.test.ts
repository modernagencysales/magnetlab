/**
 * @jest-environment node
 */

jest.mock('@/lib/services/accelerator-metrics', () => ({
  getLatestMetrics: jest.fn(),
  getMetricsSummary: jest.fn(),
  getMetricHistory: jest.fn(),
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
  getLatestMetrics,
  getMetricsSummary,
  getMetricHistory,
} from '@/lib/services/accelerator-metrics';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';

import '@/lib/actions/metrics';

const ctx = { userId: 'user-1', teamId: null as unknown as string, sessionId: 'sess-1' };

describe('metrics actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getEnrollmentByUserId as jest.Mock).mockResolvedValue({ id: 'enroll-1' });
  });

  it('get_metrics returns latest metrics', async () => {
    (getLatestMetrics as jest.Mock).mockResolvedValue([
      { metric_key: 'email_sent', value: 100, status: 'at' },
    ]);

    const result = await executeAction(ctx, 'get_metrics', {});
    expect(result.success).toBe(true);
    expect(result.data.metrics).toHaveLength(1);
  });

  it('get_metrics_summary returns grouped summary', async () => {
    (getMetricsSummary as jest.Mock).mockResolvedValue({
      modules: [{ module_id: 'm4', metrics: [], belowCount: 0 }],
      belowCount: 0,
      totalMetrics: 5,
    });

    const result = await executeAction(ctx, 'get_metrics_summary', {});
    expect(result.success).toBe(true);
    expect(result.data.totalMetrics).toBe(5);
  });

  it('get_metric_history returns trend data', async () => {
    (getMetricHistory as jest.Mock).mockResolvedValue([
      { value: 100, collected_at: '2026-03-10' },
      { value: 120, collected_at: '2026-03-11' },
    ]);

    const result = await executeAction(ctx, 'get_metric_history', {
      metric_key: 'email_sent',
      days: 7,
    });
    expect(result.success).toBe(true);
    expect(result.data.history).toHaveLength(2);
  });

  it('get_metrics fails without enrollment', async () => {
    (getEnrollmentByUserId as jest.Mock).mockResolvedValue(null);
    const result = await executeAction(ctx, 'get_metrics', {});
    expect(result.success).toBe(false);
  });
});
