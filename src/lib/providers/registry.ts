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
} from './types';
import { PROVIDER_CONFIG_COLUMNS } from './types';
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
  return PROVIDER_REGISTRY.filter((p) => p.capability === capability && p.status !== 'deprecated');
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
    case 'zapmail':
      // Stub for Phase 2.5 — ZapMail domain provisioning deferred
      return null;
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
