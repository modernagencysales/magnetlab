/**
 * @jest-environment node
 *
 * Tests for POST /api/content-pipeline/mix
 */

import { POST } from '@/app/api/content-pipeline/mix/route';
import { NextRequest } from 'next/server';

// ─── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/server/services/mixer.service', () => ({
  mix: jest.fn(),
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
const RECIPE_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/content-pipeline/mix', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const MOCK_DRAFTS_RESULT = {
  type: 'drafts' as const,
  drafts: [
    { content: 'Cold email is not dead.', hook_used: 'bold', ai_pick: true, recipe_id: RECIPE_ID },
    {
      content: 'Here is what nobody tells you.',
      hook_used: 'curiosity',
      ai_pick: false,
      recipe_id: RECIPE_ID,
    },
  ],
  recipe_id: RECIPE_ID,
};

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('POST /api/content-pipeline/mix', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────

  describe('auth', () => {
    it('returns 401 when not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const response = await POST(
        makeRequest({
          team_profile_id: TEAM_PROFILE_ID,
          exploit_id: EXPLOIT_ID,
        })
      );

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  // ─── Validation ───────────────────────────────────────────────────────────

  describe('input validation', () => {
    it('returns 400 when no ingredients are provided', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const response = await POST(
        makeRequest({
          team_profile_id: TEAM_PROFILE_ID,
          // no ingredient fields — refine check fails
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('returns 400 when team_profile_id is missing', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const response = await POST(
        makeRequest({
          exploit_id: EXPLOIT_ID,
          // missing team_profile_id
        })
      );

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('returns 400 when team_profile_id is not a valid UUID', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const response = await POST(
        makeRequest({
          team_profile_id: 'not-a-uuid',
          exploit_id: EXPLOIT_ID,
        })
      );

      expect(response.status).toBe(400);
    });

    it('returns 400 when count exceeds max (5)', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const response = await POST(
        makeRequest({
          team_profile_id: TEAM_PROFILE_ID,
          exploit_id: EXPLOIT_ID,
          count: 10,
        })
      );

      expect(response.status).toBe(400);
    });
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns 201 with drafts on valid request', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.mix as jest.Mock).mockResolvedValue(MOCK_DRAFTS_RESULT);

      const response = await POST(
        makeRequest({
          team_profile_id: TEAM_PROFILE_ID,
          exploit_id: EXPLOIT_ID,
        })
      );

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.type).toBe('drafts');
      expect(data.drafts).toHaveLength(2);
      expect(data.recipe_id).toBe(RECIPE_ID);
    });

    it('calls mix service with validated input', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.mix as jest.Mock).mockResolvedValue(MOCK_DRAFTS_RESULT);

      await POST(
        makeRequest({
          team_profile_id: TEAM_PROFILE_ID,
          exploit_id: EXPLOIT_ID,
          count: 2,
          output: 'ideas',
        })
      );

      expect(mixerService.mix).toHaveBeenCalledWith(
        expect.objectContaining({
          team_profile_id: TEAM_PROFILE_ID,
          exploit_id: EXPLOIT_ID,
          count: 2,
          output: 'ideas',
        })
      );
    });
  });

  // ─── Error handling ───────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns service statusCode when service throws a known error', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const serviceError = Object.assign(new Error('Team profile not found'), { statusCode: 404 });
      (mixerService.mix as jest.Mock).mockRejectedValue(serviceError);

      const response = await POST(
        makeRequest({
          team_profile_id: TEAM_PROFILE_ID,
          exploit_id: EXPLOIT_ID,
        })
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Team profile not found');
    });

    it('returns 500 when service throws an unknown error', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (mixerService.mix as jest.Mock).mockRejectedValue(new Error('Unexpected failure'));

      const response = await POST(
        makeRequest({
          team_profile_id: TEAM_PROFILE_ID,
          exploit_id: EXPLOIT_ID,
        })
      );

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });

    it('returns 502 when AI generation fails', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const aiError = Object.assign(new Error('AI generation failed'), { statusCode: 502 });
      (mixerService.mix as jest.Mock).mockRejectedValue(aiError);

      const response = await POST(
        makeRequest({
          team_profile_id: TEAM_PROFILE_ID,
          exploit_id: EXPLOIT_ID,
        })
      );

      expect(response.status).toBe(502);
    });
  });
});
