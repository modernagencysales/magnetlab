import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KitProvider } from '../kit';
import type { ProviderCredentials } from '../../types';

global.fetch = vi.fn();
const mockFetch = global.fetch as ReturnType<typeof vi.fn>;

const credentials: ProviderCredentials = {
  apiKey: 'test-kit-api-key',
};

function provider() {
  return new KitProvider(credentials);
}

describe('KitProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('validateCredentials', () => {
    it('returns true when API responds ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const result = await provider().validateCredentials();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kit.com/v4/forms?per_page=1',
        expect.objectContaining({
          headers: expect.objectContaining({ 'X-Kit-Api-Key': 'test-kit-api-key' }),
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
    it('maps forms to lists correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          forms: [
            { id: 1, name: 'Newsletter' },
            { id: 2, name: 'Webinar' },
          ],
          pagination: { has_next_page: false, end_cursor: null },
        }),
      });

      const lists = await provider().getLists();
      expect(lists).toEqual([
        { id: '1', name: 'Newsletter' },
        { id: '2', name: 'Webinar' },
      ]);
    });

    it('handles pagination', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            forms: [{ id: 1, name: 'Page 1' }],
            pagination: { has_next_page: true, end_cursor: 'cursor-abc' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            forms: [{ id: 2, name: 'Page 2' }],
            pagination: { has_next_page: false, end_cursor: null },
          }),
        });

      const lists = await provider().getLists();
      expect(lists).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.kit.com/v4/forms?per_page=100&after=cursor-abc',
        expect.anything()
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(provider().getLists()).rejects.toThrow('Kit API error: 500');
    });
  });

  describe('getTags', () => {
    it('maps tags correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tags: [
            { id: 10, name: 'VIP' },
            { id: 20, name: 'Lead' },
          ],
          pagination: { has_next_page: false },
        }),
      });

      const tags = await provider().getTags();
      expect(tags).toEqual([
        { id: '10', name: 'VIP' },
        { id: '20', name: 'Lead' },
      ]);
    });

    it('handles pagination', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tags: [{ id: 10, name: 'Tag A' }],
            pagination: { has_next_page: true, end_cursor: 'tag-cursor' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tags: [{ id: 20, name: 'Tag B' }],
            pagination: { has_next_page: false },
          }),
        });

      const tags = await provider().getTags();
      expect(tags).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('subscribe', () => {
    it('subscribes without tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ subscriber: { id: 1 } }),
      });

      const result = await provider().subscribe({
        listId: '42',
        email: 'test@example.com',
        firstName: 'John',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kit.com/v4/forms/42/subscribers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email_address: 'test@example.com',
            first_name: 'John',
          }),
        })
      );
    });

    it('subscribes with tag', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ subscriber: { id: 1 } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ subscriber: { id: 1 } }),
        });

      const result = await provider().subscribe({
        listId: '42',
        email: 'test@example.com',
        tagId: '99',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://api.kit.com/v4/tags/99/subscribers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email_address: 'test@example.com' }),
        })
      );
    });

    it('returns success with warning when tag application fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ subscriber: { id: 1 } }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
        });

      const result = await provider().subscribe({
        listId: '42',
        email: 'test@example.com',
        tagId: '99',
      });

      expect(result.success).toBe(true);
      expect(result.error).toContain('tag application failed');
    });

    it('returns error when subscribe fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Invalid email' }),
      });

      const result = await provider().subscribe({
        listId: '42',
        email: 'bad-email',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await provider().subscribe({
        listId: '42',
        email: 'test@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection refused');
    });
  });
});
