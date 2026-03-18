/**
 * @jest-environment node
 */
import { PATCH } from '@/app/api/content-queue/funnels/[id]/review/route';
import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockReviewFunnel = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);
jest.mock('@/server/services/content-queue.service', () => ({
  reviewFunnel: (...args: unknown[]) => mockReviewFunnel(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/content-queue/funnels/funnel-1/review', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = Promise.resolve({ id: 'funnel-1' });

describe('PATCH /api/content-queue/funnels/[id]/review', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ reviewed: true }), { params });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing reviewed field', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const res = await PATCH(makeRequest({}), { params });
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-boolean reviewed value', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const res = await PATCH(makeRequest({ reviewed: 'yes' }), { params });
    expect(res.status).toBe(400);
  });

  it('returns 200 on success with reviewed=true', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockReviewFunnel.mockResolvedValue(undefined);
    const res = await PATCH(makeRequest({ reviewed: true }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockReviewFunnel).toHaveBeenCalledWith('user-1', 'funnel-1', true);
  });

  it('returns 200 on success with reviewed=false', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockReviewFunnel.mockResolvedValue(undefined);
    const res = await PATCH(makeRequest({ reviewed: false }), { params });
    expect(res.status).toBe(200);
    expect(mockReviewFunnel).toHaveBeenCalledWith('user-1', 'funnel-1', false);
  });

  it('returns 403 when funnel not accessible', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockReviewFunnel.mockRejectedValue(
      Object.assign(new Error('Funnel not found or not accessible'), { statusCode: 403 })
    );
    mockGetStatusCode.mockReturnValue(403);
    const res = await PATCH(makeRequest({ reviewed: true }), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Funnel not found or not accessible');
  });

  it('returns 500 on unexpected error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockReviewFunnel.mockRejectedValue(new Error('DB exploded'));
    mockGetStatusCode.mockReturnValue(500);
    const res = await PATCH(makeRequest({ reviewed: true }), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});
