import type {
  EmailMarketingProvider,
  EmailMarketingList,
  EmailMarketingTag,
  ProviderCredentials,
  SubscribeParams,
  SubscribeResult,
} from '../types';

const BASE_URL = 'https://api.kit.com/v4';
const MAX_PAGES = 50;

export class KitProvider implements EmailMarketingProvider {
  private apiKey: string;

  constructor(credentials: ProviderCredentials) {
    this.apiKey = credentials.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      'X-Kit-Api-Key': this.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/forms?per_page=1`, {
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
    let cursor: string | null = null;
    let pages = 0;

    do {
      if (++pages > MAX_PAGES) {
        console.warn('[kit] getLists pagination exceeded max pages');
        break;
      }

      const url: string = cursor
        ? `${BASE_URL}/forms?per_page=100&after=${cursor}`
        : `${BASE_URL}/forms?per_page=100`;

      const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        throw new Error(`Kit API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      for (const form of data.forms ?? []) {
        lists.push({ id: String(form.id), name: form.name });
      }

      cursor = data.pagination?.has_next_page ? data.pagination.end_cursor : null;
    } while (cursor);

    return lists;
  }

  async getTags(): Promise<EmailMarketingTag[]> {
    const tags: EmailMarketingTag[] = [];
    let cursor: string | null = null;
    let pages = 0;

    do {
      if (++pages > MAX_PAGES) {
        console.warn('[kit] getTags pagination exceeded max pages');
        break;
      }

      const url: string = cursor
        ? `${BASE_URL}/tags?per_page=100&after=${cursor}`
        : `${BASE_URL}/tags?per_page=100`;

      const res = await fetch(url, { headers: this.headers(), signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        throw new Error(`Kit API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      for (const tag of data.tags ?? []) {
        tags.push({ id: String(tag.id), name: tag.name });
      }

      cursor = data.pagination?.has_next_page ? data.pagination.end_cursor : null;
    } while (cursor);

    return tags;
  }

  async subscribe(params: SubscribeParams): Promise<SubscribeResult> {
    try {
      // Step 1: Subscribe to the form
      const body: Record<string, string> = { email_address: params.email };
      if (params.firstName) {
        body.first_name = params.firstName;
      }

      const res = await fetch(`${BASE_URL}/forms/${params.listId}/subscribers`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        return {
          success: false,
          error: errorData?.message ?? `Kit API error: ${res.status}`,
        };
      }

      // Step 2: Apply tag if specified
      if (params.tagId) {
        const tagRes = await fetch(`${BASE_URL}/tags/${params.tagId}/subscribers`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ email_address: params.email }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!tagRes.ok) {
          // Subscriber was added but tag failed — still return success with warning
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
