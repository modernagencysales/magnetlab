import { createHash } from 'crypto';
import type {
  EmailMarketingProvider,
  EmailMarketingList,
  EmailMarketingTag,
  ProviderCredentials,
  SubscribeParams,
  SubscribeResult,
} from '../types';

const MAX_PAGES = 50;

export class MailchimpProvider implements EmailMarketingProvider {
  private apiKey: string;
  private serverPrefix: string;
  private baseUrl: string;

  constructor(credentials: ProviderCredentials) {
    this.apiKey = credentials.apiKey;
    this.serverPrefix = credentials.metadata?.server_prefix ?? '';
    if (this.serverPrefix && !/^[a-z]{2}\d+$/.test(this.serverPrefix)) {
      throw new Error('Invalid Mailchimp server prefix');
    }
    this.baseUrl = `https://${this.serverPrefix}.api.mailchimp.com/3.0`;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  private subscriberHash(email: string): string {
    return createHash('md5').update(email.toLowerCase()).digest('hex');
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/lists?count=1`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getLists(): Promise<EmailMarketingList[]> {
    const lists: EmailMarketingList[] = [];
    let offset = 0;
    let totalItems = 0;
    let pages = 0;

    do {
      if (++pages > MAX_PAGES) {
        console.warn('[mailchimp] getLists pagination exceeded max pages');
        break;
      }

      const res = await fetch(`${this.baseUrl}/lists?count=100&offset=${offset}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new Error(`Mailchimp API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      totalItems = data.total_items ?? 0;

      for (const list of data.lists ?? []) {
        lists.push({ id: String(list.id), name: list.name });
      }

      offset += 100;
    } while (offset < totalItems);

    return lists;
  }

  async getTags(listId?: string): Promise<EmailMarketingTag[]> {
    if (!listId) {
      return [];
    }

    const res = await fetch(`${this.baseUrl}/lists/${listId}/tag-search`, {
      headers: this.headers(),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      throw new Error(`Mailchimp API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return (data.tags ?? []).map((tag: { id: number; name: string }) => ({
      id: tag.name,  // Mailchimp tag API uses names, not numeric IDs
      name: tag.name,
    }));
  }

  async subscribe(params: SubscribeParams): Promise<SubscribeResult> {
    try {
      const hash = this.subscriberHash(params.email);

      // Step 1: Upsert subscriber
      const body: Record<string, unknown> = {
        email_address: params.email,
        status_if_new: 'subscribed',
      };

      if (params.firstName) {
        body.merge_fields = { FNAME: params.firstName };
      }

      const res = await fetch(`${this.baseUrl}/lists/${params.listId}/members/${hash}`, {
        method: 'PUT',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        return {
          success: false,
          error: errorData?.detail ?? `Mailchimp API error: ${res.status}`,
        };
      }

      // Step 2: Apply tag if specified (tagId stores the tag NAME for Mailchimp)
      if (params.tagId) {
        const tagRes = await fetch(
          `${this.baseUrl}/lists/${params.listId}/members/${hash}/tags`,
          {
            method: 'POST',
            headers: this.headers(),
            body: JSON.stringify({
              tags: [{ name: params.tagId, status: 'active' }],
            }),
            signal: AbortSignal.timeout(10_000),
          }
        );

        if (!tagRes.ok) {
          return {
            success: true,
            error: `Subscriber added but tag application failed: ${tagRes.status}`,
          };
        }
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }
}
