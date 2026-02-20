/**
 * @jest-environment node
 */

import { MailerLiteProvider } from '../mailerlite';
import type { ProviderCredentials } from '../../types';

const mockFetch = global.fetch as jest.Mock;

const credentials: ProviderCredentials = {
  apiKey: 'test-mailerlite-api-key',
};

function provider() {
  return new MailerLiteProvider(credentials);
}

describe('MailerLiteProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('validateCredentials', () => {
    it('returns true when API responds ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const result = await provider().validateCredentials();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://connect.mailerlite.com/api/groups?limit=1',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-mailerlite-api-key',
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
    it('maps groups to lists correctly', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'grp-1', name: 'Newsletter' },
            { id: 'grp-2', name: 'Webinar' },
          ],
          meta: { current_page: 1, last_page: 1 },
        }),
      });

      const lists = await provider().getLists();
      expect(lists).toEqual([
        { id: 'grp-1', name: 'Newsletter' },
        { id: 'grp-2', name: 'Webinar' },
      ]);
    });

    it('handles pagination', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: 'grp-1', name: 'Page 1' }],
            meta: { current_page: 1, last_page: 2 },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [{ id: 'grp-2', name: 'Page 2' }],
            meta: { current_page: 2, last_page: 2 },
          }),
        });

      const lists = await provider().getLists();
      expect(lists).toHaveLength(2);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenLastCalledWith(
        'https://connect.mailerlite.com/api/groups?limit=50&page=2',
        expect.anything()
      );
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(provider().getLists()).rejects.toThrow('MailerLite API error: 500');
    });
  });

  describe('getTags', () => {
    it('returns empty array (MailerLite does not support tags)', async () => {
      const tags = await provider().getTags();
      expect(tags).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('subscribe', () => {
    it('subscribes without firstName', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'sub-1' } }),
      });

      const result = await provider().subscribe({
        listId: 'grp-1',
        email: 'test@example.com',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://connect.mailerlite.com/api/subscribers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            groups: ['grp-1'],
          }),
        })
      );
    });

    it('subscribes with firstName', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'sub-1' } }),
      });

      const result = await provider().subscribe({
        listId: 'grp-1',
        email: 'test@example.com',
        firstName: 'Jane',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledWith(
        'https://connect.mailerlite.com/api/subscribers',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            groups: ['grp-1'],
            fields: { name: 'Jane' },
          }),
        })
      );
    });

    it('subscribes with tag (ignored — tags not supported)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: 'sub-1' } }),
      });

      const result = await provider().subscribe({
        listId: 'grp-1',
        email: 'test@example.com',
        tagId: 'tag-ignored',
      });

      // Tag is ignored since MailerLite getTags returns [], but subscribe still works
      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns error when subscribe fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Invalid email address' }),
      });

      const result = await provider().subscribe({
        listId: 'grp-1',
        email: 'bad-email',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email address');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      const result = await provider().subscribe({
        listId: 'grp-1',
        email: 'test@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('ECONNREFUSED');
    });
  });
});
