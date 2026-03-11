/** PlusVibe Email Provider.
 *  Wraps PlusVibe API behind the EmailOutreachProvider interface.
 *  Uses direct API calls for campaign listing, stats, warmup, and lead push.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { logError } from '@/lib/utils/logger';
import type {
  EmailOutreachProvider,
  EmailCampaign,
  EmailCampaignStats,
  WarmupStatus,
  OutreachLead,
  IntegrationTier,
} from './types';

// ─── Constants ───────────────────────────────────────────

const LOG_CTX = 'plusvibe-provider';
const BASE_URL = 'https://api.plusvibe.ai/api/v1';
const TIMEOUT_MS = 15_000;

// ─── Provider ────────────────────────────────────────────

export class PlusVibeEmailProvider implements EmailOutreachProvider {
  readonly id = 'plusvibe' as const;
  readonly name = 'PlusVibe';
  readonly integrationTier: IntegrationTier = 'provisionable';

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await this.request('/campaign/list', 'GET');
      return res.ok;
    } catch {
      return false;
    }
  }

  async listCampaigns(): Promise<EmailCampaign[]> {
    try {
      const res = await this.request('/campaign/list', 'GET');
      if (!res.ok) return [];
      const json = await res.json();
      const campaigns = json.data || [];
      return campaigns.map((c: Record<string, unknown>) => ({
        id: String(c._id),
        name: String(c.camp_name || ''),
        status: String(c.status || 'unknown'),
      }));
    } catch (error) {
      logError(LOG_CTX, error, { method: 'listCampaigns' });
      return [];
    }
  }

  async getCampaignStats(campaignId: string): Promise<EmailCampaignStats> {
    try {
      const res = await this.request(
        `/analytics/campaign/summary?campaign_id=${campaignId}`,
        'GET',
      );
      if (!res.ok) return { sent: 0, opened: 0, replied: 0, bounced: 0 };
      const json = await res.json();
      const data = json.data || {};
      return {
        sent: Number(data.total_sent || 0),
        opened: Number(data.total_opened || 0),
        replied: Number(data.total_replied || 0),
        bounced: Number(data.total_bounced || 0),
      };
    } catch (error) {
      logError(LOG_CTX, error, { method: 'getCampaignStats', campaignId });
      return { sent: 0, opened: 0, replied: 0, bounced: 0 };
    }
  }

  async getWarmupStatus(): Promise<WarmupStatus[]> {
    try {
      const res = await this.request('/email-account/list', 'GET');
      if (!res.ok) return [];
      const json = await res.json();
      const accounts = json.data || [];
      return accounts.map((acc: Record<string, unknown>) => {
        const startedAt = acc.warmup_started_at
          ? new Date(acc.warmup_started_at as string)
          : null;
        const daysSinceStart = startedAt
          ? Math.floor((Date.now() - startedAt.getTime()) / 86400000)
          : 0;
        return {
          accountId: String(acc._id),
          email: String(acc.email || ''),
          isWarming: Boolean(acc.warmup_enabled),
          daysSinceStart,
        };
      });
    } catch (error) {
      logError(LOG_CTX, error, { method: 'getWarmupStatus' });
      return [];
    }
  }

  async addLeadsToCampaign(
    campaignId: string,
    leads: OutreachLead[],
  ): Promise<{ added: number }> {
    try {
      const res = await this.request('/lead/add', 'POST', {
        campaign_id: campaignId,
        leads: leads.map((lead) => ({
          email: lead.email || '',
          first_name: lead.firstName || '',
          last_name: lead.lastName || '',
          company_name: lead.company || '',
          linkedin_person_url: lead.linkedinUrl || '',
          custom_variables: lead.customFields || {},
        })),
      });
      if (!res.ok) return { added: 0 };
      const json = await res.json();
      return { added: Number(json.added_count ?? leads.length) };
    } catch (error) {
      logError(LOG_CTX, error, { method: 'addLeadsToCampaign', campaignId });
      return { added: 0 };
    }
  }

  // ─── Private Helpers ─────────────────────────────────

  private async request(path: string, method: string, body?: unknown): Promise<Response> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
    };
    const options: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    };
    if (body) options.body = JSON.stringify(body);
    return fetch(`${BASE_URL}${path}`, options);
  }
}
