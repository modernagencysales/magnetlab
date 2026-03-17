/**
 * Tests for the Creative Strategy Signals API route handlers.
 * Validates auth (401), super-admin gating (403), validation (400), and happy paths.
 *
 * @jest-environment node
 */

// --- Mocks (must be before imports) ---

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/auth/super-admin', () => ({
  isSuperAdmin: jest.fn(),
}));

jest.mock('@/server/services/cs-signals.service', () => ({
  listSignals: jest.fn(),
  submitSignal: jest.fn(),
  reviewSignal: jest.fn(),
  getStatusCode: jest.fn().mockReturnValue(500),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

// --- Imports (after mocks) ---

import { auth } from '@/lib/auth';
import { isSuperAdmin } from '@/lib/auth/super-admin';
import * as signalsService from '@/server/services/cs-signals.service';
import { GET, POST } from '@/app/api/creative-strategy/signals/route';
import { PATCH } from '@/app/api/creative-strategy/signals/[id]/route';

const mockAuth = auth as jest.Mock;
const mockIsSuperAdmin = isSuperAdmin as jest.Mock;
const mockListSignals = signalsService.listSignals as jest.Mock;
const mockSubmitSignal = signalsService.submitSignal as jest.Mock;
const mockReviewSignal = signalsService.reviewSignal as jest.Mock;
const mockGetStatusCode = signalsService.getStatusCode as jest.Mock;

// --- Test data ---

const mockSignal = {
  id: 'sig-1',
  source: 'manual',
  source_account_id: null,
  linkedin_url: 'https://linkedin.com/feed/update/urn:li:activity:123',
  content: 'Test post about GTM strategy',
  author_name: 'John Doe',
  author_headline: null,
  author_follower_count: null,
  media_type: 'none',
  media_description: null,
  media_urls: [],
  impressions: null,
  likes: 100,
  comments: 20,
  shares: null,
  engagement_multiplier: null,
  niche: null,
  status: 'pending',
  ai_analysis: null,
  submitted_by: 'user-1',
  created_at: '2026-03-11T00:00:00Z',
};

// --- Helpers ---

function buildRequest(url: string, body?: object, method = 'GET') {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// --- Tests ---

describe('Creative Strategy Signals API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/creative-strategy/signals ─────────────────────────────────

  describe('GET /api/creative-strategy/signals', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await GET(buildRequest('http://localhost/api/creative-strategy/signals'));

      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('returns 401 when session has no user id', async () => {
      mockAuth.mockResolvedValue({ user: {} });

      const response = await GET(buildRequest('http://localhost/api/creative-strategy/signals'));

      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await GET(buildRequest('http://localhost/api/creative-strategy/signals'));

      expect(response.status).toBe(403);
      const body = await response.json();
      expect(body.error).toBe('Forbidden');
    });

    it('returns signals for authenticated super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockListSignals.mockResolvedValue({
        signals: [mockSignal],
        total: 1,
        limit: 50,
        offset: 0,
      });

      const response = await GET(buildRequest('http://localhost/api/creative-strategy/signals'));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.signals).toHaveLength(1);
      expect(body.total).toBe(1);
    });

    it('passes query params as filters', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockListSignals.mockResolvedValue({
        signals: [],
        total: 0,
        limit: 10,
        offset: 0,
      });

      const url = 'http://localhost/api/creative-strategy/signals?status=pending&limit=10';
      const response = await GET(buildRequest(url));

      expect(response.status).toBe(200);
      expect(mockListSignals).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending', limit: 10 })
      );
    });
  });

  // ─── POST /api/creative-strategy/signals ────────────────────────────────

  describe('POST /api/creative-strategy/signals', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const response = await POST(
        buildRequest('http://localhost/api/creative-strategy/signals', { content: 'test' }, 'POST')
      );

      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const response = await POST(
        buildRequest(
          'http://localhost/api/creative-strategy/signals',
          { content: 'test', author_name: 'John' },
          'POST'
        )
      );

      expect(response.status).toBe(403);
    });

    it('returns 400 for invalid body (missing required fields)', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);

      const response = await POST(
        buildRequest('http://localhost/api/creative-strategy/signals', {}, 'POST')
      );

      expect(response.status).toBe(400);
    });

    it('returns 400 when linkedin_url is missing', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);

      const response = await POST(
        buildRequest(
          'http://localhost/api/creative-strategy/signals',
          { content: 'Great post', author_name: 'John' },
          'POST'
        )
      );

      expect(response.status).toBe(400);
    });

    it('creates signal for valid input', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockSubmitSignal.mockResolvedValue(mockSignal);

      const response = await POST(
        buildRequest(
          'http://localhost/api/creative-strategy/signals',
          {
            content: 'Great post about GTM strategy',
            author_name: 'John Doe',
            linkedin_url: 'https://linkedin.com/feed/update/urn:li:activity:123',
          },
          'POST'
        )
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.id).toBe('sig-1');
      expect(mockSubmitSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Great post about GTM strategy',
          author_name: 'John Doe',
          linkedin_url: 'https://linkedin.com/feed/update/urn:li:activity:123',
        }),
        'user-1'
      );
    });

    it('returns service error status code on known error', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      const error = Object.assign(new Error('Signal with this URL already exists'), {
        statusCode: 409,
      });
      mockSubmitSignal.mockRejectedValue(error);
      mockGetStatusCode.mockReturnValue(409);

      const response = await POST(
        buildRequest(
          'http://localhost/api/creative-strategy/signals',
          {
            content: 'Duplicate post',
            author_name: 'John',
            linkedin_url: 'https://linkedin.com/feed/update/urn:li:activity:123',
          },
          'POST'
        )
      );

      expect(response.status).toBe(409);
    });
  });

  // ─── PATCH /api/creative-strategy/signals/[id] ──────────────────────────

  describe('PATCH /api/creative-strategy/signals/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      mockAuth.mockResolvedValue(null);

      const request = buildRequest(
        'http://localhost/api/creative-strategy/signals/sig-1',
        { status: 'dismissed' },
        'PATCH'
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: 'sig-1' }) });

      expect(response.status).toBe(401);
    });

    it('returns 403 when user is not a super admin', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(false);

      const request = buildRequest(
        'http://localhost/api/creative-strategy/signals/sig-1',
        { status: 'reviewed' },
        'PATCH'
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: 'sig-1' }) });

      expect(response.status).toBe(403);
    });

    it('returns 400 for invalid status', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);

      const request = buildRequest(
        'http://localhost/api/creative-strategy/signals/sig-1',
        { status: 'invalid' },
        'PATCH'
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: 'sig-1' }) });

      expect(response.status).toBe(400);
    });

    it('updates signal status', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      mockReviewSignal.mockResolvedValue({ ...mockSignal, status: 'dismissed' });

      const request = buildRequest(
        'http://localhost/api/creative-strategy/signals/sig-1',
        { status: 'dismissed' },
        'PATCH'
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: 'sig-1' }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.status).toBe('dismissed');
      expect(mockReviewSignal).toHaveBeenCalledWith('sig-1', 'dismissed');
    });

    it('returns service error status code on known error', async () => {
      mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
      mockIsSuperAdmin.mockResolvedValue(true);
      const error = Object.assign(new Error('Signal not found'), { statusCode: 404 });
      mockReviewSignal.mockRejectedValue(error);
      mockGetStatusCode.mockReturnValue(404);

      const request = buildRequest(
        'http://localhost/api/creative-strategy/signals/sig-1',
        { status: 'reviewed' },
        'PATCH'
      );
      const response = await PATCH(request, { params: Promise.resolve({ id: 'sig-1' }) });

      expect(response.status).toBe(404);
    });
  });
});
