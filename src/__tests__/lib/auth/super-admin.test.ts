/**
 * @jest-environment node
 */

// Mock supabase before importing the module under test
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({ from: mockFrom }),
}));

import { isSuperAdmin } from '@/lib/auth/super-admin';

describe('isSuperAdmin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
  });

  it('returns true for super admin user', async () => {
    mockSingle.mockResolvedValue({ data: { is_super_admin: true }, error: null });
    const result = await isSuperAdmin('user-123');
    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('users');
  });

  it('returns false for regular user', async () => {
    mockSingle.mockResolvedValue({ data: { is_super_admin: false }, error: null });
    const result = await isSuperAdmin('user-456');
    expect(result).toBe(false);
  });

  it('returns false on database error', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const result = await isSuperAdmin('user-789');
    expect(result).toBe(false);
  });

  it('returns false for non-existent user', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null });
    const result = await isSuperAdmin('non-existent');
    expect(result).toBe(false);
  });
});
