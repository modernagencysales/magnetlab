import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'crypto';
import { MailchimpProvider } from '../mailchimp';
import type { ProviderCredentials } from '../../types';

global.fetch = vi.fn();
const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

const credentials: ProviderCredentials = {
  apiKey: 'test-mailchimp-key',
  metadata: { server_prefix: 'us21' },
};

function provider() {
  return new MailchimpProvider(credentials);
}

function md5(email: string): string {
  return createHash('md5').update(email.toLowerCase()).digest('hex');
}

describe('MailchimpProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('validateCredentials', () => {
    it('returns true when API responds ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const result = await provider().validateCredentials();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://us21.api.mailchimp.com/3.0/lists?count=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-mailchimp-key',
          }),
        })
      );
    });

    it('returns false when API responds with error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      const result = await provider().validateCredentials();
      expect(result).toBe(false);
    });

    it('returns false when fetch throws', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await provider().validateCredentials();
      expect(result).toBe(false);
    });
  });

  describe('getLists', () => {
    it('maps lists correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lists: [
            { id: 'abc123', name: 'Main List' },
            { id: 'def456', name: 'VIP List' },
          ],
          total_items: 2,
        }),
      });

      const lists = await provider().getLists();
      expect(lists).toEqual([
        { id: 'abc123', name: 'Main List' },
        { id: 'def456', name: 'VIP List' },
      ]);
    });

    it('handles pagination', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            lists: Array.from({ length: 100 }, (_, i) => ({
              id: `id-${i}`,
              name: `List ${i}`,
            })),
            total_items: 150,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            lists: Array.from({ length: 50 }, (_, i) => ({
              id: `id-${100 + i}`,
              name: `List ${100 + i}`,
            })),
            total_items: 150,
          }),
        });

      const lists = await provider().getLists();
      expect(lists).toHaveLength(150);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(provider().getLists()).rejects.toThrow('Mailchimp API error: 500');
    });
  });

  describe('getTags', () => {
    it('returns tags for a given list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tags: [
            { id: 1, name: 'VIP' },
            { id: 2, name: 'Lead' },
          ],
        }),
      });

      const tags = await provider().getTags('list-abc');
      expect(tags).toEqual([
        { id: 'VIP', name: 'VIP' },
        { id: 'Lead', name: 'Lead' },
      ]);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://us21.api.mailchimp.com/3.0/lists/list-abc/tag-search',
        expect.anything()
      );
    });

    it('returns empty array when no listId provided', async () => {
      const tags = await provider().getTags();
      expect(tags).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(provider().getTags('bad-list')).rejects.toThrow('Mailchimp API error: 404');
    });
  });

  describe('subscribe', () => {
    const email = 'test@example.com';
    const hash = md5(email);

    it('subscribes without tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: hash, email_address: email }),
      });

      const result = await provider().subscribe({
        listId: 'list-abc',
        email,
        firstName: 'John',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://us21.api.mailchimp.com/3.0/lists/list-abc/members/${hash}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            email_address: email,
            status_if_new: 'subscribed',
            merge_fields: { FNAME: 'John' },
          }),
        })
      );
    });

    it('subscribes with tag (tag name stored in tagId)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: hash }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      const result = await provider().subscribe({
        listId: 'list-abc',
        email,
        tagId: 'VIP',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        `https://us21.api.mailchimp.com/3.0/lists/list-abc/members/${hash}/tags`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            tags: [{ name: 'VIP', status: 'active' }],
          }),
        })
      );
    });

    it('returns success with warning when tag fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: hash }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
        });

      const result = await provider().subscribe({
        listId: 'list-abc',
        email,
        tagId: 'NonExistentTag',
      });

      expect(result.success).toBe(true);
      expect(result.error).toContain('tag application failed');
    });

    it('returns error when subscribe fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ detail: 'Invalid Resource' }),
      });

      const result = await provider().subscribe({
        listId: 'list-abc',
        email: 'bad',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid Resource');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Timeout'));

      const result = await provider().subscribe({
        listId: 'list-abc',
        email,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Timeout');
    });
  });
});
