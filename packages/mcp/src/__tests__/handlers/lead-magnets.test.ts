import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleLeadMagnetTools } from '../../handlers/lead-magnets.js';
import type { MagnetLabClient } from '../../client.js';

// ── Mock data ─────────────────────────────────────────────

const MOCK_LEAD_MAGNET = { id: 'lm-123', title: 'Test LM' };
const MOCK_FUNNEL = { funnel: { id: 'fn-456', slug: 'test-guide' } };
const MOCK_PUBLISH = {
  funnel: { id: 'fn-456' },
  publicUrl: 'https://magnetlab.app/p/user/test-guide',
};

// ── Mock client factory ───────────────────────────────────

function createMockClient() {
  return {
    createLeadMagnet: vi.fn().mockResolvedValue(MOCK_LEAD_MAGNET),
    createFunnel: vi.fn().mockResolvedValue(MOCK_FUNNEL),
    publishFunnel: vi.fn().mockResolvedValue(MOCK_PUBLISH),
  } as unknown as MagnetLabClient;
}

// ── Tests ─────────────────────────────────────────────────

describe('handleLeadMagnetTools — funnel_config', () => {
  let client: MagnetLabClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('creates lead magnet without funnel when funnel_config is omitted', async () => {
    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      { title: 'Test LM', archetype: 'single-breakdown' },
      client
    );

    expect(client.createLeadMagnet).toHaveBeenCalledWith({
      title: 'Test LM',
      archetype: 'single-breakdown',
      concept: undefined,
    });
    expect(client.createFunnel).not.toHaveBeenCalled();
    expect(client.publishFunnel).not.toHaveBeenCalled();
    expect(result).toEqual(MOCK_LEAD_MAGNET);
  });

  it('creates lead magnet + funnel when funnel_config is provided', async () => {
    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'Test LM',
        archetype: 'single-breakdown',
        funnel_config: {
          slug: 'test-guide',
          optin_headline: 'Get the guide',
          theme: 'dark',
        },
      },
      client
    );

    expect(client.createLeadMagnet).toHaveBeenCalled();
    expect(client.createFunnel).toHaveBeenCalledWith(
      expect.objectContaining({
        leadMagnetId: 'lm-123',
        slug: 'test-guide',
        optinHeadline: 'Get the guide',
        theme: 'dark',
      })
    );

    const resultObj = result as Record<string, unknown>;
    expect(resultObj.lead_magnet).toEqual(MOCK_LEAD_MAGNET);
    expect(resultObj.funnel).toEqual(MOCK_FUNNEL);
  });

  it('auto-generates slug from title when slug is omitted in funnel_config', async () => {
    await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'My Awesome Guide!',
        archetype: 'single-breakdown',
        funnel_config: {
          optin_headline: 'Grab it',
        },
      },
      client
    );

    expect(client.createFunnel).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'my-awesome-guide',
      })
    );
  });

  it('publishes funnel when publish=true, returns public_url', async () => {
    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'Test LM',
        archetype: 'single-breakdown',
        funnel_config: {
          slug: 'test-guide',
          publish: true,
        },
      },
      client
    );

    expect(client.publishFunnel).toHaveBeenCalledWith('fn-456');

    const resultObj = result as Record<string, unknown>;
    expect(resultObj.public_url).toBe('https://magnetlab.app/p/user/test-guide');
  });

  it('does NOT publish when publish is false', async () => {
    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'Test LM',
        archetype: 'single-breakdown',
        funnel_config: {
          slug: 'test-guide',
          publish: false,
        },
      },
      client
    );

    expect(client.publishFunnel).not.toHaveBeenCalled();

    const resultObj = result as Record<string, unknown>;
    expect(resultObj.public_url).toBeUndefined();
    expect(resultObj.lead_magnet).toEqual(MOCK_LEAD_MAGNET);
    expect(resultObj.funnel).toEqual(MOCK_FUNNEL);
  });

  it('returns lead_magnet with funnel_error when funnel creation fails', async () => {
    (client.createFunnel as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Funnel DB error')
    );

    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'Test LM',
        archetype: 'single-breakdown',
        funnel_config: { slug: 'test-guide' },
      },
      client
    );

    const resultObj = result as Record<string, unknown>;
    // Lead magnet is preserved even though funnel failed
    expect(resultObj.lead_magnet).toEqual(MOCK_LEAD_MAGNET);
    expect(resultObj.funnel_error).toBe('Funnel DB error');
    // No funnel key should be present
    expect(resultObj.funnel).toBeUndefined();
  });

  it('returns lead_magnet + funnel with publish_error when publish fails', async () => {
    (client.publishFunnel as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Publish timeout')
    );

    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'Test LM',
        archetype: 'single-breakdown',
        funnel_config: {
          slug: 'test-guide',
          publish: true,
        },
      },
      client
    );

    const resultObj = result as Record<string, unknown>;
    // Both lead magnet and funnel are preserved
    expect(resultObj.lead_magnet).toEqual(MOCK_LEAD_MAGNET);
    expect(resultObj.funnel).toEqual(MOCK_FUNNEL);
    expect(resultObj.publish_error).toBe('Publish timeout');
    // No public_url since publish failed
    expect(resultObj.public_url).toBeUndefined();
  });
});

// ── Generate content tests ────────────────────────────────

const MOCK_GENERATED_CONTENT = {
  extractedContent: { title: 'Test', structure: [] },
  polishedContent: { sections: [], heroSummary: 'Test summary' },
  polishedAt: '2026-03-08T00:00:00Z',
};

describe('handleLeadMagnetTools — magnetlab_generate_lead_magnet_content', () => {
  it('calls generateLeadMagnetContent with the lead_magnet_id', async () => {
    const client = {
      generateLeadMagnetContent: vi.fn().mockResolvedValue(MOCK_GENERATED_CONTENT),
    } as unknown as MagnetLabClient;

    const result = await handleLeadMagnetTools(
      'magnetlab_generate_lead_magnet_content',
      { lead_magnet_id: 'lm-789' },
      client
    );

    expect(client.generateLeadMagnetContent).toHaveBeenCalledWith('lm-789');
    expect(result).toEqual(MOCK_GENERATED_CONTENT);
  });
});
