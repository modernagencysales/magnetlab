/**
 * @jest-environment node
 */
import { GET } from '@/app/api/content-queue/route';
import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockGetQueue = jest.fn();
jest.mock('@/server/services/content-queue.service', () => ({
  getQueue: (...args: unknown[]) => mockGetQueue(...args),
}));

function makeRequest() {
  return new NextRequest('http://localhost/api/content-queue', { method: 'GET' });
}

describe('GET /api/content-queue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it('returns queue data on success', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const queueData = {
      teams: [{ team_id: 't1', team_name: 'Client A', posts: [], edited_count: 0, total_count: 3 }],
      summary: { total_teams: 1, total_posts: 3, remaining: 3 },
    };
    mockGetQueue.mockResolvedValue(queueData);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.teams).toHaveLength(1);
    expect(body.summary.total_posts).toBe(3);
    expect(mockGetQueue).toHaveBeenCalledWith('user-1');
  });

  it('returns 500 on service error', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockGetQueue.mockRejectedValue(new Error('DB down'));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
