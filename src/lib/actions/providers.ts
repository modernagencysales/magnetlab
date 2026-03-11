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
  description: 'Save provider configuration for a capability. Call after user chooses a provider.',
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
  handler: async (
    ctx,
    params: { capability: CapabilityType; provider_id: string; config?: Record<string, unknown> }
  ) => {
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
