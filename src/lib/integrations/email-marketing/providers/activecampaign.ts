import type {
  EmailMarketingProvider,
  EmailMarketingList,
  EmailMarketingTag,
  ProviderCredentials,
  SubscribeParams,
  SubscribeResult,
} from '../types';

const MAX_PAGES = 50;

export class ActiveCampaignProvider implements EmailMarketingProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(credentials: ProviderCredentials) {
    this.apiKey = credentials.apiKey;
    const rawBaseUrl = credentials.metadata?.base_url ?? '';
    if (rawBaseUrl && !/^https:\/\/[\w-]+\.api-us1\.com\/?$/i.test(rawBaseUrl)) {
      throw new Error('Invalid ActiveCampaign API URL. Expected format: https://<account>.api-us1.com');
    }
    // Ensure base URL doesn't have trailing slash
    this.baseUrl = `${rawBaseUrl.replace(/\/$/, '')}/api/3`;
  }

  private headers(): Record<string, string> {
    return {
      'Api-Token': this.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async validateCredentials(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/lists?limit=1`, {
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
    let total = 0;
    let pages = 0;

    do {
      if (++pages > MAX_PAGES) {
        console.warn('[activecampaign] getLists pagination exceeded max pages');
        break;
      }

      const res = await fetch(`${this.baseUrl}/lists?limit=100&offset=${offset}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new Error(`ActiveCampaign API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      total = parseInt(data.meta?.total ?? '0', 10);

      for (const list of data.lists ?? []) {
        lists.push({ id: String(list.id), name: list.name });
      }

      offset += 100;
    } while (offset < total);

    return lists;
  }

  async getTags(): Promise<EmailMarketingTag[]> {
    const tags: EmailMarketingTag[] = [];
    let offset = 0;
    let total = 0;
    let pages = 0;

    do {
      if (++pages > MAX_PAGES) {
        console.warn('[activecampaign] getTags pagination exceeded max pages');
        break;
      }

      const res = await fetch(`${this.baseUrl}/tags?limit=100&offset=${offset}`, {
        headers: this.headers(),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        throw new Error(`ActiveCampaign API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json();
      total = parseInt(data.meta?.total ?? '0', 10);

      // NOTE: ActiveCampaign uses `tag` field, NOT `name`
      for (const tag of data.tags ?? []) {
        tags.push({ id: String(tag.id), name: tag.tag });
      }

      offset += 100;
    } while (offset < total);

    return tags;
  }

  async subscribe(params: SubscribeParams): Promise<SubscribeResult> {
    try {
      let contactId: string;

      // Step 1: Create or find contact
      const contactBody: Record<string, unknown> = {
        contact: {
          email: params.email,
          ...(params.firstName ? { firstName: params.firstName } : {}),
        },
      };

      const createRes = await fetch(`${this.baseUrl}/contacts`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(contactBody),
        signal: AbortSignal.timeout(10_000),
      });

      if (createRes.status === 422) {
        // Duplicate contact — search for existing
        const searchRes = await fetch(
          `${this.baseUrl}/contacts?email=${encodeURIComponent(params.email)}`,
          { headers: this.headers(), signal: AbortSignal.timeout(10_000) }
        );

        if (!searchRes.ok) {
          return {
            success: false,
            error: `Failed to find existing contact: ${searchRes.status}`,
          };
        }

        const searchData = await searchRes.json();
        const contacts = searchData.contacts ?? [];
        if (contacts.length === 0) {
          return {
            success: false,
            error: 'Contact reported as duplicate but not found',
          };
        }

        contactId = String(contacts[0].id);
      } else if (!createRes.ok) {
        const errorData = await createRes.json().catch(() => null);
        return {
          success: false,
          error: errorData?.message ?? `ActiveCampaign API error: ${createRes.status}`,
        };
      } else {
        const createData = await createRes.json();
        contactId = String(createData.contact.id);
      }

      // Step 2: Add contact to list
      const listRes = await fetch(`${this.baseUrl}/contactLists`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          contactList: {
            list: parseInt(params.listId, 10),
            contact: parseInt(contactId, 10),
            status: 1,
          },
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!listRes.ok) {
        const errorData = await listRes.json().catch(() => null);
        return {
          success: false,
          error: errorData?.message ?? `Failed to add contact to list: ${listRes.status}`,
        };
      }

      // Step 3: Apply tag if specified
      if (params.tagId) {
        const tagRes = await fetch(`${this.baseUrl}/contactTags`, {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({
            contactTag: {
              contact: contactId,
              tag: params.tagId,
            },
          }),
          signal: AbortSignal.timeout(10_000),
        });

        if (!tagRes.ok) {
          return {
            success: true,
            error: `Contact added to list but tag application failed: ${tagRes.status}`,
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
