// HeyReach API Client
// Docs: https://api.heyreach.io/api/public
// Note: AddLeadsToCampaign is the correct endpoint (NOT AddLeadsToListV2 which returns 404)

import type {
  HeyReachContact,
  HeyReachCampaign,
  HeyReachLinkedInAccount,
  AddContactsResult,
} from './types';

const HEYREACH_BASE_URL = 'https://api.heyreach.io/api/public';
const TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/** HTTP status codes that should trigger a retry */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export class HeyReachClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Test the API connection by fetching 1 campaign.
   * Returns true if the API responds with 200, false otherwise.
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${HEYREACH_BASE_URL}/campaign/GetAll`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ offset: 0, limit: 1 }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * List all campaigns with optional pagination.
   */
  async listCampaigns(params?: {
    offset?: number;
    limit?: number;
  }): Promise<{
    campaigns: HeyReachCampaign[];
    total: number;
    error?: string;
  }> {
    try {
      const response = await fetch(`${HEYREACH_BASE_URL}/campaign/GetAll`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          offset: params?.offset ?? 0,
          limit: params?.limit ?? 100,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorMessage = await this.parseErrorMessage(response);
        return { campaigns: [], total: 0, error: `HTTP ${response.status}: ${errorMessage}` };
      }

      const data = await response.json();
      const campaigns: HeyReachCampaign[] = (data.items ?? data ?? []).map(
        (c: Record<string, unknown>) => ({
          id: c.id,
          name: c.name,
          status: c.status,
          createdAt: c.createdAt,
        })
      );

      return { campaigns, total: data.totalCount ?? campaigns.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { campaigns: [], total: 0, error: message };
    }
  }

  /**
   * List all LinkedIn accounts connected to HeyReach.
   */
  async listLinkedInAccounts(): Promise<{
    accounts: HeyReachLinkedInAccount[];
    error?: string;
  }> {
    try {
      const response = await fetch(`${HEYREACH_BASE_URL}/linkedin/GetAll`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) {
        const errorMessage = await this.parseErrorMessage(response);
        return { accounts: [], error: `HTTP ${response.status}: ${errorMessage}` };
      }

      const data = await response.json();
      const accounts: HeyReachLinkedInAccount[] = (data ?? []).map(
        (a: Record<string, unknown>) => ({
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
          emailAddress: a.emailAddress,
          isActive: a.isActive,
          authIsValid: a.authIsValid,
          profileUrl: a.profileUrl,
        })
      );

      return { accounts };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return { accounts: [], error: message };
    }
  }

  /**
   * Add contacts to a HeyReach campaign with retry logic.
   *
   * Retries on 5xx, 408, 429, and network errors.
   * Does NOT retry on other 4xx errors (400, 401, 403, 422, etc.).
   * Uses exponential backoff: 1s, 2s, 4s.
   *
   * IMPORTANT: LinkedIn URLs MUST have trailing slash (HeyReach API quirk).
   * Custom fields are sent as customUserFields: [{name, value}] on the lead object.
   */
  async addContactsToCampaign(
    campaignId: number,
    contacts: HeyReachContact[]
  ): Promise<AddContactsResult> {
    if (contacts.length === 0) {
      return { success: true, added: 0 };
    }

    let lastError: string | undefined;

    for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
      // Wait before retry (exponential backoff)
      if (attempt > 0) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        await this.delay(delayMs);
      }

      try {
        const response = await fetch(
          `${HEYREACH_BASE_URL}/campaign/AddLeadsToCampaign`,
          {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
              campaignId,
              accountLeadPairs: contacts.map((contact) => ({
                linkedInAccountId: null,
                lead: this.buildLeadPayload(contact),
              })),
            }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
          }
        );

        if (response.ok) {
          return { success: true, added: contacts.length };
        }

        // Parse error message
        const errorMessage = await this.parseErrorMessage(response);
        lastError = `HTTP ${response.status}: ${errorMessage}`;

        // Only retry on retryable status codes
        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          return { success: false, added: 0, error: lastError };
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : 'Unknown error';
        // Network errors are retryable -- continue to next attempt
      }
    }

    return { success: false, added: 0, error: lastError };
  }

  /**
   * Build the lead payload for HeyReach API.
   * Ensures LinkedIn URLs have trailing slash and converts customFields
   * to the customUserFields array format expected by the API.
   */
  private buildLeadPayload(contact: HeyReachContact): Record<string, unknown> {
    const lead: Record<string, unknown> = {};

    if (contact.linkedinUrl) {
      lead.profileUrl = contact.linkedinUrl.endsWith('/')
        ? contact.linkedinUrl
        : `${contact.linkedinUrl}/`;
    }

    if (contact.firstName) lead.firstName = contact.firstName;
    if (contact.lastName) lead.lastName = contact.lastName;
    if (contact.email) lead.emailAddress = contact.email;
    if (contact.company) lead.companyName = contact.company;

    if (contact.customFields && Object.keys(contact.customFields).length > 0) {
      lead.customUserFields = Object.entries(contact.customFields).map(
        ([name, value]) => ({ name, value })
      );
    }

    return lead;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey,
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

// ============================================
// Backward-compatible function export
// Used by Engagement Intelligence feature
// ============================================

/**
 * Push leads to a HeyReach campaign using the global HEYREACH_API_KEY env var.
 * This is the backward-compatible wrapper around HeyReachClient.addContactsToCampaign().
 */
export async function pushLeadsToHeyReach(
  campaignId: string,
  leads: Array<{
    profileUrl: string;
    firstName?: string;
    lastName?: string;
    customVariables?: Record<string, string>;
  }>
): Promise<{ success: boolean; added: number; error?: string }> {
  const apiKey = process.env.HEYREACH_API_KEY;
  if (!apiKey) {
    return { success: false, added: 0, error: 'HEYREACH_API_KEY not set' };
  }

  const client = new HeyReachClient(apiKey);

  const contacts: HeyReachContact[] = leads.slice(0, 100).map((lead) => ({
    linkedinUrl: lead.profileUrl,
    firstName: lead.firstName || '',
    lastName: lead.lastName || '',
    customFields: lead.customVariables,
  }));

  return client.addContactsToCampaign(Number(campaignId), contacts);
}
