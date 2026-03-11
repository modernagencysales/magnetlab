# GTM Accelerator Phase 2 — Outreach & Provider Layer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add TAM building (M2), LinkedIn outreach (M3), and cold email (M4) agents with a provider abstraction layer that wraps existing integration clients.

**Architecture:** New provider interfaces define capabilities (DM outreach, email outreach, domain provisioning). Existing clients (HeyReach, PlusVibe, enrichment waterfall) are wrapped in interface-compliant providers and registered in a provider registry. Three new sub-agents use these providers through new actions. Guided fallback provides step-by-step instructions when no API integration is available.

**Tech Stack:** Next.js 15, TypeScript, Supabase, Claude API, existing HeyReach/PlusVibe/enrichment clients, Jest

### Deferred to Phase 2.5

The following spec items are intentionally deferred because they require gtm-system migration, Stripe checkout integration, or complex infrastructure provisioning that should be a separate implementation cycle:

- **ZapMail Domain Provider implementation**: Registry entry exists but provider is stubbed. Requires migrating Trigger.dev provisioning tasks from gtm-system.
- **Stripe checkout + provisioning flow**: The spec says "migrate provisioning Trigger.dev tasks and Stripe checkout logic into magnetlab." This is a multi-day effort involving Stripe Products, checkout sessions, and webhook handling — better as its own plan.
- **Provider Config UI**: Backend-only in this phase. The agents can configure providers via chat actions; a dedicated settings UI can be added in a follow-up.
- **Full provider interface methods** (createCampaign, pauseCampaign, resumeCampaign, createWorkspace, addAccounts, startWarmup, getDeliverabilityHealth): The interfaces include the core methods needed for Phase 2 agent flows. Campaign management and provisioning methods will be added when the infrastructure migration lands.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/lib/providers/types.ts` | Capability interfaces (DmOutreach, EmailOutreach, Domain, Guided) + registry types |
| `src/lib/providers/registry.ts` | Provider registry: resolve capability → provider instance |
| `src/lib/providers/errors.ts` | Shared provider error types (RateLimit, Unavailable, Auth) |
| `src/lib/providers/heyreach-dm.ts` | HeyReachDmProvider — wraps existing HeyReach client |
| `src/lib/providers/plusvibe-email.ts` | PlusVibeEmailProvider — wraps existing PlusVibe client + adds campaign/warmup methods |
| `src/lib/providers/guided-fallback.ts` | GuidedProvider — generates step-by-step instructions from SOPs |
| `src/lib/actions/providers.ts` | Provider actions for agent tool use (check_provider_status, create_outreach_campaign, etc.) |
| `src/lib/ai/copilot/sub-agents/tam-agent.ts` | TAM Builder Agent (M2) system prompt |
| `src/lib/ai/copilot/sub-agents/outreach-agent.ts` | Outreach Setup Agent (M3+M4) system prompt |
| `src/__tests__/lib/providers/registry.test.ts` | Provider registry tests |
| `src/__tests__/lib/providers/heyreach-dm.test.ts` | HeyReach DM provider tests |
| `src/__tests__/lib/providers/plusvibe-email.test.ts` | PlusVibe email provider tests |
| `src/__tests__/lib/providers/guided-fallback.test.ts` | Guided fallback tests |
| `src/__tests__/lib/actions/providers.test.ts` | Provider action tests |
| `src/__tests__/lib/ai/copilot/sub-agents/outreach-agent.test.ts` | Outreach agent prompt tests |
| `supabase/migrations/20260311100000_provider_config.sql` | provider_configs table |

### Modified Files

| File | Changes |
|------|---------|
| `src/lib/types/accelerator.ts` | Add `SubAgentType` values: `tam`, `outreach`. Add `PHASE2_MODULES` constant. Add new `DeliverableType` values: `tam_segment`, `dm_campaign`, `email_campaign`, `email_infrastructure` |
| `src/lib/ai/copilot/sub-agents/config.ts` | Add tam/outreach to AGENT_MODULE_MAP + switch cases + provider tool names |
| `src/lib/actions/index.ts` | Add `import './providers'` |
| `src/lib/actions/program.ts` | Update `create_deliverable` enum to include new deliverable types |
| `scripts/seed-sops.ts` | Add M2, M3, M4 module directories |

---

## Chunk 1: Provider Abstraction Layer

### Task 1: Database Migration — provider_configs table

**Files:**
- Create: `supabase/migrations/20260311100000_provider_config.sql`

Users store their chosen provider for each capability (dm_outreach, email_outreach, domain). This table tells the agent which provider to use per user.

- [ ] **Step 1: Write migration SQL**

```sql
-- Provider configuration per user per capability
CREATE TABLE IF NOT EXISTS provider_configs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  capability text NOT NULL, -- 'dm_outreach' | 'email_outreach' | 'domain'
  provider_id text NOT NULL, -- 'heyreach' | 'plusvibe' | 'zapmail' | 'guided'
  integration_tier text NOT NULL DEFAULT 'guided', -- 'provisionable' | 'api_connected' | 'guided'
  api_key_encrypted text, -- encrypted API key (null for provisionable/guided)
  config jsonb DEFAULT '{}'::jsonb, -- provider-specific config (campaign IDs, workspace IDs, etc.)
  verified_at timestamptz, -- when connection was last verified
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,

  CONSTRAINT uq_provider_config_user_capability UNIQUE (user_id, capability)
);

CREATE INDEX IF NOT EXISTS idx_provider_configs_user_id ON provider_configs(user_id);

-- RLS
ALTER TABLE provider_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to provider_configs"
  ON provider_configs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users read own provider_configs"
  ON provider_configs FOR SELECT
  USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER set_updated_at_provider_configs
  BEFORE UPDATE ON provider_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2: Verify migration is valid SQL**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && cat supabase/migrations/20260311100000_provider_config.sql`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260311100000_provider_config.sql
git commit -m "feat(accelerator): add provider_configs table for Phase 2"
```

---

### Task 2: Provider Types — Capability Interfaces

**Files:**
- Create: `src/lib/providers/types.ts`
- Create: `src/lib/providers/errors.ts`

- [ ] **Step 1: Write provider error types**

```typescript
/** Provider Errors.
 *  Shared error types for all provider implementations.
 *  Never imports NextRequest, NextResponse, or cookies. */

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerId: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ProviderRateLimitError extends ProviderError {
  public readonly retryAfterMs: number;

  constructor(providerId: string, retryAfterMs: number = 60_000) {
    super(`Rate limited by ${providerId}`, providerId, 429);
    this.name = 'ProviderRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

export class ProviderUnavailableError extends ProviderError {
  constructor(providerId: string) {
    super(`${providerId} is temporarily unavailable`, providerId, 503);
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderAuthError extends ProviderError {
  constructor(providerId: string) {
    super(`Authentication failed for ${providerId}`, providerId, 401);
    this.name = 'ProviderAuthError';
  }
}
```

- [ ] **Step 2: Write capability interfaces**

```typescript
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
  // (requires gtm-system provisioning migration)
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
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/providers/types.ts src/lib/providers/errors.ts
git commit -m "feat(accelerator): add provider capability interfaces and error types"
```

---

### Task 3: Provider Registry

**Files:**
- Create: `src/lib/providers/registry.ts`
- Create: `src/__tests__/lib/providers/registry.test.ts`

