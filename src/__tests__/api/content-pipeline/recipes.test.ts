/**
 * @jest-environment node
 *
 * Tests for GET /api/content-pipeline/recipes
 */

import { GET } from '@/app/api/content-pipeline/recipes/route';
import { NextRequest } from 'next/server';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/server/services/mixer.service', () => ({
  getSuggestedRecipes: jest.fn(),
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
const EXPLOIT_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost:3000/api/content-pipeline/recipes');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new NextRequest(url.toString());
}

const MOCK_RECIPES = [
  {
    ingredients: [
      { type: 'exploits', id: EXPLOIT_ID, name: 'Tweet Commentary' },
      { type: 'knowledge', name: 'cold email' },
    ],
    combo_name: 'Tweet Commentary + cold email',
    multiplier: 1.0,
    post_count: 4,
    context: 'Used 2 times, 4 posts generated',
  },
];

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('GET /api/content-pipeline/recipes', () => {
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

    it('returns 400 when limit exceeds max (20)', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const response = await GET(
        makeRequest({
          team_profile_id: TEAM_PROFILE_ID,
          limit: '99',
        })
      );

      expect(response.status).toBe(400);
    });
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns 200 with recipes on valid request', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.getSuggestedRecipes as jest.Mock).mockResolvedValue(MOCK_RECIPES);

      const response = await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.recipes).toBeDefined();
      expect(data.recipes).toHaveLength(1);
      expect(data.recipes[0].combo_name).toBe('Tweet Commentary + cold email');
    });

    it('passes limit param to service (default 5)', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.getSuggestedRecipes as jest.Mock).mockResolvedValue([]);

      await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(mixerService.getSuggestedRecipes).toHaveBeenCalledWith(TEAM_PROFILE_ID, 5);
    });

    it('passes custom limit to service', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.getSuggestedRecipes as jest.Mock).mockResolvedValue([]);

      await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID, limit: '10' }));

      expect(mixerService.getSuggestedRecipes).toHaveBeenCalledWith(TEAM_PROFILE_ID, 10);
    });

    it('returns empty array when no recipes exist', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.getSuggestedRecipes as jest.Mock).mockResolvedValue([]);

      const response = await GET(makeRequest({ team_profile_id: TEAM_PROFILE_ID }));

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.recipes).toEqual([]);
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
});
