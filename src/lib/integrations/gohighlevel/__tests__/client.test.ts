/**
 * @jest-environment node
 */

import { GoHighLevelClient } from '../client';
import type { GHLContactPayload } from '../types';

// Use the global fetch mock from jest.setup.js
const mockFetch = global.fetch as jest.Mock;

const API_KEY = 'test-ghl-api-key';
const BASE_URL = 'https://rest.gohighlevel.com/v1';

function createClient() {
  return new GoHighLevelClient(API_KEY);
}

describe('GoHighLevelClient', () => {
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
        json: async () => ({ contacts: [] }),
      });

      const client = createClient();
      const result = await client.testConnection();

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/contacts/?limit=1`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: `Bearer ${API_KEY}`,
          }),
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

  describe('createContact', () => {
    const payload: GHLContactPayload = {
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      tags: ['lead-magnet'],
      source: 'magnetlab',
    };

    it('succeeds and returns contactId on 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          contact: {
            id: 'ghl-contact-123',
            email: 'test@example.com',
            tags: ['lead-magnet'],
          },
        }),
      });

      const client = createClient();
      const result = await client.createContact(payload);

      expect(result).toEqual({
        success: true,
        contactId: 'ghl-contact-123',
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        `${BASE_URL}/contacts/`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(payload),
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('returns error on 401 without retrying', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const client = createClient();
      const result = await client.createContact(payload);

      expect(result).toEqual({
        success: false,
        error: 'HTTP 401: Unauthorized',
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns error on 400 without retrying', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message: 'Bad Request' }),
      });

      const client = createClient();
      const result = await client.createContact(payload);

      expect(result).toEqual({
        success: false,
        error: 'HTTP 400: Bad Request',
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns error on 422 without retrying', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ message: 'Unprocessable Entity' }),
      });

      const client = createClient();
      const result = await client.createContact(payload);

      expect(result).toEqual({
        success: false,
        error: 'HTTP 422: Unprocessable Entity',
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('retries on 500 and succeeds on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ message: 'Internal Server Error' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            contact: {
              id: 'ghl-contact-456',
              email: 'test@example.com',
              tags: ['lead-magnet'],
            },
          }),
        });

      const client = createClient();
      const resultPromise = client.createContact(payload);

      // Advance past the first retry delay (1s)
      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result).toEqual({
        success: true,
        contactId: 'ghl-contact-456',
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 502 and succeeds', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => ({ message: 'Bad Gateway' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            contact: {
              id: 'ghl-contact-789',
              email: 'test@example.com',
              tags: [],
            },
          }),
        });

      const client = createClient();
      const resultPromise = client.createContact(payload);

      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result).toEqual({
        success: true,
        contactId: 'ghl-contact-789',
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 408 (Request Timeout)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 408,
          json: async () => ({ message: 'Request Timeout' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            contact: {
              id: 'ghl-contact-timeout',
              email: 'test@example.com',
              tags: [],
            },
          }),
        });

      const client = createClient();
      const resultPromise = client.createContact(payload);

      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result).toEqual({
        success: true,
        contactId: 'ghl-contact-timeout',
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('retries on 429 (Rate Limited)', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ message: 'Too Many Requests' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            contact: {
              id: 'ghl-contact-rate',
              email: 'test@example.com',
              tags: [],
            },
          }),
        });

      const client = createClient();
      const resultPromise = client.createContact(payload);

      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result).toEqual({
        success: true,
        contactId: 'ghl-contact-rate',
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('gives up after max retries on persistent 5xx', async () => {
      mockFetch
        .mockResolvedValue({
          ok: false,
          status: 503,
          json: async () => ({ message: 'Service Unavailable' }),
        });

      const client = createClient();
      const resultPromise = client.createContact(payload);

      // Advance past all retry delays: 1s + 2s + 4s
      await jest.advanceTimersByTimeAsync(1000); // retry 1
      await jest.advanceTimersByTimeAsync(2000); // retry 2
      await jest.advanceTimersByTimeAsync(4000); // retry 3

      const result = await resultPromise;

      expect(result).toEqual({
        success: false,
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
          json: async () => ({
            contact: {
              id: 'ghl-contact-recovered',
              email: 'test@example.com',
              tags: [],
            },
          }),
        });

      const client = createClient();
      const resultPromise = client.createContact(payload);

      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result).toEqual({
        success: true,
        contactId: 'ghl-contact-recovered',
      });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('gives up after max retries on persistent network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const client = createClient();
      const resultPromise = client.createContact(payload);

      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(2000);
      await jest.advanceTimersByTimeAsync(4000);

      const result = await resultPromise;

      expect(result).toEqual({
        success: false,
        error: 'Connection refused',
      });
      // 1 initial + 3 retries = 4 calls
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('respects custom retry options', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server Error' }),
      });

      const client = createClient();
      const resultPromise = client.createContact(payload, { maxRetries: 1 });

      await jest.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      expect(result).toEqual({
        success: false,
        error: 'HTTP 500: Server Error',
      });
      // 1 initial + 1 retry = 2 calls
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('uses exponential backoff (1s, 2s, 4s)', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server Error' }),
      });

      const client = createClient();
      const resultPromise = client.createContact(payload);

      // Initial call happens immediately
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // After 999ms, no retry yet
      await jest.advanceTimersByTimeAsync(999);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // At 1000ms, first retry fires
      await jest.advanceTimersByTimeAsync(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // After another 1999ms (total 3s from start), no second retry yet
      await jest.advanceTimersByTimeAsync(1999);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // At 3000ms from start (2000ms after first retry), second retry fires
      await jest.advanceTimersByTimeAsync(1);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // After another 3999ms (total 7s from start), no third retry yet
      await jest.advanceTimersByTimeAsync(3999);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // At 7000ms from start (4000ms after second retry), third retry fires
      await jest.advanceTimersByTimeAsync(1);
      expect(mockFetch).toHaveBeenCalledTimes(4);

      await resultPromise;
    });

    it('handles json parse errors in error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => { throw new Error('not json'); },
      });

      const client = createClient();
      const result = await client.createContact(payload);

      expect(result).toEqual({
        success: false,
        error: 'HTTP 403: Unknown error',
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
