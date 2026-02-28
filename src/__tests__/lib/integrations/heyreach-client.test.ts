/**
 * @jest-environment node
 */

import { HeyReachClient } from '@/lib/integrations/heyreach/client';
import type { HeyReachContact } from '@/lib/integrations/heyreach/types';

// Use the global fetch mock from jest.setup.js
const mockFetch = global.fetch as jest.Mock;

const API_KEY = 'test-heyreach-api-key';
const BASE_URL = 'https://api.heyreach.io/api/public';

function createClient() {
  return new HeyReachClient(API_KEY);
}

describe('HeyReachClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('testConnection', () => {
    it('returns true on 200 response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      });

      const client = createClient();
      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/campaign/GetAll`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-KEY': API_KEY,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify({ offset: 0, limit: 1 }),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('returns false on error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const client = createClient();
      const result = await client.testConnection();

      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = createClient();
      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('listCampaigns', () => {
    it('returns campaigns on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            { id: 1, name: 'Campaign 1', status: 'ACTIVE', createdAt: '2026-01-01' },
            { id: 2, name: 'Campaign 2', status: 'PAUSED', createdAt: '2026-01-02' },
          ],
          totalCount: 2,
        }),
      });

      const client = createClient();
      const result = await client.listCampaigns({ offset: 0, limit: 10 });

      expect(result.error).toBeUndefined();
      expect(result.total).toBe(2);
      expect(result.campaigns).toHaveLength(2);
      expect(result.campaigns[0]).toEqual({
        id: 1,
        name: 'Campaign 1',
        status: 'ACTIVE',
        createdAt: '2026-01-01',
      });
    });

    it('returns error on API failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error' }),
      });

      const client = createClient();
      const result = await client.listCampaigns();

      expect(result.campaigns).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.error).toBe('HTTP 500: Internal Server Error');
    });
  });

  describe('addContactsToCampaign', () => {
    const contacts: HeyReachContact[] = [
      {
        linkedinUrl: 'https://linkedin.com/in/johndoe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      },
    ];

    it('adds contacts successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const client = createClient();
      const result = await client.addContactsToCampaign(12345, contacts);

      expect(result).toEqual({
        success: true,
        added: 1,
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/campaign/AddLeadsToCampaign`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'X-API-KEY': API_KEY,
            'Content-Type': 'application/json',
          }),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('returns early for empty contacts', async () => {
      const client = createClient();
      const result = await client.addContactsToCampaign(12345, []);

      expect(result).toEqual({
        success: true,
        added: 0,
      });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does NOT retry on 4xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bad Request' }),
      });

      const client = createClient();
      const result = await client.addContactsToCampaign(12345, contacts);

      expect(result).toEqual({
        success: false,
        added: 0,
        error: 'HTTP 400: Bad Request',
      });
      // Should NOT retry -- only 1 call
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does NOT retry on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const client = createClient();
      const result = await client.addContactsToCampaign(12345, contacts);

      expect(result).toEqual({
        success: false,
        added: 0,
        error: 'HTTP 401: Unauthorized',
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries on 500 and succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ message: 'Internal Server Error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });

      const client = createClient();
      const resultPromise = client.addContactsToCampaign(12345, contacts);

      // Advance past the first retry delay (1s)
      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result).toEqual({
        success: true,
        added: 1,
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 429 and succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ message: 'Too Many Requests' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });

      const client = createClient();
      const resultPromise = client.addContactsToCampaign(12345, contacts);

      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result).toEqual({
        success: true,
        added: 1,
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('gives up after max retries on persistent 5xx', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ message: 'Service Unavailable' }),
      });

      const client = createClient();
      const resultPromise = client.addContactsToCampaign(12345, contacts);

      // Advance past all retry delays: 1s + 2s + 4s
      await jest.advanceTimersByTimeAsync(1000); // retry 1
      await jest.advanceTimersByTimeAsync(2000); // retry 2
      await jest.advanceTimersByTimeAsync(4000); // retry 3

      const result = await resultPromise;

      expect(result).toEqual({
        success: false,
        added: 0,
        error: 'HTTP 503: Service Unavailable',
      });
      // 1 initial + 3 retries = 4 calls total
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('retries on network errors', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('fetch failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });

      const client = createClient();
      const resultPromise = client.addContactsToCampaign(12345, contacts);

      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result).toEqual({
        success: true,
        added: 1,
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('sends customFields as customUserFields array', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const contactsWithCustomFields: HeyReachContact[] = [
        {
          linkedinUrl: 'https://linkedin.com/in/janedoe/',
          firstName: 'Jane',
          lastName: 'Doe',
          customFields: {
            leadMagnet: 'Growth Guide',
            source: 'magnetlab',
          },
        },
      ];

      const client = createClient();
      await client.addContactsToCampaign(12345, contactsWithCustomFields);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const lead = callBody.accountLeadPairs[0].lead;

      expect(lead.customUserFields).toEqual([
        { name: 'leadMagnet', value: 'Growth Guide' },
        { name: 'source', value: 'magnetlab' },
      ]);
    });

    it('normalizes LinkedIn URL trailing slash', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const contactsWithoutSlash: HeyReachContact[] = [
        {
          linkedinUrl: 'https://linkedin.com/in/johndoe',
          firstName: 'John',
        },
      ];

      const client = createClient();
      await client.addContactsToCampaign(12345, contactsWithoutSlash);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const lead = callBody.accountLeadPairs[0].lead;

      // Should have trailing slash added
      expect(lead.profileUrl).toBe('https://linkedin.com/in/johndoe/');
    });

    it('does not double-add trailing slash if already present', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      });

      const contactsWithSlash: HeyReachContact[] = [
        {
          linkedinUrl: 'https://linkedin.com/in/johndoe/',
          firstName: 'John',
        },
      ];

      const client = createClient();
      await client.addContactsToCampaign(12345, contactsWithSlash);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const lead = callBody.accountLeadPairs[0].lead;

      expect(lead.profileUrl).toBe('https://linkedin.com/in/johndoe/');
    });
  });
});
