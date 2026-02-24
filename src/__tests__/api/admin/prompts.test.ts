/**
 * Tests for the Admin Prompts API route handlers.
 * Validates auth (401) and super-admin gating (403).
 *
 * @jest-environment node
 */

// --- Mocks (must be before imports) ---

const mockAuth = jest.fn();
const mockIsSuperAdmin = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn(() => ({
  select: mockSelect,
}));

jest.mock('@/lib/auth', () => ({
  auth: mockAuth,
}));

jest.mock('@/lib/auth/super-admin', () => ({
  isSuperAdmin: mockIsSuperAdmin,
}));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

// --- Tests ---

describe('Admin Prompts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/prompts', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const { GET } = require('@/app/api/admin/prompts/route');
      const response = await GET();

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 when session has no user id', async () => {
      mockAuth.mockResolvedValue({ user: {} });

      const { GET } = require('@/app/api/admin/prompts/route');
      const response = await GET();

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'user-1', email: 'test@test.com' },
      });
      mockIsSuperAdmin.mockResolvedValue(false);

      const { GET } = require('@/app/api/admin/prompts/route');
      const response = await GET();

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
      expect(mockIsSuperAdmin).toHaveBeenCalledWith('user-1');
    });

    it('returns prompt list for super admin', async () => {
      const mockPrompts = [
        {
          slug: 'post-writer',
          name: 'Post Writer',
          category: 'content',
          description: 'Writes posts',
          model: 'claude-sonnet-4-20250514',
          is_active: true,
          updated_at: '2026-01-01T00:00:00Z',
        },
      ];

      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', email: 'admin@test.com' },
      });
      mockIsSuperAdmin.mockResolvedValue(true);

      // Chain: from('ai_prompt_templates').select(...).order(...).order(...)
      const secondOrder = jest.fn().mockResolvedValue({ data: mockPrompts, error: null });
      const firstOrder = jest.fn(() => ({ order: secondOrder }));
      mockSelect.mockReturnValue({ order: firstOrder });

      const { GET } = require('@/app/api/admin/prompts/route');
      const response = await GET();

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockPrompts);
      expect(mockFrom).toHaveBeenCalledWith('ai_prompt_templates');
    });

    it('returns 500 when database query fails', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', email: 'admin@test.com' },
      });
      mockIsSuperAdmin.mockResolvedValue(true);

      const secondOrder = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      const firstOrder = jest.fn(() => ({ order: secondOrder }));
      mockSelect.mockReturnValue({ order: firstOrder });

      const { GET } = require('@/app/api/admin/prompts/route');
      const response = await GET();

      expect(response.status).toBe(500);
      const body = await response.json();
      expect(body.error).toBe('Database error');
    });
  });
});
