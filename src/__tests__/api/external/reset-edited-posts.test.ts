/**
 * @jest-environment node
 */
import { POST } from '@/app/api/external/reset-edited-posts/route';
import { NextRequest } from 'next/server';

const mockResetEditedPosts = jest.fn();
jest.mock('@/server/services/content-queue.service', () => ({
  resetEditedPosts: (...args: unknown[]) => mockResetEditedPosts(...args),
}));

// Mock env
const originalEnv = process.env;
beforeAll(() => {
  process.env = { ...originalEnv, EXTERNAL_API_KEY: 'test-api-key' };
});
afterAll(() => {
  process.env = originalEnv;
});

function makeRequest(body: Record<string, unknown>, token = 'test-api-key') {
  return new NextRequest('http://localhost/api/external/reset-edited-posts', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
}

describe('POST /api/external/reset-edited-posts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 with invalid token', async () => {
    const res = await POST(makeRequest({ userId: 'u1' }, 'wrong-key'));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing userId', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 200 on success', async () => {
    mockResetEditedPosts.mockResolvedValue({ reset_count: 5 });
    const res = await POST(makeRequest({ userId: 'user-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reset_count).toBe(5);
  });
});
