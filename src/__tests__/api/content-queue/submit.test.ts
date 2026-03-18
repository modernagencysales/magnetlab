/**
 * @jest-environment node
 */
import { POST } from '@/app/api/content-queue/submit/route';
import { NextRequest } from 'next/server';

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({ auth: () => mockAuth() }));

const mockSubmitBatch = jest.fn();
const mockGetStatusCode = jest.fn().mockReturnValue(500);
jest.mock('@/server/services/content-queue.service', () => ({
  submitBatch: (...args: unknown[]) => mockSubmitBatch(...args),
  getStatusCode: (...args: unknown[]) => mockGetStatusCode(...args),
}));

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/content-queue/submit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/content-queue/submit', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 without auth', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ team_id: 't1' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing team_id', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 200 with callback sent', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockSubmitBatch.mockResolvedValue({ success: true, dfy_callback_sent: true });
    const res = await POST(makeRequest({ team_id: 'team-1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dfy_callback_sent).toBe(true);
  });

  it('returns 400 when posts not all edited', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockSubmitBatch.mockRejectedValue(
      Object.assign(new Error('3 of 7 posts have not been edited yet'), { statusCode: 400 })
    );
    mockGetStatusCode.mockReturnValue(400);
    const res = await POST(makeRequest({ team_id: 'team-1' }));
    expect(res.status).toBe(400);
  });
});
