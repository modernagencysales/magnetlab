/**
 * Tests for the Admin Prompts API route handlers.
 * Validates auth (401) and super-admin gating (403).
 *
 * @jest-environment node
 */

// --- Mocks (must be before imports) ---

// Use inline jest.fn() to avoid hoisting issues with const declarations
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/auth/super-admin', () => ({
  isSuperAdmin: jest.fn(),
}));

// Mock adminService.listPrompts() — the route now delegates to it
jest.mock('@/server/services/admin.service', () => ({
  listPrompts: jest.fn(),
}));

// Import after mocks are set up
import { GET } from '@/app/api/admin/prompts/route';
import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as adminService from '@/server/services/admin.service';

const mockAuth = auth as jest.Mock;
const mockIsSuperAdmin = isSuperAdmin as jest.Mock;
const mockListPrompts = adminService.listPrompts as jest.Mock;

// --- Tests ---

describe('Admin Prompts API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/prompts', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await GET();

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 when session has no user id', async () => {
      mockAuth.mockResolvedValue({ user: {} });

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
      mockListPrompts.mockResolvedValue(mockPrompts);

      const response = await GET();

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual(mockPrompts);
      expect(mockListPrompts).toHaveBeenCalledTimes(1);
    });

    it('throws when service throws (no try/catch in route)', async () => {
      mockAuth.mockResolvedValue({
        user: { id: 'admin-1', email: 'admin@test.com' },
      });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockListPrompts.mockRejectedValue(new Error('Database error'));

      await expect(GET()).rejects.toThrow('Database error');
    });
  });
});
