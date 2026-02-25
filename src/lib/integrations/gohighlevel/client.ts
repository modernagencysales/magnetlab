// GoHighLevel API v1 Client

import type { GHLContactPayload, GHLContactResponse } from './types';

const GHL_BASE_URL = 'https://rest.gohighlevel.com/v1';
const TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/** HTTP status codes that should trigger a retry */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export interface RetryOptions {
  maxRetries?: number;
}

export interface CreateContactResult {
  success: boolean;
  contactId?: string;
  error?: string;
}

export class GoHighLevelClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Test the API connection by fetching 1 contact.
   * Returns true if the API responds with 200, false otherwise.
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${GHL_BASE_URL}/contacts/?limit=1`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Create a contact in GoHighLevel with retry logic.
   *
   * Retries on 5xx, 408, 429, and network errors.
   * Does NOT retry on other 4xx errors (400, 401, 403, 422, etc.).
   * Uses exponential backoff: 1s, 2s, 4s.
   */
  async createContact(
    payload: GHLContactPayload,
    retryOptions?: RetryOptions
  ): Promise<CreateContactResult> {
    const maxRetries = retryOptions?.maxRetries ?? DEFAULT_MAX_RETRIES;

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      // Wait before retry (exponential backoff)
      if (attempt > 0) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await this.delay(delayMs);
      }

      try {
        const response = await fetch(`${GHL_BASE_URL}/contacts/`, {
          method: 'POST',
          headers: {
            ...this.getHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (response.ok) {
          const data: GHLContactResponse = await response.json();
          return {
            success: true,
            contactId: data.contact.id,
          };
        }

        // Parse error message
        const errorMessage = await this.parseErrorMessage(response);
        lastError = `HTTP ${response.status}: ${errorMessage}`;

        // Only retry on retryable status codes
        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          return { success: false, error: lastError };
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
        // Network errors are retryable — continue to next attempt
      }
    }

    return { success: false, error: lastError };
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
    };
  }

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const body = await response.json();
      return body.message || body.error || 'Unknown error';
    } catch {
      return 'Unknown error';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
