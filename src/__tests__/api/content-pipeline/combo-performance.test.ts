/**
 * @jest-environment node
 *
 * Tests for GET /api/content-pipeline/combo-performance
 */

import { GET } from '@/app/api/content-pipeline/combo-performance/route';
import { NextRequest } from 'next/server';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/server/services/mixer.service', () => ({
  verifyAccess: jest.fn(),
  getComboPerformance: jest.fn(),
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
  const url = new URL('http://localhost:3000/api/content-pipeline/combo-performance');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

const MOCK_COMBOS = [
  {
    exploit_name: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    knowledge_topic: 'cold email',
    style_name: null,
    template_name: null,
    avg_engagement: 42.5,
    multiplier: 1.8,
    post_count: 5,
    last_used: '2026-03-19T10:00:00Z',
  },
  {
    exploit_name: null,
    knowledge_topic: 'LinkedIn strategy',
    style_name: null,
    template_name: null,
    avg_engagement: 30.0,
    multiplier: 1.2,
    post_count: 3,
    last_used: '2026-03-18T10:00:00Z',
  },
];

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('GET /api/content-pipeline/combo-performance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

      const response = await GET(makeRequest({ team_profile_id: 'bad-id' }));

      expect(response.status).toBe(400);
    });

    it('returns 400 when limit exceeds max (50)', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const response = await GET(
        makeRequest({
          team_profile_id: TEAM_PROFILE_ID,
          limit: '100',
        })
      );

      expect(response.status).toBe(400);
    });
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns 200 with performance data on valid request', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.getComboPerformance as jest.Mock).mockResolvedValue(MOCK_COMBOS);

      const response = await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.combos).toBeDefined();
      expect(data.combos).toHaveLength(2);
      expect(data.combos[0].multiplier).toBe(1.8);
    });

    it('passes limit param to service (default 10)', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.getComboPerformance as jest.Mock).mockResolvedValue([]);

      await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(mixerService.getComboPerformance).toHaveBeenCalledWith(TEAM_PROFILE_ID, 10);
    });

    it('passes custom limit to service', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.getComboPerformance as jest.Mock).mockResolvedValue([]);

      await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID, limit: '25' }));

      expect(mixerService.getComboPerformance).toHaveBeenCalledWith(TEAM_PROFILE_ID, 25);
    });

    it('returns empty array when no combos exist', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.getComboPerformance as jest.Mock).mockResolvedValue([]);

      const response = await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.combos).toEqual([]);
    });
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────

  describe('auth', () => {
    it('returns 401 when not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const response = await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(response.status).toBe(401);
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns service statusCode on known error', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const serviceError = Object.assign(new Error('Failed to fetch combo performance'), {
        statusCode: 500,
      });
      (mixerService.getComboPerformance as jest.Mock).mockRejectedValue(serviceError);

      const response = await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});
