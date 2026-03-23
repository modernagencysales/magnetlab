/**
 * @jest-environment node
 */

/** LinkedInPublisher tests. Verifies publishNow passes imageFile to Unipile createPost. */

import { getUserLinkedInPublisher } from '@/lib/integrations/linkedin-publisher';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockCreatePost = jest.fn();

jest.mock('@/lib/integrations/unipile', () => ({
  getUnipileClient: () => ({
    createPost: mockCreatePost,
    getPost: jest.fn(),
  }),
  isUnipileConfigured: () => true,
  getUserPostingAccountId: jest.fn().mockResolvedValue('test-account-id'),
}));

jest.mock('@/lib/utils/encrypted-storage', () => ({
  getUserIntegration: jest.fn().mockResolvedValue({
    metadata: { unipile_account_id: 'test-account-id' },
    is_active: true,
  }),
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getUserLinkedInPublisher', () => {
  const userId = 'user-abc';

  beforeEach(() => {
    mockCreatePost.mockReset();
  });

  // ─── publishNow without image ────────────────────────────────────────

  describe('publishNow (text-only)', () => {
    it('calls createPost with accountId and content', async () => {
      mockCreatePost.mockResolvedValueOnce({
        data: { id: 'post-123', social_id: 'urn:li:activity:123' },
        error: null,
      });

      const publisher = await getUserLinkedInPublisher(userId);
      expect(publisher).not.toBeNull();

      const result = await publisher!.publishNow('Hello LinkedIn');

      expect(mockCreatePost).toHaveBeenCalledTimes(1);
      expect(mockCreatePost).toHaveBeenCalledWith('test-account-id', 'Hello LinkedIn', undefined);
      expect(result.postId).toBe('urn:li:activity:123');
      expect(result.provider).toBe('unipile');
    });

    it('falls back to data.id when social_id is absent', async () => {
      mockCreatePost.mockResolvedValueOnce({
        data: { id: 'post-456' },
        error: null,
      });

      const publisher = await getUserLinkedInPublisher(userId);
      const result = await publisher!.publishNow('Fallback ID post');

      expect(result.postId).toBe('post-456');
    });

    it('throws when createPost returns an error', async () => {
      mockCreatePost.mockResolvedValueOnce({
        data: null,
        error: 'Unipile API error',
      });

      const publisher = await getUserLinkedInPublisher(userId);
      await expect(publisher!.publishNow('Failing post')).rejects.toThrow(
        'Unipile publish failed: Unipile API error'
      );
    });
  });

  // ─── publishNow with image ───────────────────────────────────────────

  describe('publishNow (with imageFile)', () => {
    const imageFile = {
      buffer: Buffer.from('fake-png-data'),
      filename: 'cover.png',
      mimeType: 'image/png',
    };

    it('passes imageFile to createPost', async () => {
      mockCreatePost.mockResolvedValueOnce({
        data: { id: 'post-789', social_id: 'urn:li:activity:789' },
        error: null,
      });

      const publisher = await getUserLinkedInPublisher(userId);
      expect(publisher).not.toBeNull();

      const result = await publisher!.publishNow('Post with image', imageFile);

      expect(mockCreatePost).toHaveBeenCalledTimes(1);
      expect(mockCreatePost).toHaveBeenCalledWith('test-account-id', 'Post with image', imageFile);
      expect(result.postId).toBe('urn:li:activity:789');
      expect(result.provider).toBe('unipile');
    });

    it('throws when createPost fails for an image post', async () => {
      mockCreatePost.mockResolvedValueOnce({
        data: null,
        error: 'Upload failed',
      });

      const publisher = await getUserLinkedInPublisher(userId);
      await expect(publisher!.publishNow('Image post', imageFile)).rejects.toThrow(
        'Unipile publish failed: Upload failed'
      );
    });
  });

  // ─── Factory returns null when unconfigured ──────────────────────────

  describe('factory', () => {
    it('returns the provider name', async () => {
      mockCreatePost.mockResolvedValueOnce({
        data: { id: 'p1', social_id: 'urn:li:activity:1' },
        error: null,
      });

      const publisher = await getUserLinkedInPublisher(userId);
      expect(publisher?.provider).toBe('unipile');
    });
  });
});
