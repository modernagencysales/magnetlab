/** HeyReach DM Provider.
 *  Wraps the existing HeyReachClient behind the DmOutreachProvider interface.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { HeyReachClient } from '@/lib/integrations/heyreach/client';
import type {
  DmOutreachProvider,
  DmCampaign,
  DmCampaignStats,
  OutreachLead,
  IntegrationTier,
} from './types';

export class HeyReachDmProvider implements DmOutreachProvider {
  readonly id = 'heyreach' as const;
  readonly name = 'HeyReach';
  readonly integrationTier: IntegrationTier = 'provisionable';

  private client: HeyReachClient;

  constructor(apiKey: string) {
    this.client = new HeyReachClient(apiKey);
  }

  async testConnection(): Promise<boolean> {
    return this.client.testConnection();
  }

  async listCampaigns(): Promise<DmCampaign[]> {
    const { campaigns } = await this.client.listCampaigns();
    return campaigns.map((c) => ({
      id: String(c.id),
      name: c.name,
      status: c.status,
    }));
  }

  async addLeadsToCampaign(campaignId: string, leads: OutreachLead[]): Promise<{ added: number }> {
    const contacts = leads.map((lead) => ({
      linkedinUrl: lead.linkedinUrl,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email,
      company: lead.company,
      customFields: lead.customFields,
    }));
    const result = await this.client.addContactsToCampaign(Number(campaignId), contacts);
    return { added: result.added };
  }

  async getCampaignStats(_campaignId: string): Promise<DmCampaignStats> {
    // HeyReach doesn't expose per-campaign stats via public API
    return { sent: 0, accepted: 0, replied: 0, pending: 0 };
  }
}
