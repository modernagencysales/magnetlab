/**
 * @jest-environment node
 */

// Mock auth
const mockSession = {
  user: { id: 'test-user-id', email: 'test@example.com', name: 'Test' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};
let currentSession: typeof mockSession | null = mockSession;

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(() => Promise.resolve(currentSession)),
}));

// Mock team-context
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
  applyScope: jest.fn(),
}));

// Mock funnels service
const mockPublishFunnel = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);

jest.mock('@/server/services/funnels.service', () => ({
  publishFunnel: (...args: unknown[]) => mockPublishFunnel(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

import { POST } from '@/app/api/funnel/[id]/publish/route';

// Valid UUIDs for testing
const funnelUUID1 = '550e8400-e29b-41d4-a716-446655440001';
const funnelUUID2 = '550e8400-e29b-41d4-a716-446655440002';
const funnelUUID3 = '550e8400-e29b-41d4-a716-446655440003';
const funnelUUID4 = '550e8400-e29b-41d4-a716-446655440004';
const funnelUUID5 = '550e8400-e29b-41d4-a716-446655440005';
const nonexistentUUID = '770e8400-e29b-41d4-a716-446655440099';

function makeRequest(id: string, body: unknown) {
  const request = new Request(`http://localhost:3000/api/funnel/${id}/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { request, params: Promise.resolve({ id }) };
}

describe('POST /api/funnel/[id]/publish - Auto-polish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentSession = mockSession;
  });

  it('should return 401 if not authenticated', async () => {
    currentSession = null;
    const { request, params } = makeRequest(funnelUUID1, { publish: true });

    const response = await POST(request, { params });
    expect(response.status).toBe(401);
  });

  it('should return 400 if publish is not boolean', async () => {
    const { request, params } = makeRequest(funnelUUID1, { publish: 'yes' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('publish');
  });

  it('should return 404 if funnel not found', async () => {
    const err = Object.assign(new Error('Funnel not found'), { statusCode: 404 });
    mockPublishFunnel.mockRejectedValue(err);
    mockGetStatusCode.mockReturnValue(404);

    const { request, params } = makeRequest(nonexistentUUID, { publish: true });

    const response = await POST(request, { params });
    expect(response.status).toBe(404);
  });

  it('should publish funnel successfully', async () => {
    const publishResult = {
      funnel: {
        id: funnelUUID2,
        isPublished: true,
        url: 'http://localhost:3000/p/testuser/test-slug',
      },
    };
    mockPublishFunnel.mockResolvedValue(publishResult);

    const { request, params } = makeRequest(funnelUUID2, { publish: true });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.funnel.isPublished).toBe(true);
  });

  it('should unpublish funnel successfully', async () => {
    const publishResult = {
      funnel: {
        id: funnelUUID4,
        isPublished: false,
      },
    };
    mockPublishFunnel.mockResolvedValue(publishResult);

    const { request, params } = makeRequest(funnelUUID4, { publish: false });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.funnel.isPublished).toBe(false);
  });

  it('should still publish even if auto-polish fails gracefully inside service', async () => {
    // Service handles polish failure internally and still returns success
    const publishResult = {
      funnel: {
        id: funnelUUID5,
        isPublished: true,
        url: 'http://localhost:3000/p/testuser/test-slug',
      },
    };
    mockPublishFunnel.mockResolvedValue(publishResult);

    const { request, params } = makeRequest(funnelUUID5, { publish: true });

    const response = await POST(request, { params });

    // Should still succeed - polish failure is non-blocking inside service
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.funnel.isPublished).toBe(true);
  });

  it('should call service with correct scope, id, and publish flag', async () => {
    mockPublishFunnel.mockResolvedValue({ funnel: { id: funnelUUID3, isPublished: true } });

    const { request, params } = makeRequest(funnelUUID3, { publish: true });

    await POST(request, { params });

    expect(mockPublishFunnel).toHaveBeenCalledWith(
      { type: 'user', userId: 'test-user-id' },
      funnelUUID3,
      true
    );
  });
});
