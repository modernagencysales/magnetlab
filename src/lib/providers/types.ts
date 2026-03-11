/** Provider Types.
 *  Capability interfaces for the provider abstraction layer.
 *  Providers implement these interfaces; agents call capability methods.
 *  Never imports NextRequest, NextResponse, or cookies. */

// ─── Shared Types ───────────────────────────────────────

export type IntegrationTier = 'provisionable' | 'api_connected' | 'guided';
export type CapabilityType = 'dm_outreach' | 'email_outreach' | 'domain';

export interface ProviderRegistryEntry {
  id: string;
  name: string;
  capability: CapabilityType;
  integrationTier: IntegrationTier;
  status: 'recommended' | 'supported' | 'deprecated';
  provisionable: boolean;
  hasAgencyPricing: boolean;
}

export interface ProviderConfig {
  id: string;
  user_id: string;
  capability: CapabilityType;
  provider_id: string;
  integration_tier: IntegrationTier;
  api_key_encrypted: string | null;
  config: Record<string, unknown>;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export const PROVIDER_CONFIG_COLUMNS =
  'id, user_id, capability, provider_id, integration_tier, api_key_encrypted, config, verified_at, created_at, updated_at';

// ─── DM Outreach Capability ────────────────────────────

export interface DmCampaignConfig {
  name: string;
  linkedinAccountId?: number;
  messageTemplate?: string;
}

export interface DmCampaign {
  id: string;
  name: string;
  status: string;
}

export interface DmCampaignStats {
  sent: number;
  accepted: number;
  replied: number;
  pending: number;
}

export interface OutreachLead {
  linkedinUrl: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
  customFields?: Record<string, string>;
}

export interface DmOutreachProvider {
  readonly id: string;
  readonly name: string;
  readonly integrationTier: IntegrationTier;

  testConnection(): Promise<boolean>;
  listCampaigns(): Promise<DmCampaign[]>;
  addLeadsToCampaign(campaignId: string, leads: OutreachLead[]): Promise<{ added: number }>;
  getCampaignStats(campaignId: string): Promise<DmCampaignStats>;
}

// ─── Email Outreach Capability ─────────────────────────

export interface EmailCampaignConfig {
  name: string;
  workspaceId?: string;
}

export interface EmailCampaign {
  id: string;
  name: string;
  status: string;
}

export interface EmailCampaignStats {
  sent: number;
  opened: number;
  replied: number;
  bounced: number;
}

export interface WarmupStatus {
  accountId: string;
  email: string;
  isWarming: boolean;
  daysSinceStart: number;
  healthScore?: number;
}

export interface EmailOutreachProvider {
  readonly id: string;
  readonly name: string;
  readonly integrationTier: IntegrationTier;

  testConnection(): Promise<boolean>;
  listCampaigns(): Promise<EmailCampaign[]>;
  getCampaignStats(campaignId: string): Promise<EmailCampaignStats>;
  getWarmupStatus(): Promise<WarmupStatus[]>;
  addLeadsToCampaign(campaignId: string, leads: OutreachLead[]): Promise<{ added: number }>;
}

// ─── Domain Provisioning Capability ────────────────────

export interface DomainAvailability {
  domain: string;
  available: boolean;
  price?: number;
}

export interface DomainProvider {
  readonly id: string;
  readonly name: string;
  readonly integrationTier: IntegrationTier;

  checkAvailability(domain: string): Promise<DomainAvailability>;
  // purchase, setupDns, provisionMailboxes deferred to Phase 2.5
}

// ─── Guided Fallback ───────────────────────────────────

export interface GuidedStep {
  stepNumber: number;
  title: string;
  instructions: string;
  verificationPrompt?: string;
}

export interface ChecklistItem {
  item: string;
  required: boolean;
}

export interface GuidedProvider {
  readonly id: 'guided';
  readonly name: string;

  getSetupSteps(capability: CapabilityType): GuidedStep[];
  getVerificationChecklist(capability: CapabilityType): ChecklistItem[];
}