The registry maps capabilities to available providers and resolves the correct provider for a user.

- [ ] **Step 1: Write failing tests**

```typescript
/**
 * @jest-environment node
 */
import {
  getAvailableProviders,
  resolveProvider,
  PROVIDER_REGISTRY,
} from '@/lib/providers/registry';

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

function mockQuery(data: unknown = null) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data, error: null });
  return chain;
}

describe('Provider Registry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists available providers for dm_outreach', () => {
    const providers = getAvailableProviders('dm_outreach');
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0].id).toBe('heyreach');
  });

  it('lists available providers for email_outreach', () => {
    const providers = getAvailableProviders('email_outreach');
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0].id).toBe('plusvibe');
  });

  it('returns guided fallback when no provider configured', async () => {
    mockFrom.mockReturnValue(mockQuery(null)); // no config found
    const provider = await resolveProvider('user-1', 'dm_outreach');
    expect(provider).toBeNull();
  });

  it('resolves configured provider for user', async () => {
    mockFrom.mockReturnValue(
      mockQuery({
        provider_id: 'heyreach',
        integration_tier: 'provisionable',
        config: { api_key: 'test-key' },
      })
    );
    const provider = await resolveProvider('user-1', 'dm_outreach');
    expect(provider).not.toBeNull();
    expect(provider!.id).toBe('heyreach');
  });

  it('has correct registry entries', () => {
    expect(PROVIDER_REGISTRY).toHaveLength(3);
    const heyreach = PROVIDER_REGISTRY.find((p) => p.id === 'heyreach');
    expect(heyreach?.capability).toBe('dm_outreach');
    expect(heyreach?.integrationTier).toBe('provisionable');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='registry.test' --no-coverage 2>&1 | tail -10`
Expected: FAIL (module not found)

- [ ] **Step 3: Write registry implementation**

```typescript
/** Provider Registry.
 *  Maps capabilities to provider implementations. Resolves the correct provider for a user.
 *  To add a vendor: write a provider, add to PROVIDER_REGISTRY. Nothing else changes.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import type {
  CapabilityType,
  ProviderRegistryEntry,
  DmOutreachProvider,
  EmailOutreachProvider,
  PROVIDER_CONFIG_COLUMNS,
} from './types';
import { HeyReachDmProvider } from './heyreach-dm';
import { PlusVibeEmailProvider } from './plusvibe-email';

const LOG_CTX = 'provider-registry';

// ─── Static Registry ────────────────────────────────────

export const PROVIDER_REGISTRY: ProviderRegistryEntry[] = [
  {
    id: 'heyreach',
    name: 'HeyReach',
    capability: 'dm_outreach',
    integrationTier: 'provisionable',
    status: 'recommended',
    provisionable: true,
    hasAgencyPricing: true,
  },
  {
    id: 'plusvibe',
    name: 'PlusVibe',
    capability: 'email_outreach',
    integrationTier: 'provisionable',
    status: 'recommended',
    provisionable: true,
    hasAgencyPricing: true,
  },
  {
    id: 'zapmail',
    name: 'ZapMail',
    capability: 'domain',
    integrationTier: 'provisionable',
    status: 'recommended',
    provisionable: true,
    hasAgencyPricing: true,
  },
];

// ─── Provider Resolution ────────────────────────────────

export function getAvailableProviders(capability: CapabilityType): ProviderRegistryEntry[] {
  return PROVIDER_REGISTRY.filter(
    (p) => p.capability === capability && p.status !== 'deprecated'
  );
}

export async function resolveProvider(
  userId: string,
  capability: CapabilityType
): Promise<DmOutreachProvider | EmailOutreachProvider | null> {
  const supabase = getSupabaseAdminClient();
  const { data: config, error } = await supabase
    .from('provider_configs')
    .select(PROVIDER_CONFIG_COLUMNS)
    .eq('user_id', userId)
    .eq('capability', capability)
    .single();

  if (error || !config) {
    if (error && error.code !== 'PGRST116') {
      logError(LOG_CTX, error, { userId, capability });
    }
    return null;
  }

  return instantiateProvider(config.provider_id, config.config);
}

function instantiateProvider(
  providerId: string,
  config: Record<string, unknown>
): DmOutreachProvider | EmailOutreachProvider | null {
  switch (providerId) {
    case 'heyreach': {
      const apiKey = (config.api_key as string) || process.env.HEYREACH_API_KEY || '';
      return new HeyReachDmProvider(apiKey);
    }
    case 'plusvibe': {
      const apiKey = (config.api_key as string) || process.env.PLUSVIBE_API_KEY || '';
      return new PlusVibeEmailProvider(apiKey);
    }
    default:
      return null;
  }
}

// ─── Provider Config CRUD ───────────────────────────────

export async function saveProviderConfig(
  userId: string,
  capability: CapabilityType,
  providerId: string,
  config: Record<string, unknown> = {}
): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const entry = PROVIDER_REGISTRY.find((p) => p.id === providerId);
  if (!entry) return false;

  const { error } = await supabase.from('provider_configs').upsert(
    {
      user_id: userId,
      capability,
      provider_id: providerId,
      integration_tier: entry.integrationTier,
      config,
    },
    { onConflict: 'user_id,capability' }
  );

  if (error) {
    logError(LOG_CTX, error, { userId, capability, providerId });
    return false;
  }
  return true;
}

export async function getProviderConfig(
  userId: string,
  capability: CapabilityType
): Promise<Record<string, unknown> | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('provider_configs')
    .select(PROVIDER_CONFIG_COLUMNS)
    .eq('user_id', userId)
    .eq('capability', capability)
    .single();

  if (error || !data) return null;
  return data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='registry.test' --no-coverage`
Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/registry.ts src/__tests__/lib/providers/registry.test.ts
git commit -m "feat(accelerator): add provider registry with resolution logic"
```

---

### Task 4: HeyReach DM Provider

**Files:**
- Create: `src/lib/providers/heyreach-dm.ts`
- Create: `src/__tests__/lib/providers/heyreach-dm.test.ts`

Wraps the existing `HeyReachClient` (at `src/lib/integrations/heyreach/client.ts`) behind the `DmOutreachProvider` interface.

- [ ] **Step 1: Write failing tests**

```typescript
/**
 * @jest-environment node
 */
import { HeyReachDmProvider } from '@/lib/providers/heyreach-dm';

// Mock the underlying HeyReach client
jest.mock('@/lib/integrations/heyreach/client', () => ({
  HeyReachClient: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(true),
    listCampaigns: jest.fn().mockResolvedValue({
      campaigns: [{ id: 123, name: 'Test Campaign', status: 'active', createdAt: '2026-01-01' }],
      total: 1,
    }),
    addContactsToCampaign: jest
      .fn()
      .mockResolvedValue({ success: true, added: 2 }),
  })),
}));

