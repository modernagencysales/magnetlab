/**
 * @jest-environment node
 */
import { DELETE } from '@/app/api/content-queue/posts/[id]/route';
import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockDeleteQueuePost = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);
jest.mock('@/server/services/content-queue.service', () => ({
  deleteQueuePost: (...args: unknown[]) => mockDeleteQueuePost(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

function makeRequest() {
  return new NextRequest('http://localhost/api/content-queue/posts/post-1', {
    method: 'DELETE',
  });
}

const params = Promise.resolve({ id: 'post-1' });

describe('DELETE /api/content-queue/posts/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await DELETE(makeRequest(), { params });
    expect(res.status).toBe(401);
  });

  it('returns 200 on successful delete', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockDeleteQueuePost.mockResolvedValue(undefined);
    const res = await DELETE(makeRequest(), { params });
    expect(res.status).toBe(200);
    expect(mockDeleteQueuePost).toHaveBeenCalledWith('user-1', 'post-1');
  });

  it('returns 403 when post not accessible', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockDeleteQueuePost.mockRejectedValue(
      Object.assign(new Error('Post not found or not accessible'), { statusCode: 403 })
    );
    mockGetStatusCode.mockReturnValue(403);
    const res = await DELETE(makeRequest(), { params });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/not accessible/i);
  });

  it('returns 500 on unexpected error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockDeleteQueuePost.mockRejectedValue(new Error('DB failure'));
    mockGetStatusCode.mockReturnValue(500);
    const res = await DELETE(makeRequest(), { params });
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});
