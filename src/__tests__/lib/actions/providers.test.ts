/**
 * @jest-environment node
 */

// Mock providers
jest.mock('@/lib/providers/registry', () => ({
  getAvailableProviders: jest
    .fn()
    .mockReturnValue([
      {
        id: 'heyreach',
        name: 'HeyReach',
        capability: 'dm_outreach',
        integrationTier: 'provisionable',
        status: 'recommended',
      },
    ]),
  resolveProvider: jest.fn().mockResolvedValue(null),
  saveProviderConfig: jest.fn().mockResolvedValue(true),
  getProviderConfig: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/lib/providers/guided-fallback', () => ({
  GuidedFallbackProvider: jest.fn().mockImplementation(() => ({
    getSetupSteps: jest
      .fn()
      .mockReturnValue([{ stepNumber: 1, title: 'Step 1', instructions: 'Do this' }]),
  })),
}));

// Need to import providers to register the actions
import '@/lib/actions/providers';
import { executeAction } from '@/lib/actions/executor';
import type { ActionContext } from '@/lib/actions/types';

const ctx: ActionContext = { userId: 'user-1' };

describe('Provider Actions', () => {
  it('registers list_providers action', async () => {
    const result = await executeAction(ctx, 'list_providers', { capability: 'dm_outreach' });
    expect(result.success).toBe(true);
    expect((result.data as { providers: unknown[] }).providers).toHaveLength(1);
  });

  it('registers check_provider_status action', async () => {
    const result = await executeAction(ctx, 'check_provider_status', { capability: 'dm_outreach' });
    expect(result.success).toBe(true);
    expect((result.data as Record<string, unknown>).configured).toBe(false);
  });

  it('registers configure_provider action', async () => {
    const result = await executeAction(ctx, 'configure_provider', {
      capability: 'dm_outreach',
      provider_id: 'heyreach',
    });
    expect(result.success).toBe(true);
  });

  it('registers get_guided_steps action', async () => {
    const result = await executeAction(ctx, 'get_guided_steps', { capability: 'dm_outreach' });
    expect(result.success).toBe(true);
    const data = result.data as { steps: unknown[] };
    expect(data.steps).toHaveLength(1);
  });
});
