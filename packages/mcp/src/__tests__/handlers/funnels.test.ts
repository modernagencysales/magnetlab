import { describe, it, expect, vi } from 'vitest';
import { handleFunnelTools } from '../../handlers/funnels.js';
import type { MagnetLabClient } from '../../client.js';

// ── Mock data ─────────────────────────────────────────────

const MOCK_PUBLISH_RESULT = {
  funnel: { id: 'fn-1', lead_magnet_id: 'lm-1', slug: 'test' },
  publicUrl: 'https://magnetlab.app/p/user/test',
};

// ── Mock client factory ───────────────────────────────────

function createMockClient(overrides: Partial<MagnetLabClient> = {}) {
  return {
    publishFunnel: vi.fn().mockResolvedValue(MOCK_PUBLISH_RESULT),
    getEmailSequence: vi.fn().mockResolvedValue({ emailSequence: null }),
    ...overrides,
  } as unknown as MagnetLabClient;
}

// ── Publish funnel warning tests ──────────────────────────

describe('handleFunnelTools — publish_funnel email sequence warning', () => {
  it('returns warning when sequence is in draft state', async () => {
    const client = createMockClient({
      getEmailSequence: vi.fn().mockResolvedValue({
        emailSequence: { id: 'seq-1', status: 'draft' },
      }),
    } as Partial<MagnetLabClient>);

    const result = await handleFunnelTools('magnetlab_publish_funnel', { id: 'fn-1' }, client);

    const obj = result as Record<string, unknown>;
    expect(obj.warning).toBeDefined();
    expect(obj.warning).toContain('draft');
    expect(obj.warning).toContain('magnetlab_activate_email_sequence');
    // Original publish data preserved
    expect(obj.publicUrl).toBe('https://magnetlab.app/p/user/test');
  });

  it('returns no warning when sequence is active', async () => {
    const client = createMockClient({
      getEmailSequence: vi.fn().mockResolvedValue({
        emailSequence: { id: 'seq-1', status: 'active' },
      }),
    } as Partial<MagnetLabClient>);

    const result = await handleFunnelTools('magnetlab_publish_funnel', { id: 'fn-1' }, client);

    const obj = result as Record<string, unknown>;
    expect(obj.warning).toBeUndefined();
    expect(obj.publicUrl).toBe('https://magnetlab.app/p/user/test');
  });

  it('returns no warning when no sequence exists', async () => {
    const client = createMockClient();

    const result = await handleFunnelTools('magnetlab_publish_funnel', { id: 'fn-1' }, client);

    const obj = result as Record<string, unknown>;
    expect(obj.warning).toBeUndefined();
  });

  it('does not block publish if sequence check fails', async () => {
    const client = createMockClient({
      getEmailSequence: vi.fn().mockRejectedValue(new Error('Network error')),
    } as Partial<MagnetLabClient>);

    const result = await handleFunnelTools('magnetlab_publish_funnel', { id: 'fn-1' }, client);

    // Publish still succeeds
    const obj = result as Record<string, unknown>;
    expect(obj.publicUrl).toBe('https://magnetlab.app/p/user/test');
    expect(obj.warning).toBeUndefined();
  });

  it('does not warn when funnel has no lead_magnet_id', async () => {
    const client = createMockClient({
      publishFunnel: vi.fn().mockResolvedValue({
        funnel: { id: 'fn-2', slug: 'lib-page' },
        publicUrl: 'https://magnetlab.app/p/user/lib-page',
      }),
    } as Partial<MagnetLabClient>);

    const result = await handleFunnelTools('magnetlab_publish_funnel', { id: 'fn-2' }, client);

    const obj = result as Record<string, unknown>;
    expect(obj.warning).toBeUndefined();
    // Should not even try to fetch sequence
    expect(client.getEmailSequence).not.toHaveBeenCalled();
  });
});
