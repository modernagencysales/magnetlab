/**
 * @jest-environment node
 */
import { PATCH } from '@/app/api/content-queue/posts/[id]/route';
import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockUpdateQueuePost = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);
jest.mock('@/server/services/content-queue.service', () => ({
  updateQueuePost: (...args: unknown[]) => mockUpdateQueuePost(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/content-queue/posts/post-1', {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

const params = Promise.resolve({ id: 'post-1' });

describe('PATCH /api/content-queue/posts/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ draft_content: 'x' }), { params });
    expect(res.status).toBe(401);
  });

  it('returns 400 for empty body', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const res = await PATCH(makeRequest({}), { params });
    expect(res.status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockUpdateQueuePost.mockResolvedValue(undefined);
    const res = await PATCH(makeRequest({ draft_content: 'edited text' }), { params });
    expect(res.status).toBe(200);
    expect(mockUpdateQueuePost).toHaveBeenCalledWith(
      'user-1',
      'post-1',
      expect.objectContaining({
        draft_content: 'edited text',
      })
    );
  });

  it('returns 403 when post not accessible', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockUpdateQueuePost.mockRejectedValue(
      Object.assign(new Error('Not accessible'), { statusCode: 403 })
    );
    mockGetStatusCode.mockReturnValue(403);
    const res = await PATCH(makeRequest({ mark_edited: true }), { params });
    expect(res.status).toBe(403);
  });
});
