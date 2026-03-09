import type {
  KajabiCreateContactPayload,
  KajabiContactResponse,
  KajabiTagRelationship,
  KajabiTagsListResponse,
} from './types';

const KAJABI_BASE_URL = 'https://api.kajabi.com/v1';
const TIMEOUT_MS = 10_000;

export class KajabiClient {
  private apiKey: string;
  private siteId: string;

  constructor(apiKey: string, siteId: string) {
    this.apiKey = apiKey;
    this.siteId = siteId;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${KAJABI_BASE_URL}/contacts?page[size]=1`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async createContact(email: string, name?: string): Promise<{ id: string }> {
    const payload: KajabiCreateContactPayload = {
      data: {
        type: 'contacts',
        attributes: {
          email,
          ...(name ? { name } : {}),
          subscribed: true,
        },
        relationships: {
          site: {
            data: { type: 'sites', id: this.siteId },
          },
        },
      },
    };

    const response = await fetch(`${KAJABI_BASE_URL}/contacts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await this.parseErrorMessage(response);
      throw new Error(`Kajabi createContact failed (${response.status}): ${errorText}`);
    }

    const data: KajabiContactResponse = await response.json();
    return { id: data.data.id };
  }

  async addTagsToContact(contactId: string, tagIds: string[]): Promise<void> {
    if (tagIds.length === 0) return;

    const body: KajabiTagRelationship = {
      data: tagIds.map((id) => ({ type: 'tags', id })),
    };

    const response = await fetch(
      `${KAJABI_BASE_URL}/contacts/${contactId}/relationships/tags`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );

    if (!response.ok) {
      const errorText = await this.parseErrorMessage(response);
      throw new Error(`Kajabi addTags failed (${response.status}): ${errorText}`);
    }
  }

  async listTags(): Promise<{ id: string; name: string }[]> {
    try {
      const response = await fetch(`${KAJABI_BASE_URL}/contact_tags`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!response.ok) return [];

      const data: KajabiTagsListResponse = await response.json();
      return data.data.map((tag) => ({
        id: tag.id,
        name: tag.attributes.name,
      }));
    } catch {
      return [];
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/vnd.api+json',
      Accept: 'application/vnd.api+json',
    };
  }

  private async parseErrorMessage(response: Response): Promise<string> {
    try {
      const body = await response.json();
      if (body.errors && Array.isArray(body.errors)) {
        return body.errors.map((e: { detail?: string }) => e.detail || 'Unknown error').join(', ');
      }
      return body.message || body.error || 'Unknown error';
    } catch {
      return 'Unknown error';
    }
  }
}
