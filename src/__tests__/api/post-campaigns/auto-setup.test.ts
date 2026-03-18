/**
 * @jest-environment node
 *
 * API route tests for POST /api/post-campaigns/auto-setup.
 * Tests auth, validation, post-not-found, and successful AI analysis.
 */

import { NextRequest } from 'next/server';

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

const mockGetDataScope = jest.fn();
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: (...args: unknown[]) => mockGetDataScope(...args),
}));

const mockAutoSetupCampaign = jest.fn();
jest.mock('@/server/services/post-campaigns.service', () => ({
  autoSetupCampaign: (...args: unknown[]) => mockAutoSetupCampaign(...args),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body?: unknown) {
  const opts: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  return new NextRequest(new URL('/api/post-campaigns/auto-setup', 'http://localhost:3000'), opts);
}

const MOCK_SCOPE = { type: 'team' as const, userId: 'u1', teamId: 'team-1' };

const MOCK_RESULT = {
  keyword: 'GUIDE',
  funnelPageId: 'funnel-1',
  funnelName: 'GTM Guide',
  deliveryAccountId: 'acc-1',
  deliveryAccountName: 'Tim',
  posterAccountId: 'acc-2',
  replyTemplate: 'Hey {{name}}! Just sent you a connection request',
  dmTemplate: 'Hey {{name}}, here is: {{funnel_url}}',
  confidence: 'high',
  needsUserInput: [],
};

// ─── Tests ──────────────────────────────────────────────────────────────

describe('POST /api/post-campaigns/auto-setup', () => {
  let POST: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/post-campaigns/auto-setup/route');
    POST = mod.POST;
  });

  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ post_id: 'post-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when post_id is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('post_id');
  });

  it('returns 400 when post_id is not a string', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await POST(makeRequest({ post_id: 123 }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when post not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue(MOCK_SCOPE);
    mockAutoSetupCampaign.mockRejectedValue(
      Object.assign(new Error('Post not found'), { statusCode: 404 })
    );

    const res = await POST(makeRequest({ post_id: 'nonexistent' }));
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toContain('not found');
  });

  it('returns AutoSetupResult on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue(MOCK_SCOPE);
    mockAutoSetupCampaign.mockResolvedValue(MOCK_RESULT);

    const res = await POST(makeRequest({ post_id: 'post-1' }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.keyword).toBe('GUIDE');
    expect(json.funnelPageId).toBe('funnel-1');
    expect(json.confidence).toBe('high');
    expect(json.needsUserInput).toEqual([]);
  });

  it('passes scope and post_id to service', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue(MOCK_SCOPE);
    mockAutoSetupCampaign.mockResolvedValue(MOCK_RESULT);

    await POST(makeRequest({ post_id: 'post-1' }));

    expect(mockGetDataScope).toHaveBeenCalledWith('u1');
    expect(mockAutoSetupCampaign).toHaveBeenCalledWith(MOCK_SCOPE, 'post-1');
  });

  it('returns 500 for unexpected errors', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue(MOCK_SCOPE);
    mockAutoSetupCampaign.mockRejectedValue(new Error('AI service down'));

    const res = await POST(makeRequest({ post_id: 'post-1' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toContain('auto-setup');
  });
});
