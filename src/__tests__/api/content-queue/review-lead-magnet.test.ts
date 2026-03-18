/**
 * @jest-environment node
 */
import { PATCH } from '@/app/api/content-queue/lead-magnets/[id]/review/route';
import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockReviewLeadMagnet = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);
jest.mock('@/server/services/content-queue.service', () => ({
  reviewLeadMagnet: (...args: unknown[]) => mockReviewLeadMagnet(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/content-queue/lead-magnets/lm-1/review', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = Promise.resolve({ id: 'lm-1' });

describe('PATCH /api/content-queue/lead-magnets/[id]/review', () => {
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
    mockReviewLeadMagnet.mockResolvedValue(undefined);
    const res = await PATCH(makeRequest({ reviewed: true }), { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(mockReviewLeadMagnet).toHaveBeenCalledWith('user-1', 'lm-1', true);
  });

  it('returns 200 on success with reviewed=false', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockReviewLeadMagnet.mockResolvedValue(undefined);
    const res = await PATCH(makeRequest({ reviewed: false }), { params });
    expect(res.status).toBe(200);
    expect(mockReviewLeadMagnet).toHaveBeenCalledWith('user-1', 'lm-1', false);
  });

  it('returns 403 when lead magnet not accessible', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockReviewLeadMagnet.mockRejectedValue(
      Object.assign(new Error('Lead magnet not found or not accessible'), { statusCode: 403 })
    );
    mockGetStatusCode.mockReturnValue(403);
    const res = await PATCH(makeRequest({ reviewed: true }), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Lead magnet not found or not accessible');
  });

  it('returns 500 on unexpected error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockReviewLeadMagnet.mockRejectedValue(new Error('DB exploded'));
    mockGetStatusCode.mockReturnValue(500);
    const res = await PATCH(makeRequest({ reviewed: true }), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});
