/**
 * @jest-environment node
 *
 * Tests for POST /api/content-pipeline/posts/direct-publish
 */

import { POST } from '@/app/api/content-pipeline/posts/direct-publish/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock posts service
jest.mock('@/server/services/posts.service', () => ({
  directPublish: jest.fn(),
  getStatusCode: jest.fn().mockReturnValue(500),
}));

// Mock linkedin-accounts service
jest.mock('@/server/services/linkedin-accounts.service', () => ({
  validateUnipileAccountAccess: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { auth } from '@/lib/auth';
import * as postsService from '@/server/services/posts.service';
import { validateUnipileAccountAccess } from '@/server/services/linkedin-accounts.service';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createJsonRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/content-pipeline/posts/direct-publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('POST /api/content-pipeline/posts/direct-publish', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (postsService.getStatusCode as jest.Mock).mockReturnValue(500);
  });

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const request = createJsonRequest({ unipile_account_id: 'acc-1', text: 'Hello LinkedIn' });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 when unipile_account_id is missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const request = createJsonRequest({ text: 'Hello LinkedIn' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('unipile_account_id');
  });

  it('returns 400 when text is missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const request = createJsonRequest({ unipile_account_id: 'acc-1' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('text');
  });

  it('returns 403 when account access is denied', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (validateUnipileAccountAccess as jest.Mock).mockResolvedValue(false);

    const request = createJsonRequest({ unipile_account_id: 'acc-other', text: 'Hello LinkedIn' });
    const response = await POST(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Access denied');
    expect(validateUnipileAccountAccess).toHaveBeenCalledWith('user-1', 'acc-other');
  });

  it('calls directPublish and returns result on success', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (validateUnipileAccountAccess as jest.Mock).mockResolvedValue(true);

    const mockResult = {
      post_id: 'post-uuid-1',
      linkedin_post_id: '1234567890',
      linkedin_url: 'https://www.linkedin.com/feed/update/urn:li:activity:1234567890',
    };
    (postsService.directPublish as jest.Mock).mockResolvedValue(mockResult);

    const request = createJsonRequest({
      unipile_account_id: 'acc-1',
      text: 'Hello LinkedIn',
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.post_id).toBe('post-uuid-1');
    expect(data.linkedin_post_id).toBe('1234567890');
    expect(data.linkedin_url).toContain('urn:li:activity:1234567890');
    expect(postsService.directPublish).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ unipile_account_id: 'acc-1', text: 'Hello LinkedIn' })
    );
  });

  it('passes image_url and title to directPublish', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (validateUnipileAccountAccess as jest.Mock).mockResolvedValue(true);
    (postsService.directPublish as jest.Mock).mockResolvedValue({
      post_id: 'post-1',
      linkedin_post_id: null,
      linkedin_url: null,
    });

    const request = createJsonRequest({
      unipile_account_id: 'acc-1',
      text: 'Post with image',
      image_url: 'https://example.com/photo.png',
      title: 'My Post Title',
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(postsService.directPublish).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        unipile_account_id: 'acc-1',
        text: 'Post with image',
        image_url: 'https://example.com/photo.png',
        title: 'My Post Title',
      })
    );
  });

  it('returns 500 when directPublish throws', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (validateUnipileAccountAccess as jest.Mock).mockResolvedValue(true);
    (postsService.directPublish as jest.Mock).mockRejectedValue(
      new Error('Unipile publish failed: rate limited')
    );
    (postsService.getStatusCode as jest.Mock).mockReturnValue(500);

    const request = createJsonRequest({ unipile_account_id: 'acc-1', text: 'Hello LinkedIn' });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Unipile publish failed');
  });
});
