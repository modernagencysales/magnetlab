/**
 * @jest-environment node
 *
 * API route tests for /api/post-campaigns.
 * Tests auth, Zod validation, status filtering, ALLOWED_UPDATE_FIELDS.
 */

import { NextRequest } from 'next/server';

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

const mockListCampaigns = jest.fn();
const mockGetCampaign = jest.fn();
const mockCreateCampaign = jest.fn();
const mockUpdateCampaign = jest.fn();
const mockDeleteCampaign = jest.fn();
const mockActivateCampaign = jest.fn();
const mockPauseCampaign = jest.fn();

jest.mock('@/server/services/post-campaigns.service', () => ({
  listCampaigns: (...args: unknown[]) => mockListCampaigns(...args),
  getCampaign: (...args: unknown[]) => mockGetCampaign(...args),
  createCampaign: (...args: unknown[]) => mockCreateCampaign(...args),
  updateCampaign: (...args: unknown[]) => mockUpdateCampaign(...args),
  deleteCampaign: (...args: unknown[]) => mockDeleteCampaign(...args),
  activateCampaign: (...args: unknown[]) => mockActivateCampaign(...args),
  pauseCampaign: (...args: unknown[]) => mockPauseCampaign(...args),
  getStatusCode: (err: unknown) => {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      return (err as { statusCode: number }).statusCode;
    }
    return 500;
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────

function makeRequest(url: string, method = 'GET', body?: unknown) {
  const opts: RequestInit = { method, headers: { 'content-type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  return new NextRequest(new URL(url, 'http://localhost:3000'), opts);
}

const VALID_CREATE = {
  name: 'Test Campaign',
  post_url: 'https://www.linkedin.com/posts/test-123',
  keywords: ['interested'],
  unipile_account_id: 'acc_123',
  dm_template: 'Hey {{name}}',
};

const MOCK_CAMPAIGN = {
  id: 'cam-1',
  name: 'Test Campaign',
  status: 'draft',
  created_at: '2026-03-17T00:00:00Z',
};

// ─── Tests: POST /api/post-campaigns ────────────────────────────────────

describe('POST /api/post-campaigns', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/post-campaigns/route');
    POST = mod.POST;
  });

  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest('/api/post-campaigns', 'POST', VALID_CREATE));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (missing required fields)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await POST(makeRequest('/api/post-campaigns', 'POST', {}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid post_url', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await POST(
      makeRequest('/api/post-campaigns', 'POST', { ...VALID_CREATE, post_url: 'not-a-url' })
    );
    expect(res.status).toBe(400);
  });

  it('returns 201 on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockCreateCampaign.mockResolvedValue({ success: true, data: MOCK_CAMPAIGN });
    const res = await POST(makeRequest('/api/post-campaigns', 'POST', VALID_CREATE));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.campaign.id).toBe('cam-1');
  });
});

// ─── Tests: GET /api/post-campaigns ─────────────────────────────────────

describe('GET /api/post-campaigns', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/post-campaigns/route');
    GET = mod.GET;
  });

  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest('/api/post-campaigns'));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid status filter', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await GET(makeRequest('/api/post-campaigns?status=invalid'));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid status');
  });

  it('returns campaigns on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockListCampaigns.mockResolvedValue({ success: true, data: [MOCK_CAMPAIGN] });
    const res = await GET(makeRequest('/api/post-campaigns'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.campaigns).toHaveLength(1);
  });

  it('passes status filter to service', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockListCampaigns.mockResolvedValue({ success: true, data: [] });
    await GET(makeRequest('/api/post-campaigns?status=active'));
    expect(mockListCampaigns).toHaveBeenCalledWith('u1', 'active');
  });
});

// ─── Tests: PATCH /api/post-campaigns/[id] ──────────────────────────────

describe('PATCH /api/post-campaigns/[id]', () => {
  let PATCH: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/post-campaigns/[id]/route');
    PATCH = mod.PATCH;
  });

  beforeEach(() => jest.clearAllMocks());

  const params = { params: Promise.resolve({ id: 'cam-1' }) };

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makeRequest('/api/post-campaigns/cam-1', 'PATCH', {}), params);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid status in body', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await PATCH(
      makeRequest('/api/post-campaigns/cam-1', 'PATCH', { status: 'invalid' }),
      params
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid daily_dm_limit', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    const res = await PATCH(
      makeRequest('/api/post-campaigns/cam-1', 'PATCH', { daily_dm_limit: 100 }),
      params
    );
    expect(res.status).toBe(400);
  });

  it('passes validated data to service on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockUpdateCampaign.mockResolvedValue({ success: true, data: MOCK_CAMPAIGN });
    const res = await PATCH(
      makeRequest('/api/post-campaigns/cam-1', 'PATCH', { name: 'New Name', status: 'active' }),
      params
    );
    expect(res.status).toBe(200);
    expect(mockUpdateCampaign).toHaveBeenCalledWith('u1', 'cam-1', {
      name: 'New Name',
      status: 'active',
    });
  });

  it('strips unknown fields via Zod schema', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockUpdateCampaign.mockResolvedValue({ success: true, data: MOCK_CAMPAIGN });
    await PATCH(
      makeRequest('/api/post-campaigns/cam-1', 'PATCH', {
        name: 'New Name',
        user_id: 'hacked',
        team_id: 'hacked',
      }),
      params
    );
    expect(mockUpdateCampaign).toHaveBeenCalledWith('u1', 'cam-1', { name: 'New Name' });
  });
});

// ─── Tests: POST activate/pause ─────────────────────────────────────────

describe('POST /api/post-campaigns/[id]/activate', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/post-campaigns/[id]/activate/route');
    POST = mod.POST;
  });

  beforeEach(() => jest.clearAllMocks());

  const params = { params: Promise.resolve({ id: 'cam-1' }) };

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest('/api/post-campaigns/cam-1/activate', 'POST'), params);
    expect(res.status).toBe(401);
  });

  it('returns 404 when campaign not found', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockActivateCampaign.mockResolvedValue({
      success: false,
      error: 'not_found',
      message: 'Campaign not found',
    });
    const res = await POST(makeRequest('/api/post-campaigns/cam-1/activate', 'POST'), params);
    expect(res.status).toBe(404);
  });

  it('returns campaign on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockActivateCampaign.mockResolvedValue({
      success: true,
      data: { ...MOCK_CAMPAIGN, status: 'active' },
    });
    const res = await POST(makeRequest('/api/post-campaigns/cam-1/activate', 'POST'), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.campaign.status).toBe('active');
  });
});

describe('POST /api/post-campaigns/[id]/pause', () => {
  let POST: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/post-campaigns/[id]/pause/route');
    POST = mod.POST;
  });

  beforeEach(() => jest.clearAllMocks());

  const params = { params: Promise.resolve({ id: 'cam-1' }) };

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest('/api/post-campaigns/cam-1/pause', 'POST'), params);
    expect(res.status).toBe(401);
  });

  it('returns campaign on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockPauseCampaign.mockResolvedValue({
      success: true,
      data: { ...MOCK_CAMPAIGN, status: 'paused' },
    });
    const res = await POST(makeRequest('/api/post-campaigns/cam-1/pause', 'POST'), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.campaign.status).toBe('paused');
  });
});
