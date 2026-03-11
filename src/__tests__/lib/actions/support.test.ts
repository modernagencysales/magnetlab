/**
 * @jest-environment node
 */

jest.mock('@/lib/utils/supabase-server');
jest.mock('@/lib/services/accelerator-program');
jest.mock('@/lib/utils/logger');

import { getAction } from '@/lib/actions/registry';

// Import the module to trigger registerAction calls
import '@/lib/actions/support';

import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import { logError } from '@/lib/utils/logger';
import type { ProgramEnrollment } from '@/lib/types/accelerator';

// ─── Mocks ────────────────────────────────────────────────

const mockGetEnrollment = getEnrollmentByUserId as jest.MockedFunction<
  typeof getEnrollmentByUserId
>;
const mockLogError = logError as jest.MockedFunction<typeof logError>;

const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockFrom = jest.fn(() => ({ insert: mockInsert }));

(getSupabaseAdminClient as jest.MockedFunction<typeof getSupabaseAdminClient>).mockReturnValue({
  from: mockFrom,
} as unknown as ReturnType<typeof getSupabaseAdminClient>);

const ctx = { userId: 'user-1' };

const mockEnrollment = {
  id: 'enrollment-1',
  user_id: 'user-1',
  status: 'active',
} as unknown as ProgramEnrollment;

// ─── Tests ────────────────────────────────────────────────

describe('create_support_ticket action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply the supabase mock after clearAllMocks
    mockFrom.mockReturnValue({ insert: mockInsert });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle });
    (getSupabaseAdminClient as jest.MockedFunction<typeof getSupabaseAdminClient>).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getSupabaseAdminClient>);
  });

  it('is registered', () => {
    const action = getAction('create_support_ticket');
    expect(action).toBeDefined();
    expect(action!.name).toBe('create_support_ticket');
  });

  it('requires summary and context params', () => {
    const action = getAction('create_support_ticket')!;
    expect(action.parameters).toEqual(
      expect.objectContaining({
        required: expect.arrayContaining(['summary', 'context']),
      })
    );
  });

  // ─── Happy Path ───────────────────────────────────────

  it('creates a ticket when user is enrolled', async () => {
    mockGetEnrollment.mockResolvedValue(mockEnrollment);
    const ticketData = {
      id: 'ticket-1',
      summary: 'Cannot generate lead magnet',
      status: 'open',
      created_at: '2026-03-11T00:00:00Z',
    };
    mockSingle.mockResolvedValue({ data: ticketData, error: null });

    const action = getAction('create_support_ticket')!;
    const result = await action.handler(ctx, {
      summary: 'Cannot generate lead magnet',
      context: { step: 'content_generation', tried: 'retry 3 times', error: 'timeout' },
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual(ticketData);
    expect(result.displayHint).toBe('text');
  });

  it('inserts ticket with correct params including enrollment_id', async () => {
    mockGetEnrollment.mockResolvedValue(mockEnrollment);
    mockSingle.mockResolvedValue({
      data: { id: 'ticket-1', summary: 'test', status: 'open', created_at: '' },
      error: null,
    });

    const action = getAction('create_support_ticket')!;
    await action.handler(ctx, {
      summary: 'test issue',
      context: { tried: 'nothing', error: 'unknown' },
      module_id: 'module-2',
    });

    expect(mockInsert).toHaveBeenCalledWith({
      enrollment_id: 'enrollment-1',
      module_id: 'module-2',
      summary: 'test issue',
      context: { tried: 'nothing', error: 'unknown' },
      status: 'open',
    });
  });

  it('sets module_id to null when not provided', async () => {
    mockGetEnrollment.mockResolvedValue(mockEnrollment);
    mockSingle.mockResolvedValue({
      data: { id: 'ticket-2', summary: 'no module', status: 'open', created_at: '' },
      error: null,
    });

    const action = getAction('create_support_ticket')!;
    await action.handler(ctx, {
      summary: 'no module issue',
      context: { tried: 'debugging', error: 'unknown' },
    });

    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ module_id: null }));
  });

  it('selects id, summary, status, created_at from inserted record', async () => {
    mockGetEnrollment.mockResolvedValue(mockEnrollment);
    mockSingle.mockResolvedValue({
      data: { id: 'ticket-1', summary: 'x', status: 'open', created_at: '' },
      error: null,
    });

    const action = getAction('create_support_ticket')!;
    await action.handler(ctx, { summary: 'x', context: {} });

    expect(mockSelect).toHaveBeenCalledWith('id, summary, status, created_at');
  });

  // ─── Not Enrolled ─────────────────────────────────────

  it('returns error when user has no enrollment', async () => {
    mockGetEnrollment.mockResolvedValue(null);

    const action = getAction('create_support_ticket')!;
    const result = await action.handler(ctx, {
      summary: 'some issue',
      context: { error: 'unknown' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('No active enrollment');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  // ─── Supabase Error ───────────────────────────────────

  it('returns error and logs when supabase insert fails', async () => {
    mockGetEnrollment.mockResolvedValue(mockEnrollment);
    const dbError = { message: 'insert failed', code: '23502' };
    mockSingle.mockResolvedValue({ data: null, error: dbError });

    const action = getAction('create_support_ticket')!;
    const result = await action.handler(ctx, {
      summary: 'broken',
      context: { step: 'intake' },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to create support ticket');
    expect(mockLogError).toHaveBeenCalledWith(
      'action/support',
      dbError,
      expect.objectContaining({ enrollmentId: 'enrollment-1' })
    );
  });
});
