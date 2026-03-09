import { KajabiClient } from '@/lib/integrations/kajabi/client';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('KajabiClient', () => {
  const apiKey = 'test-api-key';
  const siteId = 'test-site-id';
  let client: KajabiClient;

  beforeEach(() => {
    client = new KajabiClient(apiKey, siteId);
    mockFetch.mockReset();
  });

  describe('testConnection', () => {
    it('returns true when API responds with 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });
      const result = await client.testConnection();
      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kajabi.com/v1/contacts?page[size]=1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        })
      );
    });

    it('returns false when API responds with error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
      const result = await client.testConnection();
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      const result = await client.testConnection();
      expect(result).toBe(false);
    });
  });

  describe('createContact', () => {
    it('creates a contact and returns the id', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: { id: 'contact-123', type: 'contacts', attributes: { email: 'test@example.com' } },
        }),
      });
      const result = await client.createContact('test@example.com', 'Test User');
      expect(result).toEqual({ id: 'contact-123' });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.data.relationships.site.data.id).toBe('test-site-id');
    });

    it('creates a contact without name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          data: { id: 'contact-456', type: 'contacts', attributes: { email: 'noname@example.com' } },
        }),
      });
      const result = await client.createContact('noname@example.com');
      expect(result).toEqual({ id: 'contact-456' });
    });

    it('throws on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ errors: [{ detail: 'Invalid email' }] }),
      });
      await expect(client.createContact('bad')).rejects.toThrow();
    });
  });

  describe('addTagsToContact', () => {
    it('sends tag relationship data', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 204 });
      await client.addTagsToContact('contact-123', ['tag-1', 'tag-2']);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.kajabi.com/v1/contacts/contact-123/relationships/tags',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            data: [
              { type: 'tags', id: 'tag-1' },
              { type: 'tags', id: 'tag-2' },
            ],
          }),
        })
      );
    });

    it('skips when no tag ids provided', async () => {
      await client.addTagsToContact('contact-123', []);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('listTags', () => {
    it('returns parsed tags', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: 'tag-1', type: 'contact_tags', attributes: { name: 'VIP' } },
            { id: 'tag-2', type: 'contact_tags', attributes: { name: 'Lead' } },
          ],
        }),
      });
      const tags = await client.listTags();
      expect(tags).toEqual([
        { id: 'tag-1', name: 'VIP' },
        { id: 'tag-2', name: 'Lead' },
      ]);
    });

    it('returns empty array on error', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const tags = await client.listTags();
      expect(tags).toEqual([]);
    });
  });
});
