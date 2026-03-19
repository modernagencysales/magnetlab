/**
 * @jest-environment node
 *
 * Tests for:
 *  - GET  /api/content-pipeline/posts/recyclable
 *  - POST /api/content-pipeline/posts/:id/recycle
 */

import { GET } from '@/app/api/content-pipeline/posts/recyclable/route';
import { POST } from '@/app/api/content-pipeline/posts/[id]/recycle/route';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/server/services/recycling.service', () => ({
  listRecyclablePosts: jest.fn(),
  createRepost: jest.fn(),
  createCousin: jest.fn(),
  getStatusCode: jest.fn((err: unknown) => {
    if (err && typeof err === 'object' && 'statusCode' in err) {
      return (err as { statusCode: number }).statusCode;
    }
    return 500;
  }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { auth } from '@/lib/auth';
import * as recyclingService from '@/server/services/recycling.service';

const mockAuth = auth as jest.Mock;
const mockListRecyclablePosts = recyclingService.listRecyclablePosts as jest.Mock;
const mockCreateRepost = recyclingService.createRepost as jest.Mock;
const mockCreateCousin = recyclingService.createCousin as jest.Mock;

const AUTHED_SESSION = { user: { id: 'user-123' } };

// ─── GET /api/content-pipeline/posts/recyclable ───────────────────────────────

describe('GET /api/content-pipeline/posts/recyclable', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const req = new NextRequest('http://localhost/api/content-pipeline/posts/recyclable');
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('returns recyclable posts with default limit', async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    const posts = [{ id: 'p1', status: 'published' }];
    mockListRecyclablePosts.mockResolvedValue(posts);

    const req = new NextRequest('http://localhost/api/content-pipeline/posts/recyclable');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.posts).toEqual(posts);
    expect(mockListRecyclablePosts).toHaveBeenCalledWith('user-123', 20);
  });

  it('passes custom limit query param', async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockListRecyclablePosts.mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/content-pipeline/posts/recyclable?limit=5');
    await GET(req);
    expect(mockListRecyclablePosts).toHaveBeenCalledWith('user-123', 5);
  });

  it('clamps limit to max 100', async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockListRecyclablePosts.mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/content-pipeline/posts/recyclable?limit=999');
    await GET(req);
    expect(mockListRecyclablePosts).toHaveBeenCalledWith('user-123', 100);
  });

  it('returns 500 on service error', async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockListRecyclablePosts.mockRejectedValue(new Error('DB failure'));

    const req = new NextRequest('http://localhost/api/content-pipeline/posts/recyclable');
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});

// ─── POST /api/content-pipeline/posts/:id/recycle ────────────────────────────

const PARAMS = Promise.resolve({ id: 'post-abc' });

function makeRecycleRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/content-pipeline/posts/post-abc/recycle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/content-pipeline/posts/:id/recycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const req = makeRecycleRequest({ type: 'repost' });
    const res = await POST(req, { params: PARAMS });
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing type', async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    const req = makeRecycleRequest({});
    const res = await POST(req, { params: PARAMS });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid type value', async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    const req = makeRecycleRequest({ type: 'clone' });
    const res = await POST(req, { params: PARAMS });
    expect(res.status).toBe(400);
  });

  it('calls createRepost for type=repost and returns 201', async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    const newPost = { id: 'new-post', lineage_type: 'repost' };
    mockCreateRepost.mockResolvedValue(newPost);

    const req = makeRecycleRequest({ type: 'repost' });
    const res = await POST(req, { params: PARAMS });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.post).toEqual(newPost);
    expect(mockCreateRepost).toHaveBeenCalledWith('user-123', 'post-abc');
    expect(mockCreateCousin).not.toHaveBeenCalled();
  });

  it('calls createCousin for type=cousin and returns 201', async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    const newPost = { id: 'new-cousin', lineage_type: 'cousin' };
    mockCreateCousin.mockResolvedValue(newPost);

    const req = makeRecycleRequest({ type: 'cousin' });
    const res = await POST(req, { params: PARAMS });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.post).toEqual(newPost);
    expect(mockCreateCousin).toHaveBeenCalledWith('user-123', 'post-abc');
    expect(mockCreateRepost).not.toHaveBeenCalled();
  });

  it('returns 404 when original post not found', async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    const notFoundError = Object.assign(new Error('Original post not found'), { statusCode: 404 });
    mockCreateRepost.mockRejectedValue(notFoundError);

    const req = makeRecycleRequest({ type: 'repost' });
    const res = await POST(req, { params: PARAMS });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Original post not found');
  });

  it('returns 500 on unexpected service error', async () => {
    mockAuth.mockResolvedValue(AUTHED_SESSION);
    mockCreateCousin.mockRejectedValue(new Error('DB failure'));

    const req = makeRecycleRequest({ type: 'cousin' });
    const res = await POST(req, { params: PARAMS });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Internal server error');
  });
});
