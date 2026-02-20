/**
 * @jest-environment node
 */

import { ActiveCampaignProvider } from '../activecampaign';
import type { ProviderCredentials } from '../../types';

const mockFetch = global.fetch as jest.Mock;

const credentials: ProviderCredentials = {
  apiKey: 'test-ac-api-key',
  metadata: { base_url: 'https://myaccount.api-us1.com' },
};

function provider() {
  return new ActiveCampaignProvider(credentials);
}

const BASE = 'https://myaccount.api-us1.com/api/3';

describe('ActiveCampaignProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('validateCredentials', () => {
    it('returns true when API responds ok', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });
      const result = await provider().validateCredentials();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE}/lists?limit=1`,
        expect.objectContaining({
          headers: expect.objectContaining({ 'Api-Token': 'test-ac-api-key' }),
        })
      );
    });

    it('returns false when API responds with error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });
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
            { id: 1, name: 'Main List' },
            { id: 2, name: 'VIP List' },
          ],
          meta: { total: '2' },
        }),
      });

      const lists = await provider().getLists();
      expect(lists).toEqual([
        { id: '1', name: 'Main List' },
        { id: '2', name: 'VIP List' },
      ]);
    });

    it('handles pagination', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            lists: Array.from({ length: 100 }, (_, i) => ({
              id: i + 1,
              name: `List ${i + 1}`,
            })),
            meta: { total: '120' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            lists: Array.from({ length: 20 }, (_, i) => ({
              id: 101 + i,
              name: `List ${101 + i}`,
            })),
            meta: { total: '120' },
          }),
        });

      const lists = await provider().getLists();
      expect(lists).toHaveLength(120);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(provider().getLists()).rejects.toThrow('ActiveCampaign API error: 500');
    });
  });

  describe('getTags', () => {
    it('maps tags correctly (uses tag field not name)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tags: [
            { id: 10, tag: 'VIP' },
            { id: 20, tag: 'Lead' },
          ],
          meta: { total: '2' },
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
            tags: Array.from({ length: 100 }, (_, i) => ({
              id: i + 1,
              tag: `Tag ${i + 1}`,
            })),
            meta: { total: '110' },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            tags: Array.from({ length: 10 }, (_, i) => ({
              id: 101 + i,
              tag: `Tag ${101 + i}`,
            })),
            meta: { total: '110' },
          }),
        });

      const tags = await provider().getTags();
      expect(tags).toHaveLength(110);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(provider().getTags()).rejects.toThrow('ActiveCampaign API error: 500');
    });
  });

  describe('subscribe', () => {
    it('creates new contact and adds to list (no tag)', async () => {
      // Step 1: Create contact
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ contact: { id: 42 } }),
      });
      // Step 2: Add to list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contactList: { id: 1 } }),
      });

      const result = await provider().subscribe({
        listId: '5',
        email: 'test@example.com',
        firstName: 'Alice',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Verify contact creation call
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        `${BASE}/contacts`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            contact: { email: 'test@example.com', firstName: 'Alice' },
          }),
        })
      );

      // Verify list add call
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        `${BASE}/contactLists`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            contactList: { list: 5, contact: 42, status: 1 },
          }),
        })
      );
    });

    it('subscribes with tag', async () => {
      // Create contact
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contact: { id: 42 } }),
      });
      // Add to list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contactList: { id: 1 } }),
      });
      // Apply tag
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contactTag: { id: 1 } }),
      });

      const result = await provider().subscribe({
        listId: '5',
        email: 'test@example.com',
        tagId: '99',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        `${BASE}/contactTags`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            contactTag: { contact: '42', tag: '99' },
          }),
        })
      );
    });

    it('handles duplicate contact (422 -> search -> use existing)', async () => {
      // Step 1: Create returns 422 (duplicate)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Duplicate' }),
      });
      // Step 2: Search for existing
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contacts: [{ id: 77 }] }),
      });
      // Step 3: Add to list
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contactList: { id: 1 } }),
      });

      const result = await provider().subscribe({
        listId: '5',
        email: 'existing@example.com',
      });

      expect(result).toEqual({ success: true });
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify search call
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        `${BASE}/contacts?email=${encodeURIComponent('existing@example.com')}`,
        expect.objectContaining({
          headers: expect.objectContaining({ 'Api-Token': 'test-ac-api-key' }),
        })
      );

      // Verify list add uses the found contact id
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        `${BASE}/contactLists`,
        expect.objectContaining({
          body: JSON.stringify({
            contactList: { list: 5, contact: 77, status: 1 },
          }),
        })
      );
    });

    it('returns error when duplicate search fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Duplicate' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      const result = await provider().subscribe({
        listId: '5',
        email: 'test@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to find existing contact');
    });

    it('returns error when duplicate search returns empty', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Duplicate' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contacts: [] }),
      });

      const result = await provider().subscribe({
        listId: '5',
        email: 'test@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns success with warning when tag application fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contact: { id: 42 } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contactList: { id: 1 } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await provider().subscribe({
        listId: '5',
        email: 'test@example.com',
        tagId: 'bad-tag',
      });

      expect(result.success).toBe(true);
      expect(result.error).toContain('tag application failed');
    });

    it('returns error when list add fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contact: { id: 42 } }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Invalid list' }),
      });

      const result = await provider().subscribe({
        listId: '999',
        email: 'test@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid list');
    });

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ETIMEDOUT'));

      const result = await provider().subscribe({
        listId: '5',
        email: 'test@example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('ETIMEDOUT');
    });
  });

  describe('base_url trailing slash handling', () => {
    it('strips trailing slash from base_url', async () => {
      const p = new ActiveCampaignProvider({
        apiKey: 'key',
        metadata: { base_url: 'https://myaccount.api-us1.com/' },
      });

      mockFetch.mockResolvedValueOnce({ ok: true });
      await p.validateCredentials();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://myaccount.api-us1.com/api/3/lists?limit=1',
        expect.anything()
      );
    });
  });
});