describe('HeyReachDmProvider', () => {
  let provider: HeyReachDmProvider;

  beforeEach(() => {
    provider = new HeyReachDmProvider('test-api-key');
  });

  it('has correct provider metadata', () => {
    expect(provider.id).toBe('heyreach');
    expect(provider.name).toBe('HeyReach');
    expect(provider.integrationTier).toBe('provisionable');
  });

  it('tests connection via underlying client', async () => {
    const result = await provider.testConnection();
    expect(result).toBe(true);
  });

  it('lists campaigns', async () => {
    const campaigns = await provider.listCampaigns();
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0].name).toBe('Test Campaign');
  });

  it('adds leads to campaign', async () => {
    const result = await provider.addLeadsToCampaign('123', [
      { linkedinUrl: 'https://linkedin.com/in/test/', firstName: 'John' },
    ]);
    expect(result.added).toBe(2);
  });

  it('returns empty stats (HeyReach stats not directly accessible)', async () => {
    const stats = await provider.getCampaignStats('123');
    expect(stats.sent).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='heyreach-dm.test' --no-coverage 2>&1 | tail -5`
Expected: FAIL

- [ ] **Step 3: Write HeyReach DM provider**

```typescript
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

  async addLeadsToCampaign(
    campaignId: string,
    leads: OutreachLead[]
  ): Promise<{ added: number }> {
    const contacts = leads.map((lead) => ({
      linkedinUrl: lead.linkedinUrl,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email,
      company: lead.company,
      customFields: lead.customFields,
    }));

    const result = await this.client.addContactsToCampaign(
      Number(campaignId),
      contacts
    );
    return { added: result.added };
  }

  async getCampaignStats(_campaignId: string): Promise<DmCampaignStats> {
    // HeyReach doesn't expose per-campaign stats via public API
    // Return empty stats — Phase 3 will add stats collection via HeyReach MCP
    return { sent: 0, accepted: 0, replied: 0, pending: 0 };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='heyreach-dm.test' --no-coverage`
Expected: 5 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/heyreach-dm.ts src/__tests__/lib/providers/heyreach-dm.test.ts
git commit -m "feat(accelerator): add HeyReach DM provider wrapping existing client"
```

---

### Task 5: PlusVibe Email Provider

**Files:**
- Create: `src/lib/providers/plusvibe-email.ts`
- Create: `src/__tests__/lib/providers/plusvibe-email.test.ts`

Wraps the existing PlusVibe client and adds campaign listing and warmup status via the PlusVibe API.

**Reference:** PlusVibe API base URL: `https://api.plusvibe.ai/api/v1`. Auth: `x-api-key` header. Key endpoints: `/campaign/list`, `/analytics/campaign/summary`, `/warmup/stats`, `/lead/add`.

- [ ] **Step 1: Write failing tests**

```typescript
/**
 * @jest-environment node
 */
import { PlusVibeEmailProvider } from '@/lib/providers/plusvibe-email';

// Mock fetch globally for PlusVibe direct API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PlusVibeEmailProvider', () => {
  let provider: PlusVibeEmailProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new PlusVibeEmailProvider('test-api-key');
  });

  it('has correct provider metadata', () => {
    expect(provider.id).toBe('plusvibe');
    expect(provider.name).toBe('PlusVibe');
    expect(provider.integrationTier).toBe('provisionable');
  });

  it('tests connection by listing campaigns', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ _id: '1', camp_name: 'Test' }] }),
    });
    const result = await provider.testConnection();
    expect(result).toBe(true);
  });

  it('returns false on connection failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const result = await provider.testConnection();
    expect(result).toBe(false);
  });

  it('lists campaigns', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { _id: 'camp-1', camp_name: 'Cold Outreach', status: 'active' },
          { _id: 'camp-2', camp_name: 'Follow Up', status: 'paused' },
        ],
      }),
    });
    const campaigns = await provider.listCampaigns();
    expect(campaigns).toHaveLength(2);
    expect(campaigns[0].id).toBe('camp-1');
    expect(campaigns[0].name).toBe('Cold Outreach');
  });

  it('adds leads to campaign', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ added_count: 3 }),
    });
    const result = await provider.addLeadsToCampaign('camp-1', [
      { linkedinUrl: '', firstName: 'John', email: 'john@test.com' },
    ]);
    expect(result.added).toBe(3);
  });

  it('gets warmup status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { _id: 'acc-1', email: 'warm@test.com', warmup_enabled: true, warmup_started_at: '2026-02-01' },
        ],
      }),
    });
    const statuses = await provider.getWarmupStatus();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].isWarming).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='plusvibe-email.test' --no-coverage 2>&1 | tail -5`
Expected: FAIL

- [ ] **Step 3: Write PlusVibe email provider**

```typescript
/** PlusVibe Email Provider.
 *  Wraps PlusVibe API behind the EmailOutreachProvider interface.
 *  Uses direct API calls (not the simplified client in integrations/plusvibe.ts)
 *  because we need campaign listing, stats, and warmup in addition to lead push.
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

const LOG_CTX = 'plusvibe-provider';
const BASE_URL = 'https://api.plusvibe.ai/api/v1';
const TIMEOUT_MS = 15_000;

export class PlusVibeEmailProvider implements EmailOutreachProvider {
  readonly id = 'plusvibe' as const;
  readonly name = 'PlusVibe';
  readonly integrationTier: IntegrationTier = 'provisionable';

  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // ─── Interface Methods ──────────────────────────────────

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
        'GET'
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
    leads: OutreachLead[]
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

  // ─── HTTP Helper ────────────────────────────────────────

  private async request(
    path: string,
    method: string,
    body?: unknown
  ): Promise<Response> {
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='plusvibe-email.test' --no-coverage`
Expected: 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/plusvibe-email.ts src/__tests__/lib/providers/plusvibe-email.test.ts
git commit -m "feat(accelerator): add PlusVibe email provider with campaign + warmup support"
```

---

### Task 6: Guided Fallback Provider

**Files:**
- Create: `src/lib/providers/guided-fallback.ts`
- Create: `src/__tests__/lib/providers/guided-fallback.test.ts`

When no API integration is available, generates step-by-step instructions the agent can present to the user.

- [ ] **Step 1: Write failing tests**

```typescript
/**
 * @jest-environment node
 */
import { GuidedFallbackProvider } from '@/lib/providers/guided-fallback';

describe('GuidedFallbackProvider', () => {
  const provider = new GuidedFallbackProvider();

  it('has correct provider metadata', () => {
    expect(provider.id).toBe('guided');
    expect(provider.name).toBe('Guided Setup');
  });

  it('returns setup steps for dm_outreach', () => {
    const steps = provider.getSetupSteps('dm_outreach');
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].stepNumber).toBe(1);
    expect(steps[0].title).toBeDefined();
  });

  it('returns setup steps for email_outreach', () => {
    const steps = provider.getSetupSteps('email_outreach');
    expect(steps.length).toBeGreaterThan(0);
  });

  it('returns setup steps for domain', () => {
    const steps = provider.getSetupSteps('domain');
    expect(steps.length).toBeGreaterThan(0);
  });

  it('returns verification checklist for email_outreach', () => {
    const checklist = provider.getVerificationChecklist('email_outreach');
    expect(checklist.length).toBeGreaterThan(0);
    expect(checklist[0].item).toBeDefined();
    expect(checklist[0].required).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='guided-fallback.test' --no-coverage 2>&1 | tail -5`
Expected: FAIL

- [ ] **Step 3: Write guided fallback provider**

```typescript
/** Guided Fallback Provider.
 *  Generates step-by-step instructions when no API integration is available.
 *  The agent presents these steps to the user for manual execution.
 *  Never imports NextRequest, NextResponse, or cookies. */

import type { GuidedProvider, GuidedStep, ChecklistItem, CapabilityType } from './types';

// ─── Setup Step Libraries ───────────────────────────────

const DM_OUTREACH_STEPS: GuidedStep[] = [
  {
    stepNumber: 1,
    title: 'Choose a LinkedIn outreach tool',
    instructions:
      'Sign up for a LinkedIn outreach tool (HeyReach, Dripify, or Expandi). HeyReach is recommended for multi-account management.',
    verificationPrompt: 'What tool did you sign up for?',
  },
  {
    stepNumber: 2,
    title: 'Connect your LinkedIn account',
    instructions:
      'Connect your LinkedIn account to the tool. Use cookie-based auth (li_at cookie) for most reliable connection.',
    verificationPrompt: 'Is your LinkedIn account connected and active?',
  },
  {
    stepNumber: 3,
    title: 'Create your first campaign',
    instructions:
      'Create a connection request campaign. Set daily limits to 20-30 invites per day to stay safe.',
    verificationPrompt: 'Share the campaign name and daily invite limit you set.',
  },
  {
    stepNumber: 4,
    title: 'Write your connection request message',
    instructions:
      'Write a personalized connection request (under 300 chars). Focus on common ground, not selling. I can help you write this.',
  },
  {
    stepNumber: 5,
    title: 'Import your TAM list',
    instructions:
      'Upload your segmented TAM list (Warm+LinkedIn Active segment first). Map LinkedIn URL, first name, last name fields.',
    verificationPrompt: 'How many leads did you import?',
  },
];

const EMAIL_OUTREACH_STEPS: GuidedStep[] = [
  {
    stepNumber: 1,
    title: 'Purchase sending domains',
    instructions:
      'Buy 2-3 domains similar to your main domain (.com only). Use Namecheap, GoDaddy, or Porkbun. Example: if your domain is "acme.com", buy "acmehq.com" and "getacme.com".',
    verificationPrompt: 'What domains did you purchase?',
  },
  {
    stepNumber: 2,
    title: 'Set up Google Workspace mailboxes',
    instructions:
      'Create Google Workspace accounts on each domain. 2 mailboxes per domain max. Use real-sounding names (e.g., sarah@acmehq.com).',
    verificationPrompt: 'How many mailboxes did you create?',
  },
  {
    stepNumber: 3,
    title: 'Configure DNS records (SPF, DKIM, DMARC)',
    instructions:
      'Set up SPF, DKIM, and DMARC records for each domain. Your email tool usually provides the DNS records to add.',
    verificationPrompt: 'Are SPF, DKIM, and DMARC all set up?',
  },
  {
    stepNumber: 4,
    title: 'Sign up for a cold email platform',
    instructions:
      'Sign up for PlusVibe (recommended), Instantly, or Smartlead. Connect all your mailboxes.',
    verificationPrompt: 'Which platform did you choose and how many mailboxes are connected?',
  },
  {
    stepNumber: 5,
    title: 'Start warmup',
    instructions:
      'Enable email warmup for all accounts. Minimum 2 weeks warmup before sending any campaigns. Set ramp-up to start at 5 emails/day.',
    verificationPrompt: 'Is warmup running on all accounts?',
  },
  {
    stepNumber: 6,
    title: 'Write cold email sequences',
    instructions:
      'Write a 3-step email sequence. I can help you write personalized, high-converting copy for your ICP.',
  },
];

const DOMAIN_STEPS: GuidedStep[] = [
  {
    stepNumber: 1,
    title: 'Choose sending domains',
    instructions:
      'Pick 2-3 domain names similar to your main brand. Only use .com TLDs. Avoid hyphens and numbers.',
    verificationPrompt: 'What domain names are you considering?',
  },
  {
    stepNumber: 2,
    title: 'Purchase domains',
    instructions:
      'Purchase through your preferred registrar (Namecheap, GoDaddy, Porkbun).',
    verificationPrompt: 'Which domains did you purchase?',
  },
  {
    stepNumber: 3,
    title: 'Point DNS to email provider',
    instructions:
      'Add MX, SPF, DKIM, and DMARC records as required by your email provider (Google Workspace or Microsoft 365).',
    verificationPrompt: 'Are all DNS records configured?',
  },
];

const SETUP_STEPS: Record<CapabilityType, GuidedStep[]> = {
  dm_outreach: DM_OUTREACH_STEPS,
  email_outreach: EMAIL_OUTREACH_STEPS,
  domain: DOMAIN_STEPS,
};

// ─── Provider Implementation ────────────────────────────

export class GuidedFallbackProvider implements GuidedProvider {
  readonly id = 'guided' as const;
  readonly name = 'Guided Setup';

  getSetupSteps(capability: CapabilityType): GuidedStep[] {
    return SETUP_STEPS[capability] || [];
  }

  getVerificationChecklist(capability: CapabilityType): ChecklistItem[] {
    return VERIFICATION_CHECKLISTS[capability] || [];
  }
}

const VERIFICATION_CHECKLISTS: Record<CapabilityType, ChecklistItem[]> = {
  dm_outreach: [
    { item: 'LinkedIn account connected and active', required: true },
    { item: 'First campaign created with daily limits set', required: true },
    { item: 'Connection request message written (under 300 chars)', required: true },
    { item: 'TAM leads imported to campaign', required: true },
  ],
  email_outreach: [
    { item: 'Sending domains purchased (.com only)', required: true },
    { item: 'DNS records configured (SPF, DKIM, DMARC)', required: true },
    { item: 'Mailboxes created (max 2 per domain)', required: true },
    { item: 'All accounts connected to email platform', required: true },
    { item: 'Warmup enabled and running for 2+ weeks', required: true },
    { item: 'First email sequence written (3 steps)', required: false },
  ],
  domain: [
    { item: 'Domains purchased (2-3, .com only)', required: true },
    { item: 'MX records pointing to email provider', required: true },
    { item: 'SPF record configured', required: true },
    { item: 'DKIM record configured', required: true },
    { item: 'DMARC record configured', required: true },
  ],
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='guided-fallback.test' --no-coverage`
Expected: 4 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/guided-fallback.ts src/__tests__/lib/providers/guided-fallback.test.ts
git commit -m "feat(accelerator): add guided fallback provider with setup step libraries"
```

---

## Chunk 2: Provider Actions & Type Updates

### Task 7: Update Accelerator Types for Phase 2

**Files:**
- Modify: `src/lib/types/accelerator.ts`

Add new SubAgentType values, PHASE2_MODULES constant, and new DeliverableType values.

- [ ] **Step 1: Add Phase 2 types**

In `src/lib/types/accelerator.ts`, make these changes:

1. After `PHASE1_MODULES`, add:
```typescript
export const PHASE2_MODULES: ModuleId[] = ['m2', 'm3', 'm4'];
```

2. Replace `SubAgentType`:
```typescript
export type SubAgentType = 'icp' | 'lead_magnet' | 'content' | 'tam' | 'outreach' | 'troubleshooter';
```

3. Add new DeliverableType values to the union (add after `'outreach_campaign'`):
```typescript
  | 'tam_segment'
  | 'dm_campaign'
  | 'email_campaign'
  | 'email_infrastructure'
```

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/accelerator.ts
git commit -m "feat(accelerator): add Phase 2 types (tam, outreach agents, new deliverable types)"
```

---

### Task 8: Provider Actions for Agent Tool Use

**Files:**
- Create: `src/lib/actions/providers.ts`
- Create: `src/__tests__/lib/actions/providers.test.ts`
- Modify: `src/lib/actions/index.ts`
- Modify: `src/lib/actions/program.ts` (update create_deliverable enum)

These actions let agents interact with providers: check status, configure providers, create campaigns, and get warmup status.

- [ ] **Step 1: Write failing tests**

```typescript
/**
 * @jest-environment node
 */
import { executeAction } from '@/lib/actions';
import type { ActionContext } from '@/lib/actions/types';

// Mock providers
jest.mock('@/lib/providers/registry', () => ({
  getAvailableProviders: jest.fn().mockReturnValue([
    { id: 'heyreach', name: 'HeyReach', capability: 'dm_outreach', integrationTier: 'provisionable', status: 'recommended' },
  ]),
  resolveProvider: jest.fn().mockResolvedValue(null),
  saveProviderConfig: jest.fn().mockResolvedValue(true),
  getProviderConfig: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/providers/guided-fallback', () => ({
  GuidedFallbackProvider: jest.fn().mockImplementation(() => ({
    getSetupSteps: jest.fn().mockReturnValue([
      { stepNumber: 1, title: 'Step 1', instructions: 'Do this' },
    ]),
  })),
}));

// Need to import providers to register the actions
import '@/lib/actions/providers';

const ctx: ActionContext = { userId: 'user-1' };

describe('Provider Actions', () => {
  it('registers list_providers action', async () => {
    const result = await executeAction('list_providers', ctx, { capability: 'dm_outreach' });
    expect(result.success).toBe(true);
    expect((result.data as { providers: unknown[] }).providers).toHaveLength(1);
  });

  it('registers check_provider_status action', async () => {
    const result = await executeAction('check_provider_status', ctx, { capability: 'dm_outreach' });
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).configured).toBe(false);
  });

  it('registers configure_provider action', async () => {
    const result = await executeAction('configure_provider', ctx, {
      capability: 'dm_outreach',
      provider_id: 'heyreach',
    });
    expect(result.success).toBe(true);
  });

  it('registers get_guided_steps action', async () => {
    const result = await executeAction('get_guided_steps', ctx, { capability: 'dm_outreach' });
    expect(result.success).toBe(true);
    const data = result.data as { steps: unknown[] };
    expect(data.steps).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='actions/providers.test' --no-coverage 2>&1 | tail -5`
Expected: FAIL

- [ ] **Step 3: Write provider actions**

```typescript
/** Provider Actions.
 *  Actions for agents to interact with the provider abstraction layer.
 *  Lets agents list providers, check status, configure, and get guided steps.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { registerAction } from './registry';
import {
  getAvailableProviders,
  resolveProvider,
  saveProviderConfig,
  getProviderConfig,
} from '@/lib/providers/registry';
import { GuidedFallbackProvider } from '@/lib/providers/guided-fallback';
import type { CapabilityType } from '@/lib/providers/types';

// ─── Read Actions ────────────────────────────────────────

registerAction({
  name: 'list_providers',
  description:
    'List available provider options for a capability (dm_outreach, email_outreach, domain).',
  parameters: {
    properties: {
      capability: {
        type: 'string',
        enum: ['dm_outreach', 'email_outreach', 'domain'],
        description: 'The capability to list providers for',
      },
    },
    required: ['capability'],
  },
  handler: async (_ctx, params: { capability: CapabilityType }) => {
    const providers = getAvailableProviders(params.capability);
    return {
      success: true,
      data: { providers, guided_available: true },
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'check_provider_status',
  description:
    "Check if the user has a provider configured for a capability and whether it's connected.",
  parameters: {
    properties: {
      capability: {
        type: 'string',
        enum: ['dm_outreach', 'email_outreach', 'domain'],
      },
    },
    required: ['capability'],
  },
  handler: async (ctx, params: { capability: CapabilityType }) => {
    const config = await getProviderConfig(ctx.userId, params.capability);
    if (!config) {
      return {
        success: true,
        data: { configured: false, message: 'No provider configured for this capability.' },
        displayHint: 'text',
      };
    }

    const provider = await resolveProvider(ctx.userId, params.capability);
    const connected = provider ? await provider.testConnection() : false;

    return {
      success: true,
      data: {
        configured: true,
        provider_id: (config as Record<string, unknown>).provider_id,
        connected,
        verified_at: (config as Record<string, unknown>).verified_at,
      },
      displayHint: 'text',
    };
  },
});

// ─── Write Actions ───────────────────────────────────────

registerAction({
  name: 'configure_provider',
  description:
    'Save provider configuration for a capability. Call after user chooses a provider.',
  parameters: {
    properties: {
      capability: {
        type: 'string',
        enum: ['dm_outreach', 'email_outreach', 'domain'],
      },
      provider_id: {
        type: 'string',
        description: 'Provider ID (heyreach, plusvibe, zapmail, guided)',
      },
      config: {
        type: 'object',
        description: 'Provider-specific config (api_key, campaign_id, workspace_id, etc.)',
      },
    },
    required: ['capability', 'provider_id'],
  },
  handler: async (ctx, params: { capability: CapabilityType; provider_id: string; config?: Record<string, unknown> }) => {
    const saved = await saveProviderConfig(
      ctx.userId,
      params.capability,
      params.provider_id,
      params.config || {}
    );
    if (!saved) return { success: false, error: 'Failed to save provider config.' };
    return { success: true, data: { configured: true }, displayHint: 'text' };
  },
});

registerAction({
  name: 'get_guided_steps',
  description:
    'Get step-by-step manual setup instructions for a capability when no API integration is available.',
  parameters: {
    properties: {
      capability: {
        type: 'string',
        enum: ['dm_outreach', 'email_outreach', 'domain'],
      },
    },
    required: ['capability'],
  },
  handler: async (_ctx, params: { capability: CapabilityType }) => {
    const guided = new GuidedFallbackProvider();
    const steps = guided.getSetupSteps(params.capability);
    return {
      success: true,
      data: { steps, capability: params.capability },
      displayHint: 'task_board',
    };
  },
});
```

- [ ] **Step 4: Add import to actions/index.ts**

In `src/lib/actions/index.ts`, add:
```typescript
import './providers';
```

- [ ] **Step 5: Update create_deliverable enum in program.ts**

In `src/lib/actions/program.ts`, find the `deliverable_type` enum array in the `create_deliverable` action parameters. Replace it with the full list below. Note: this also backfills `tam_list`, `outreach_campaign`, and `metrics_digest` which exist in the `DeliverableType` union but were missing from the action's enum:
```typescript
enum: [
  'icp_definition',
  'lead_magnet',
  'funnel',
  'email_sequence',
  'tam_list',
  'tam_segment',
  'outreach_campaign',
  'dm_campaign',
  'email_campaign',
  'email_infrastructure',
  'content_plan',
  'post_drafts',
  'metrics_digest',
],
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='actions/providers.test' --no-coverage`
Expected: 4 tests pass

- [ ] **Step 7: Run full typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/lib/actions/providers.ts src/__tests__/lib/actions/providers.test.ts src/lib/actions/index.ts src/lib/actions/program.ts
git commit -m "feat(accelerator): add provider actions for agent tool use"
```

---

## Chunk 3: Sub-Agent Definitions

### Task 9: TAM Builder Agent (M2)

**Files:**
- Create: `src/lib/ai/copilot/sub-agents/tam-agent.ts`

The TAM Builder Agent guides users through building and segmenting their Total Addressable Market. It uses MagnetLab's enrichment waterfall, segmentation rules from SOPs, and can trigger TAM enrichment tasks.

- [ ] **Step 1: Write TAM agent prompt builder**

```typescript
/** TAM Builder Agent (M2).
 *  Guides users through TAM building: export connections, Sales Navigator search,
 *  enrichment waterfall, email validation, and activity-based segmentation.
 *  Never imports NextRequest, NextResponse, or cookies. */

interface SopData {
  title: string;
  content: string;
  quality_bars: unknown[];
}

interface UserContext {
  intake_data: Record<string, unknown> | null;
  coaching_mode: 'do_it' | 'guide_me' | 'teach_me';
}

export function buildTamAgentPrompt(sops: SopData[], ctx: UserContext): string {
  const sections: string[] = [];

  // ─── Identity ─────────────────────────────────────────
  sections.push(`You are the TAM Builder specialist in the GTM Accelerator program.
Your job is to help the user build a segmented, enriched Total Addressable Market (TAM) list.`);

  // ─── Coaching Mode ────────────────────────────────────
  if (ctx.coaching_mode === 'do_it') {
    sections.push(`## Mode: Do It For Me
Execute each step automatically where possible. For steps requiring user action
(like exporting LinkedIn connections), provide exact instructions and wait for confirmation.
When you have access to enrichment tools, run them without asking.`);
  } else if (ctx.coaching_mode === 'guide_me') {
    sections.push(`## Mode: Guide Me
Walk through each step together. Explain what you're doing and why.
Ask for confirmation before running enrichment or validation steps.
Provide context from the SOPs so the user learns while building.`);
  } else {
    sections.push(`## Mode: Teach Me
Explain the strategy behind each step in detail. Reference the bootcamp SOPs.
Quiz the user on segmentation logic before applying it.
Make sure they understand WHY before WHAT.`);
  }

  // ─── TAM Building Workflow ────────────────────────────
  sections.push(`## TAM Building Workflow

### Step 1: Source TAM Leads
- **LinkedIn Connections Export**: User downloads their 1st-degree connections CSV
- **Sales Navigator Search**: User runs ICP-filtered search and exports results
- **Manual Import**: User uploads an existing prospect list

### Step 2: Clean & Deduplicate
- Remove duplicates by LinkedIn URL
- Normalize company names
- Flag incomplete records (missing name, company, or LinkedIn URL)

### Step 3: Email Enrichment Waterfall
Run the enrichment waterfall in this order (stop at first valid result):
1. LeadMagic (highest accuracy for B2B)
2. Prospeo (good coverage)
3. BlitzAPI (fallback)

### Step 4: Email Validation
Validate all found emails through ZeroBounce or BounceBan.
Only keep emails with status: valid or catch_all.

### Step 5: Activity Segmentation
Segment the TAM into 4 groups based on LinkedIn activity + email availability:
1. **Warm + LinkedIn Active**: Has engaged with your content + posts regularly → DM first
2. **Cold + LinkedIn Active**: No prior engagement but active on LinkedIn → Connection request + DM
3. **Cold + Email Only**: Has email but not active on LinkedIn → Cold email
4. **Full TAM (No Email)**: LinkedIn only, no email found → LinkedIn nurture

### Step 6: Quality Validation
Each segment should have:
- Minimum 100 contacts (warn if under 50)
- All emails validated
- LinkedIn URLs formatted correctly (with trailing slash)
- Company and title data for personalization`);

  // ─── User Context ─────────────────────────────────────
  if (ctx.intake_data) {
    sections.push(`## User Context
Business: ${ctx.intake_data.business_description || 'Not provided'}
Target Audience: ${ctx.intake_data.target_audience || 'Not provided'}
Primary Goal: ${ctx.intake_data.primary_goal || 'Not provided'}`);
  }

  // ─── SOPs ─────────────────────────────────────────────
  if (sops.length > 0) {
    sections.push('## Module SOPs (Reference)');
    for (const sop of sops) {
      sections.push(`### ${sop.title}\n${sop.content.slice(0, 500)}${sop.content.length > 500 ? '...' : ''}`);
    }
  }

  // ─── Output Protocol ──────────────────────────────────
  sections.push(`## Output Protocol
When you complete a TAM segment, create a deliverable:
- type: "tam_segment" for each segment
- type: "tam_list" for the complete enriched TAM

Report progress via update_module_progress with current step.

When finished, return a handoff JSON block:
\`\`\`json
{
  "deliverables_created": [{"type": "tam_list", "entity_type": "tam"}],
  "progress_updates": [{"module_id": "m2", "step": "segmentation_complete"}],
  "validation_results": [],
  "needs_escalation": false,
  "summary": "TAM built: X warm, Y cold+active, Z email-only, W full TAM"
}
\`\`\``);

  return sections.join('\n\n');
}
```

- [ ] **Step 2: Write TAM agent tests**

Create `src/__tests__/lib/ai/copilot/sub-agents/tam-agent.test.ts`:

```typescript
/**
 * @jest-environment node
 */
import { buildTamAgentPrompt } from '@/lib/ai/copilot/sub-agents/tam-agent';

describe('buildTamAgentPrompt', () => {
  const baseSops = [{ title: 'Export Connections', content: 'Export your LinkedIn...', quality_bars: [] }];
  const baseCtx = {
    intake_data: { business_description: 'B2B Agency', target_audience: 'Marketing Directors' } as Record<string, unknown>,
    coaching_mode: 'guide_me' as const,
  };

  it('includes TAM Builder identity', () => {
    const prompt = buildTamAgentPrompt(baseSops, baseCtx);
    expect(prompt).toContain('TAM Builder specialist');
  });

  it('includes enrichment waterfall steps', () => {
    const prompt = buildTamAgentPrompt(baseSops, baseCtx);
    expect(prompt).toContain('LeadMagic');
    expect(prompt).toContain('Prospeo');
    expect(prompt).toContain('BlitzAPI');
  });

  it('includes segmentation rules', () => {
    const prompt = buildTamAgentPrompt(baseSops, baseCtx);
    expect(prompt).toContain('Warm + LinkedIn Active');
    expect(prompt).toContain('Cold + Email Only');
  });

  it('adapts to do_it coaching mode', () => {
    const prompt = buildTamAgentPrompt(baseSops, { ...baseCtx, coaching_mode: 'do_it' });
    expect(prompt).toContain('Do It For Me');
  });

  it('adapts to teach_me coaching mode', () => {
    const prompt = buildTamAgentPrompt(baseSops, { ...baseCtx, coaching_mode: 'teach_me' });
    expect(prompt).toContain('Teach Me');
  });

  it('includes user context from intake', () => {
    const prompt = buildTamAgentPrompt(baseSops, baseCtx);
    expect(prompt).toContain('B2B Agency');
    expect(prompt).toContain('Marketing Directors');
  });

  it('includes output protocol with handoff JSON', () => {
    const prompt = buildTamAgentPrompt(baseSops, baseCtx);
    expect(prompt).toContain('tam_list');
    expect(prompt).toContain('handoff JSON');
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='tam-agent.test' --no-coverage`
Expected: 7 tests pass

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai/copilot/sub-agents/tam-agent.ts src/__tests__/lib/ai/copilot/sub-agents/tam-agent.test.ts
git commit -m "feat(accelerator): add TAM Builder Agent (M2) prompt builder with tests"
```

---

### Task 10: Outreach Setup Agent (M3 + M4)

**Files:**
- Create: `src/lib/ai/copilot/sub-agents/outreach-agent.ts`
- Create: `src/__tests__/lib/ai/copilot/sub-agents/outreach-agent.test.ts`

Single agent handles both LinkedIn outreach (M3) and cold email (M4). It routes through the provider registry to determine setup approach.

- [ ] **Step 1: Write failing tests**

```typescript
/**
 * @jest-environment node
 */
import { buildOutreachAgentPrompt } from '@/lib/ai/copilot/sub-agents/outreach-agent';

describe('buildOutreachAgentPrompt', () => {
  const baseSops = [{ title: 'HeyReach Connection', content: 'Set up HeyReach...', quality_bars: [] }];
  const baseCtx = {
    intake_data: { business_description: 'B2B SaaS', target_audience: 'CTOs' } as Record<string, unknown>,
    coaching_mode: 'guide_me' as const,
  };

  it('includes outreach identity', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'linkedin');
    expect(prompt).toContain('Outreach Setup specialist');
  });

  it('includes LinkedIn-specific rules for linkedin focus', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'linkedin');
    expect(prompt).toContain('DM');
    expect(prompt).toContain('connection request');
  });

  it('includes cold email rules for email focus', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'email');
    expect(prompt).toContain('cold email');
    expect(prompt).toContain('warmup');
  });

  it('includes provider resolution flow', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'linkedin');
    expect(prompt).toContain('check_provider_status');
    expect(prompt).toContain('list_providers');
  });

  it('adapts to do_it coaching mode', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, { ...baseCtx, coaching_mode: 'do_it' }, 'email');
    expect(prompt).toContain('Do It For Me');
  });

  it('adapts to teach_me coaching mode', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, { ...baseCtx, coaching_mode: 'teach_me' }, 'email');
    expect(prompt).toContain('Teach Me');
  });

  it('includes user context from intake', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'linkedin');
    expect(prompt).toContain('B2B SaaS');
    expect(prompt).toContain('CTOs');
  });

  it('includes SOPs', () => {
    const prompt = buildOutreachAgentPrompt(baseSops, baseCtx, 'linkedin');
    expect(prompt).toContain('HeyReach Connection');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='outreach-agent.test' --no-coverage 2>&1 | tail -5`
Expected: FAIL

- [ ] **Step 3: Write outreach agent prompt builder**

```typescript
/** Outreach Setup Agent (M3 + M4).
 *  Handles both LinkedIn outreach (HeyReach/DM) and cold email (PlusVibe/ZapMail) setup.
 *  Routes through provider registry to determine setup approach.
 *  Never imports NextRequest, NextResponse, or cookies. */

type OutreachFocus = 'linkedin' | 'email';

interface SopData {
  title: string;
  content: string;
  quality_bars: unknown[];
}

interface UserContext {
  intake_data: Record<string, unknown> | null;
  coaching_mode: 'do_it' | 'guide_me' | 'teach_me';
}

export function buildOutreachAgentPrompt(
  sops: SopData[],
  ctx: UserContext,
  focus: OutreachFocus = 'linkedin'
): string {
  const sections: string[] = [];

  // ─── Identity ─────────────────────────────────────────
  sections.push(`You are the Outreach Setup specialist in the GTM Accelerator program.
Your job is to help the user set up their ${focus === 'linkedin' ? 'LinkedIn DM outreach' : 'cold email'} infrastructure and campaigns.`);

  // ─── Coaching Mode ────────────────────────────────────
  if (ctx.coaching_mode === 'do_it') {
    sections.push(`## Mode: Do It For Me
Execute setup steps automatically through provider APIs where possible.
For provisionable tools, trigger the provisioning flow directly.
For guided setup, provide exact click-by-click instructions.`);
  } else if (ctx.coaching_mode === 'guide_me') {
    sections.push(`## Mode: Guide Me
Walk through setup together. Explain each step and why it matters.
For API-connected tools, show what you're configuring.
For manual steps, provide clear instructions and wait for confirmation.`);
  } else {
    sections.push(`## Mode: Teach Me
Explain the strategy behind outreach infrastructure.
Cover deliverability, warmup science, LinkedIn's algorithm, and risk management.
Make sure the user understands the "why" before any setup.`);
  }

  // ─── Provider Resolution Flow ─────────────────────────
  sections.push(`## Provider Resolution Flow

ALWAYS start by checking if the user has a provider configured:

1. Call \`check_provider_status\` with capability="${focus === 'linkedin' ? 'dm_outreach' : 'email_outreach'}"
2. If configured and connected → proceed with that provider
3. If not configured:
   a. Call \`list_providers\` to show options
   b. Present recommended option first with benefits
   c. Explain: "I can set this up automatically through [recommended], or guide you through your own tool"
   d. After user chooses → call \`configure_provider\`
   e. If user wants guided setup → call \`get_guided_steps\``);

  // ─── Focus-Specific Rules ─────────────────────────────
  if (focus === 'linkedin') {
    sections.push(`## LinkedIn Outreach Rules (M3)

### Campaign Setup
- Create a connection request campaign first (highest acceptance rates)
- Daily limits: 20-30 connection requests per day (LinkedIn's safe zone)
- Always personalize connection request messages (under 300 characters)
- NEVER automate second messages — coach the user on persona-matching DM replies instead

### Message Templates
- Connection request: Focus on common ground, NOT selling
- Follow-up DM (after acceptance): Provide value first, then soft ask
- Lead magnet delivery: Short, personalized, link to funnel page

### Quality Bars
- Connection acceptance rate should target >30%
- Response rate on DMs should target >15%
- If acceptance rate < 20%, the message needs rewriting
- If LinkedIn flags the account, STOP immediately and reduce daily limits

### Deliverable: DM Campaign
When the campaign is set up and first leads are imported:
- Create deliverable type: "dm_campaign"
- Track campaign ID as entity_id
- Track leads imported count in validation feedback`);
  } else {
    sections.push(`## Cold Email Rules (M4)

### Infrastructure Setup
These rules are non-negotiable:
- **Domains**: .com only, 2-3 domains similar to main brand, NO hyphens or numbers
- **Mailboxes**: Maximum 2 accounts per domain (Google Workspace recommended)
- **DNS**: SPF, DKIM, and DMARC records MUST be configured before any sending
- **Warmup**: Minimum 2 weeks warmup before first campaign. Start at 5 emails/day, ramp to 30/day.
- **Daily volume**: Never exceed 30 emails/day per account (across all campaigns)

### Email Copy Framework
- Subject: 3-5 words, lowercase, no punctuation, personal feel
- Body: Under 100 words, one clear ask, personalized opening
- Sequence: 3 steps max (Day 1, Day 3, Day 7)
- NEVER use: "I hope this finds you well", "touching base", "synergy"

### Quality Bars
- Bounce rate must stay under 3% (stop campaign if exceeded)
- Open rate target: >50%
- Reply rate target: >5%
- Spam complaint rate: must be 0%

### Deliverable: Email Infrastructure
When domains are provisioned and warmup is running:
- Create deliverable type: "email_infrastructure"
- Include domain count, mailbox count, warmup status

### Deliverable: Email Campaign
When first cold email campaign is launched:
- Create deliverable type: "email_campaign"
- Track campaign ID as entity_id`);
  }

  // ─── User Context ─────────────────────────────────────
  if (ctx.intake_data) {
    sections.push(`## User Context
Business: ${ctx.intake_data.business_description || 'Not provided'}
Target Audience: ${ctx.intake_data.target_audience || 'Not provided'}
Primary Goal: ${ctx.intake_data.primary_goal || 'Not provided'}`);
  }

  // ─── SOPs ─────────────────────────────────────────────
  if (sops.length > 0) {
    sections.push('## Module SOPs (Reference)');
    for (const sop of sops) {
      sections.push(`### ${sop.title}\n${sop.content.slice(0, 500)}${sop.content.length > 500 ? '...' : ''}`);
    }
  }

  // ─── Output Protocol ──────────────────────────────────
  const moduleId = focus === 'linkedin' ? 'm3' : 'm4';
  sections.push(`## Output Protocol
Create deliverables via create_deliverable action.
Report progress via update_module_progress with module_id="${moduleId}".

When finished, return a handoff JSON block:
\`\`\`json
{
  "deliverables_created": [{"type": "${focus === 'linkedin' ? 'dm_campaign' : 'email_campaign'}"}],
  "progress_updates": [{"module_id": "${moduleId}", "step": "campaign_launched"}],
  "validation_results": [],
  "needs_escalation": false,
  "summary": "Description of what was set up"
}
\`\`\``);

  return sections.join('\n\n');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='outreach-agent.test' --no-coverage`
Expected: 8 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/copilot/sub-agents/outreach-agent.ts src/__tests__/lib/ai/copilot/sub-agents/outreach-agent.test.ts
git commit -m "feat(accelerator): add Outreach Setup Agent (M3+M4) with provider resolution"
```

---

### Task 11: Wire New Agents into Config

**Files:**
- Modify: `src/lib/ai/copilot/sub-agents/config.ts`

Update AGENT_MODULE_MAP, add imports, add switch cases, and extend tool list with provider actions.

- [ ] **Step 1: Update config.ts**

1. Add imports at the top:
```typescript
import { buildTamAgentPrompt } from './tam-agent';
import { buildOutreachAgentPrompt } from './outreach-agent';
```

2. Update AGENT_MODULE_MAP (add tam and outreach):
```typescript
const AGENT_MODULE_MAP: Record<SubAgentType, ModuleId> = {
  icp: 'm0',
  lead_magnet: 'm1',
  tam: 'm2',
  outreach: 'm3', // Default to M3; agent handles both M3 and M4
  content: 'm7',
  troubleshooter: 'm0',
};
```

3. Add switch cases:
```typescript
    case 'tam':
      systemPrompt = buildTamAgentPrompt(sopData, userContext);
      break;
    case 'outreach': {
      // Determine focus from context (default to linkedin)
      const focus = context.toLowerCase().includes('email') || context.toLowerCase().includes('cold')
        ? 'email' as const
        : 'linkedin' as const;
      // Load SOPs for both M3 and M4 if doing email
      if (focus === 'email') {
        const m4Sops = await getSopsByModule('m4');
        const m4SopData = m4Sops.map((s) => ({
          title: s.title,
          content: s.content,
          quality_bars: s.quality_bars as unknown[],
        }));
        sopData.push(...m4SopData);
      }
      systemPrompt = buildOutreachAgentPrompt(sopData, userContext, focus);
      break;
    }
```

4. Extend relevantToolNames to include provider actions:
```typescript
  const relevantToolNames = [
    'get_program_state',
    'get_module_sops',
    'create_deliverable',
    'validate_deliverable',
    'update_module_progress',
    'save_intake_data',
    // Provider actions (Phase 2)
    'list_providers',
    'check_provider_status',
    'configure_provider',
    'get_guided_steps',
  ];
```

- [ ] **Step 2: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/ai/copilot/sub-agents/config.ts
git commit -m "feat(accelerator): wire TAM and Outreach agents into sub-agent config"
```

---

## Chunk 4: SOP Seeding & Integration Testing

### Task 12: Update SOP Seed Script for M2, M3, M4

**Files:**
- Modify: `scripts/seed-sops.ts`

Add M2, M3, M4 module directories to the seed script.

- [ ] **Step 1: Update MODULE_DIRS**

In `scripts/seed-sops.ts`, replace the `MODULE_DIRS` object:

```typescript
const MODULE_DIRS: Record<string, string> = {
  m0: 'module-0-positioning',
  m1: 'module-1-lead-magnets',
  m2: 'module-2-tam-building',
  m3: 'module-3-linkedin-outreach',
  m4: 'module-4-cold-email',
  m7: 'module-7-daily-content',
};
```

Also update the comment at top of file to say "Phase 1 + Phase 2 modules".

- [ ] **Step 2: Verify the SOP directories exist**

Run: `ls "/Users/timlife/Documents/claude code/dwy-playbook/docs/sops/module-2-tam-building/" | wc -l && ls "/Users/timlife/Documents/claude code/dwy-playbook/docs/sops/module-3-linkedin-outreach/" | wc -l && ls "/Users/timlife/Documents/claude code/dwy-playbook/docs/sops/module-4-cold-email/" | wc -l`
Expected: 8, 7, 7 (or similar counts)

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-sops.ts
git commit -m "feat(accelerator): add M2, M3, M4 SOP directories to seed script"
```

---

### Task 13: End-to-End Typecheck, Tests, and Build

**Files:** None (verification only)

- [ ] **Step 1: Run all accelerator tests**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --testPathPattern='(accelerator|provider|outreach-agent)' --no-coverage`
Expected: All tests pass

- [ ] **Step 2: Run full test suite**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx jest --no-coverage 2>&1 | tail -10`
Expected: Same pre-existing failures only (email-sequence, PostDetailModal)

- [ ] **Step 3: Run typecheck**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run production build**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && npx next build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 5: Verify git status is clean**

Run: `cd "/Users/timlife/Documents/claude code/magnetlab" && git status`
Expected: Nothing to commit (working tree clean), or only docs/superpowers/ untracked

---

## Summary

| Task | What | Files | Tests |
|------|------|-------|-------|
| 1 | provider_configs DB table | 1 migration | - |
| 2 | Provider types + errors | 2 new files | - |
| 3 | Provider registry | 1 new + 1 test | 5 tests |
| 4 | HeyReach DM provider | 1 new + 1 test | 5 tests |
| 5 | PlusVibe email provider | 1 new + 1 test | 6 tests |
| 6 | Guided fallback provider | 1 new + 1 test | 5 tests |
| 7 | Phase 2 type updates | 1 modified | - |
| 8 | Provider actions | 2 new + 2 modified | 4 tests |
| 9 | TAM Builder Agent (M2) | 1 new + 1 test | 7 tests |
| 10 | Outreach Setup Agent (M3+M4) | 1 new + 1 test | 8 tests |
| 11 | Wire agents into config | 1 modified | - |
| 12 | SOP seed script update | 1 modified | - |
| 13 | E2E verification | - | Full suite |

**Total:** ~17 new files, ~5 modified files, ~39 new tests
