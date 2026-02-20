import type {
  EmailMarketingProvider,
  EmailMarketingList,
  EmailMarketingTag,
  ProviderCredentials,
  SubscribeParams,
  SubscribeResult,
} from '../types';

const BASE_URL = 'https://connect.mailerlite.com/api';

export class MailerLiteProvider implements EmailMarketingProvider {
  private apiKey: string;

  constructor(credentials: ProviderCredentials) {
    this.apiKey = credentials.apiKey;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const res = await fetch(`${BASE_URL}/groups?limit=1`, {
        headers: this.headers(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async getLists(): Promise<EmailMarketingList[]> {
    const lists: EmailMarketingList[] = [];
    let page = 1;
    let lastPage = 1;

    do {
      const res = await fetch(`${BASE_URL}/groups?limit=50&page=${page}`, {
        headers: this.headers(),
      });
      if (!res.ok) {
        throw new Error(`MailerLite API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      for (const group of data.data ?? []) {
        lists.push({ id: String(group.id), name: group.name });
      }

      lastPage = data.meta?.last_page ?? 1;
      page++;
    } while (page <= lastPage);

    return lists;
  }

  async getTags(): Promise<EmailMarketingTag[]> {
    // MailerLite doesn't support tag-based subscriber tagging via API in this way
    return [];
  }

  async subscribe(params: SubscribeParams): Promise<SubscribeResult> {
    // MailerLite doesn't support per-subscriber tags via API.
    // tagId is intentionally ignored. The UI hides tag selection for this provider.
    try {
      const body: Record<string, unknown> = {
        email: params.email,
        groups: [params.listId],
      };

      if (params.firstName) {
        body.fields = { name: params.firstName };
      }

      const res = await fetch(`${BASE_URL}/subscribers`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        return {
          success: false,
          error: errorData?.message ?? `MailerLite API error: ${res.status}`,
        };
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
