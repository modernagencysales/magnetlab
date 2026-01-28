// Loops.so API Client
// Base URL: https://app.loops.so/api/v1
// Auth: Authorization: Bearer <api_key>
// Docs: https://loops.so/docs/api-reference

import { BaseApiClient, ApiResponse } from './base-client';
import type {
  LoopsContact,
  LoopsEvent,
  LoopsTransactionalEmail,
  LoopsApiResponse,
} from '@/lib/types/email';

export interface LoopsConfig {
  apiKey: string;
}

export interface CreateTransactionalEmailRequest {
  name: string;
  subject: string;
  body: string; // HTML body
  fromName?: string;
  replyTo?: string;
}

export interface TransactionalEmailResponse {
  id: string;
  name: string;
  subject: string;
  from: string;
  replyTo?: string;
}

export class LoopsClient extends BaseApiClient {
  constructor(config: LoopsConfig) {
    super({
      baseUrl: 'https://app.loops.so/api/v1',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
      },
    });
  }

  // ============================================
  // API KEY VERIFICATION
  // ============================================

  /**
   * Verify the API key by fetching the API key info
   */
  async verifyApiKey(): Promise<{ valid: boolean; error?: string }> {
    try {
      // Use the contacts endpoint to verify - if it returns 401, key is invalid
      const result = await this.get<{ success: boolean }>('/contacts');

      if (result.status === 401 || result.status === 403) {
        return { valid: false, error: 'Invalid API key' };
      }

      if (result.error) {
        // Check if it's an auth error
        if (result.error.includes('401') || result.error.includes('403') ||
            result.error.toLowerCase().includes('unauthorized')) {
          return { valid: false, error: 'Invalid API key' };
        }
        // Other errors might still mean the key is valid
        return { valid: true };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  // ============================================
  // CONTACTS
  // ============================================

  /**
   * Create or update a contact in Loops
   */
  async createContact(contact: LoopsContact): Promise<ApiResponse<LoopsApiResponse>> {
    return this.post<LoopsApiResponse>('/contacts/create', contact);
  }

  /**
   * Update a contact by email
   */
  async updateContact(
    email: string,
    updates: Partial<LoopsContact>
  ): Promise<ApiResponse<LoopsApiResponse>> {
    return this.put<LoopsApiResponse>('/contacts/update', { email, ...updates });
  }

  /**
   * Find a contact by email
   */
  async findContact(email: string): Promise<ApiResponse<LoopsContact[]>> {
    return this.get<LoopsContact[]>(`/contacts/find?email=${encodeURIComponent(email)}`);
  }

  /**
   * Delete a contact by email or userId
   */
  async deleteContact(params: { email?: string; userId?: string }): Promise<ApiResponse<LoopsApiResponse>> {
    return this.post<LoopsApiResponse>('/contacts/delete', params);
  }

  // ============================================
  // EVENTS
  // ============================================

  /**
   * Send an event to Loops
   * Events can trigger automations/sequences
   */
  async sendEvent(event: LoopsEvent): Promise<ApiResponse<LoopsApiResponse>> {
    return this.post<LoopsApiResponse>('/events/send', event);
  }

  // ============================================
  // TRANSACTIONAL EMAILS
  // ============================================

  /**
   * List all transactional emails
   */
  async listTransactionalEmails(): Promise<ApiResponse<TransactionalEmailResponse[]>> {
    return this.get<TransactionalEmailResponse[]>('/transactional');
  }

  /**
   * Send a transactional email
   */
  async sendTransactionalEmail(
    params: LoopsTransactionalEmail
  ): Promise<ApiResponse<LoopsApiResponse>> {
    return this.post<LoopsApiResponse>('/transactional', params);
  }

  // ============================================
  // MAILING LISTS
  // ============================================

  /**
   * List all mailing lists
   */
  async listMailingLists(): Promise<ApiResponse<Array<{ id: string; name: string }>>> {
    return this.get<Array<{ id: string; name: string }>>('/lists');
  }

  // ============================================
  // CUSTOM FIELDS
  // ============================================

  /**
   * List all custom fields
   */
  async listCustomFields(): Promise<ApiResponse<Array<{
    key: string;
    label: string;
    type: string
  }>>> {
    return this.get<Array<{ key: string; label: string; type: string }>>('/contacts/customFields');
  }

  // ============================================
  // HEALTH CHECK
  // ============================================

  async verifyConnection(): Promise<{ connected: boolean; error?: string }> {
    const result = await this.verifyApiKey();
    return { connected: result.valid, error: result.error };
  }
}

// Factory function for user-specific API key
export function createLoopsClientWithKey(apiKey: string): LoopsClient {
  return new LoopsClient({ apiKey });
}

// Helper to get user's Loops API key from database
import { getUserIntegration } from '@/lib/utils/encrypted-storage';

export async function getUserLoopsClient(userId: string): Promise<LoopsClient | null> {
  // Get integration with decrypted API key
  const integration = await getUserIntegration(userId, 'loops');

  if (!integration?.api_key || !integration.is_active) {
    return null;
  }

  return new LoopsClient({ apiKey: integration.api_key });
}

// ============================================
// LEAD SYNC HELPERS
// ============================================

export interface LeadSyncData {
  email: string;
  firstName?: string;
  leadMagnetId: string;
  leadMagnetTitle: string;
  funnelSlug: string;
  source?: string;
}

/**
 * Sync a lead to Loops and trigger the welcome sequence
 */
export async function syncLeadToLoops(
  client: LoopsClient,
  data: LeadSyncData
): Promise<{ success: boolean; contactId?: string; error?: string }> {
  try {
    // 1. Create or update the contact
    const contactResult = await client.createContact({
      email: data.email,
      firstName: data.firstName,
      source: data.source || 'magnetlab',
      // Custom properties for the contact
      leadMagnetId: data.leadMagnetId,
      leadMagnetTitle: data.leadMagnetTitle,
      funnelSlug: data.funnelSlug,
    });

    if (contactResult.error) {
      return { success: false, error: contactResult.error };
    }

    // 2. Send the lead_magnet_downloaded event to trigger sequence
    const eventResult = await client.sendEvent({
      email: data.email,
      eventName: 'lead_magnet_downloaded',
      eventProperties: {
        leadMagnetId: data.leadMagnetId,
        leadMagnetTitle: data.leadMagnetTitle,
        funnelSlug: data.funnelSlug,
      },
    });

    if (eventResult.error) {
      // Contact was created but event failed
      return {
        success: true,
        contactId: contactResult.data?.id,
        error: `Contact created but event failed: ${eventResult.error}`
      };
    }

    return {
      success: true,
      contactId: contactResult.data?.id
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
