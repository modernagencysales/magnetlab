/**
 * @jest-environment node
 */

/** UnipileClient tests. Verifies createPost, addComment, sendDirectMessage. */

import { UnipileClient } from '@/lib/integrations/unipile';

const mockFetch = global.fetch as jest.Mock;

const DSN = 'api1.unipile.com:13337';
const ACCESS_TOKEN = 'test-unipile-token';
const BASE_URL = `https://${DSN}/api/v1`;

function createClient(): UnipileClient {
  return new UnipileClient({ dsn: DSN, accessToken: ACCESS_TOKEN });
}

function mockSuccessResponse<T>(data: T) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(data),
  };
}

function mockErrorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    text: async () => JSON.stringify({ message }),
  };
}

describe('UnipileClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ─── createPost ─────────────────────────────────────────────────────

  describe('createPost', () => {
    const postResponse = {
      id: 'post-123',
      social_id: 'urn:li:activity:123',
      account_id: 'acc-1',
      provider: 'LINKEDIN',
      text: 'Hello world',
      created_at: '2026-03-18T00:00:00Z',
    };

    it('sends JSON body for text-only posts', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(postResponse));

      const client = createClient();
      const result = await client.createPost('acc-1', 'Hello world');

      expect(result.data).toEqual(postResponse);
      expect(result.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/posts`);
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(options.body)).toEqual({
        account_id: 'acc-1',
        text: 'Hello world',
      });
    });

    it('sends multipart FormData when imageFile is provided', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(postResponse));

      const client = createClient();
      const imageFile = {
        buffer: Buffer.from('fake-png-data'),
        filename: 'test-image.png',
        mimeType: 'image/png',
      };
      const result = await client.createPost('acc-1', 'Post with image', imageFile);

      expect(result.data).toEqual(postResponse);
      expect(result.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/posts`);
      expect(options.method).toBe('POST');
      // Content-Type should NOT be set (fetch sets it with boundary for multipart)
      expect(options.headers['Content-Type']).toBeUndefined();
      // Body should be FormData
      expect(options.body).toBeInstanceOf(FormData);

      const formData = options.body as FormData;
      expect(formData.get('account_id')).toBe('acc-1');
      expect(formData.get('text')).toBe('Post with image');
      // Verify attachment is present
      const attachment = formData.get('attachments');
      expect(attachment).toBeTruthy();
      expect(attachment).toBeInstanceOf(Blob);
    });

    it('returns error on API failure', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(400, 'Bad Request'));

      const client = createClient();
      const result = await client.createPost('acc-1', 'Hello');

      expect(result.data).toBeNull();
      expect(result.error).toContain('400');
      expect(result.status).toBe(400);
    });
  });

  // ─── addComment ─────────────────────────────────────────────────────

  describe('addComment', () => {
    const commentResponse = { id: 'comment-456' };

    it('sends basic comment without threading', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(commentResponse));

      const client = createClient();
      const result = await client.addComment('post-social-1', 'acc-1', 'Nice post!');

      expect(result.data).toEqual(commentResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/posts/post-social-1/comments`);
      expect(options.method).toBe('POST');

      const body = JSON.parse(options.body);
      expect(body).toEqual({
        account_id: 'acc-1',
        text: 'Nice post!',
      });
      // Should NOT include comment_id or mentions
      expect(body.comment_id).toBeUndefined();
      expect(body.mentions).toBeUndefined();
    });

    it('includes commentId for threaded replies', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(commentResponse));

      const client = createClient();
      const result = await client.addComment('post-social-1', 'acc-1', 'Replying to thread', {
        commentId: 'parent-comment-789',
      });

      expect(result.data).toEqual(commentResponse);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.comment_id).toBe('parent-comment-789');
      expect(body.mentions).toBeUndefined();
    });

    it('includes mentions for tagged replies', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(commentResponse));

      const client = createClient();
      const mentions = [
        { name: 'John Doe', profile_id: 'urn:li:member:12345' },
        { name: 'Jane Smith', profile_id: 'urn:li:member:67890' },
      ];
      const result = await client.addComment('post-social-1', 'acc-1', '@John @Jane check this', {
        mentions,
      });

      expect(result.data).toEqual(commentResponse);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.mentions).toEqual(mentions);
      expect(body.comment_id).toBeUndefined();
    });

    it('includes both commentId and mentions for threaded + tagged replies', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(commentResponse));

      const client = createClient();
      const result = await client.addComment('post-social-1', 'acc-1', 'Thread reply with tag', {
        commentId: 'parent-comment-789',
        mentions: [{ name: 'John Doe', profile_id: 'urn:li:member:12345' }],
      });

      expect(result.data).toEqual(commentResponse);

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.comment_id).toBe('parent-comment-789');
      expect(body.mentions).toEqual([{ name: 'John Doe', profile_id: 'urn:li:member:12345' }]);
    });
  });

  // ─── sendDirectMessage ──────────────────────────────────────────────

  describe('sendDirectMessage', () => {
    const dmResponse = { chat_id: 'chat-abc', account_id: 'acc-1' };

    it('sends multipart FormData to /chats', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse(dmResponse));

      const client = createClient();
      const result = await client.sendDirectMessage('acc-1', 'provider-id-xyz', 'Hi there!');

      expect(result.data).toEqual(dmResponse);
      expect(result.error).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(`${BASE_URL}/chats`);
      expect(options.method).toBe('POST');
      // Content-Type should NOT be set (multipart boundary set by fetch)
      expect(options.headers['Content-Type']).toBeUndefined();
      // Body should be FormData
      expect(options.body).toBeInstanceOf(FormData);

      const formData = options.body as FormData;
      expect(formData.get('account_id')).toBe('acc-1');
      expect(formData.get('attendees_ids')).toBe('provider-id-xyz');
      expect(formData.get('text')).toBe('Hi there!');
    });

    it('returns error on API failure', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(403, 'Forbidden'));

      const client = createClient();
      const result = await client.sendDirectMessage('acc-1', 'provider-id', 'Hello');

      expect(result.data).toBeNull();
      expect(result.error).toContain('403');
      expect(result.status).toBe(403);
    });
  });

  // ─── Auth header ────────────────────────────────────────────────────

  describe('auth headers', () => {
    it('sends X-API-KEY header on all requests', async () => {
      mockFetch.mockResolvedValueOnce(mockSuccessResponse({ id: 'post-1' }));

      const client = createClient();
      await client.createPost('acc-1', 'Test');

      const headers = mockFetch.mock.calls[0][1].headers;
      expect(headers['X-API-KEY']).toBe(ACCESS_TOKEN);
    });
  });
});
