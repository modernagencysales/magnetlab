/**
 * @jest-environment node
 *
 * Tests for GET /api/content-pipeline/inventory
 */

import { GET } from '@/app/api/content-pipeline/inventory/route';
import { NextRequest } from 'next/server';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/server/services/mixer.service', () => ({
  getInventory: jest.fn(),
  getStatusCode: jest.fn((err: unknown) => {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      return (err as { statusCode: number }).statusCode;
    }
    return 500;
  }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { auth } from '@/lib/auth';
import * as mixerService from '@/server/services/mixer.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEAM_PROFILE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/content-pipeline/inventory');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

const MOCK_INVENTORY = {
  team_profile_id: TEAM_PROFILE_ID,
  ingredients: [
    {
      type: 'knowledge',
      count: 12,
      health: 'healthy',
      health_detail: 'Strong knowledge base',
      sub_label: '3 topics',
    },
    {
      type: 'exploits',
      count: 8,
      health: 'healthy',
      health_detail: 'Good exploit library',
      sub_label: null,
    },
    { type: 'styles', count: 2, health: 'active', health_detail: '1 active', sub_label: null },
    { type: 'templates', count: 5, health: null, health_detail: null, sub_label: null },
    { type: 'creatives', count: 3, health: 'new', health_detail: '2 new', sub_label: null },
    { type: 'trends', count: 4, health: null, health_detail: null, sub_label: 'Last 7 days' },
    { type: 'recycled', count: 10, health: null, health_detail: null, sub_label: null },
  ],
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('GET /api/content-pipeline/inventory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────

  describe('auth', () => {
    it('returns 401 when not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const response = await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  // ─── Validation ───────────────────────────────────────────────────────────

  describe('input validation', () => {
    it('returns 400 when team_profile_id is missing', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const response = await GET(makeRequest());

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('returns 400 when team_profile_id is not a valid UUID', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const response = await GET(makeRequest({ team_profile_id: 'not-a-uuid' }));

      expect(response.status).toBe(400);
    });
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns 200 with inventory on valid request', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.getInventory as jest.Mock).mockResolvedValue(MOCK_INVENTORY);

      const response = await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.inventory).toBeDefined();
      expect(data.inventory.team_profile_id).toBe(TEAM_PROFILE_ID);
      expect(data.inventory.ingredients).toHaveLength(7);
    });

    it('calls getInventory with correct team_profile_id', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.getInventory as jest.Mock).mockResolvedValue(MOCK_INVENTORY);

      await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(mixerService.getInventory).toHaveBeenCalledWith(TEAM_PROFILE_ID);
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns 404 when team profile is not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const notFoundError = Object.assign(new Error('Team profile not found'), { statusCode: 404 });
      (mixerService.getInventory as jest.Mock).mockRejectedValue(notFoundError);

      const response = await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Team profile not found');
    });

    it('returns 500 when service throws unknown error', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.getInventory as jest.Mock).mockRejectedValue(new Error('DB failure'));

      const response = await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});
