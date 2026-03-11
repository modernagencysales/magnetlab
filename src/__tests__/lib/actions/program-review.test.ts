/**
 * @jest-environment node
 */

jest.mock('@/lib/services/accelerator-program', () => ({
  getProgramState: jest.fn(),
  getEnrollmentByUserId: jest.fn(),
  getDeliverablesByEnrollment: jest.fn(),
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
  getEnrollmentByUserId,
  getDeliverablesByEnrollment,
  updateDeliverableStatus,
} from '@/lib/services/accelerator-program';

import '@/lib/actions/program';

const ctx = { userId: 'user-1', teamId: null, sessionId: 'sess-1' };

describe('review queue actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: user has enrollment and deliverable
    (getEnrollmentByUserId as jest.Mock).mockResolvedValue({ id: 'enroll-1' });
    (getDeliverablesByEnrollment as jest.Mock).mockResolvedValue([
      { id: 'd-1', enrollment_id: 'enroll-1' },
    ]);
  });

  it('approve_review_item sets status to approved', async () => {
    (updateDeliverableStatus as jest.Mock).mockResolvedValue({ id: 'd-1', status: 'approved' });
    const result = await executeAction(ctx, 'approve_review_item', { deliverable_id: 'd-1' });
    expect(result.success).toBe(true);
    expect(updateDeliverableStatus).toHaveBeenCalledWith('d-1', 'approved');
  });

  it('reject_review_item sets status to rejected with feedback', async () => {
    (updateDeliverableStatus as jest.Mock).mockResolvedValue({ id: 'd-1', status: 'rejected' });
    const result = await executeAction(ctx, 'reject_review_item', {
      deliverable_id: 'd-1',
      feedback: 'Needs more detail',
    });
    expect(result.success).toBe(true);
    expect(updateDeliverableStatus).toHaveBeenCalledWith(
      'd-1',
      'rejected',
      expect.objectContaining({ feedback: 'Needs more detail' })
    );
  });

  it('approve_review_item fails without enrollment', async () => {
    (getEnrollmentByUserId as jest.Mock).mockResolvedValue(null);
    const result = await executeAction(ctx, 'approve_review_item', { deliverable_id: 'd-1' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('enrollment');
  });

  it('approve_review_item rejects deliverable from other enrollment', async () => {
    (getDeliverablesByEnrollment as jest.Mock).mockResolvedValue([
      { id: 'd-other', enrollment_id: 'enroll-1' },
    ]);
    const result = await executeAction(ctx, 'approve_review_item', { deliverable_id: 'd-bad' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});
