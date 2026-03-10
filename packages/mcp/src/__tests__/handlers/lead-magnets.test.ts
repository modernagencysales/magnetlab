import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleLeadMagnetTools, enrichConceptFromPosition } from '../../handlers/lead-magnets.js';
import type { MagnetLabClient } from '../../client.js';

// ── Mock data ─────────────────────────────────────────────

const MOCK_LEAD_MAGNET = { id: 'lm-123', title: 'Test LM' };
const MOCK_FUNNEL = { funnel: { id: 'fn-456', slug: 'test-guide' } };
const MOCK_PUBLISH = {
  funnel: { id: 'fn-456' },
  publicUrl: 'https://magnetlab.app/p/user/test-guide',
};

const MOCK_POSITION = {
  thesis: 'Cold email works but requires proper infrastructure investment.',
  stance_type: 'contrarian',
  confidence: 0.85,
  key_arguments: ['PlusVibe over Instantly', 'Multi-channel is essential', 'Infrastructure > copy'],
  unique_data_points: [{ claim: '1,500 emails, 3% reply rate', evidence_strength: 'measured' }],
  stories: [
    {
      hook: 'We burned $2K on Instantly',
      arc: 'Switched to PlusVibe',
      lesson: 'Infrastructure matters',
    },
  ],
  specific_recommendations: [
    { recommendation: 'Use PlusVibe for cold email', reasoning: 'Better deliverability' },
  ],
  voice_markers: ['infrastructure matters more than copy'],
  differentiators: ['Focuses on deliverability, not templates'],
  contradictions: [],
  coverage_gaps: ['No deliverability metrics', 'Missing warm-up benchmarks'],
  supporting_entry_ids: ['e1', 'e2', 'e3'],
};

const MOCK_SEARCH_RESULT = {
  entries: [
    {
      id: 'e1',
      content: 'PlusVibe is better',
      category: 'insight',
      knowledge_type: 'insight',
      topics: ['cold-email'],
    },
    {
      id: 'e2',
      content: 'We switched from Instantly',
      category: 'insight',
      knowledge_type: 'story',
      topics: ['cold-email'],
    },
    {
      id: 'e3',
      content: 'Why do reply rates vary?',
      category: 'question',
      knowledge_type: 'question',
      topics: ['cold-email'],
    },
  ],
};

// ── Mock client factory ───────────────────────────────────

function createMockClient() {
  return {
    createLeadMagnet: vi.fn().mockResolvedValue(MOCK_LEAD_MAGNET),
    createFunnel: vi.fn().mockResolvedValue(MOCK_FUNNEL),
    publishFunnel: vi.fn().mockResolvedValue(MOCK_PUBLISH),
    searchKnowledge: vi.fn().mockResolvedValue(MOCK_SEARCH_RESULT),
    synthesizePosition: vi.fn().mockResolvedValue({ position: MOCK_POSITION }),
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

// ── Brain enrichment tests ───────────────────────────────

describe('enrichConceptFromPosition', () => {
  it('maps position fields to concept fields', () => {
    const concept = enrichConceptFromPosition(MOCK_POSITION);

    expect(concept.painSolved).toBe(MOCK_POSITION.thesis);
    expect(concept.whyNowHook).toBe('Focuses on deliverability, not templates');
    expect(concept.hook).toContain('We burned $2K on Instantly');
    expect(concept.hook).toContain('Infrastructure matters');
    expect(concept.pain_points).toEqual([
      'No deliverability metrics',
      'Missing warm-up benchmarks',
    ]);
    expect(concept.key_takeaways).toEqual(MOCK_POSITION.key_arguments);
    expect(concept.cta_angle).toBe('Use PlusVibe for cold email');
    expect(concept.contents).toContain('PlusVibe over Instantly');
  });

  it('uses data point claim as hook when no stories', () => {
    const positionNoStories = { ...MOCK_POSITION, stories: [] };
    const concept = enrichConceptFromPosition(positionNoStories);

    expect(concept.hook).toBe('1,500 emails, 3% reply rate');
  });

  it('handles empty position gracefully', () => {
    const concept = enrichConceptFromPosition({});
    expect(Object.keys(concept).length).toBe(0);
  });
});

describe('handleLeadMagnetTools — use_brain', () => {
  let client: MagnetLabClient;

  beforeEach(() => {
    client = createMockClient();
  });

  it('enriches concept from brain when use_brain=true', async () => {
    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      { title: 'Cold Email Checklist', archetype: 'focused-toolkit', use_brain: true },
      client
    );

    // Should have searched brain with title
    expect(client.searchKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'Cold Email Checklist', limit: 20 })
    );

    // Should have tried to synthesize position for dominant topic
    expect(client.synthesizePosition).toHaveBeenCalledWith({ topic: 'cold-email' });

    // Should have created lead magnet with enriched concept
    expect(client.createLeadMagnet).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Cold Email Checklist',
        archetype: 'focused-toolkit',
        concept: expect.objectContaining({
          painSolved: MOCK_POSITION.thesis,
          key_takeaways: MOCK_POSITION.key_arguments,
        }),
      })
    );

    // Should include brain metadata
    const resultObj = result as Record<string, unknown>;
    expect(resultObj.brain_entries_used).toBe(3);
    expect(resultObj.position_used).toBe(true);
  });

  it('uses brain_query instead of title when provided', async () => {
    await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'My Guide',
        archetype: 'focused-toolkit',
        use_brain: true,
        brain_query: 'cold email deliverability',
      },
      client
    );

    expect(client.searchKnowledge).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'cold email deliverability' })
    );
  });

  it('manual concept fields override brain-derived ones', async () => {
    await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'Cold Email Checklist',
        archetype: 'focused-toolkit',
        use_brain: true,
        concept: { painSolved: 'My custom pain point', customField: 'preserved' },
      },
      client
    );

    const callArgs = (client.createLeadMagnet as ReturnType<typeof vi.fn>).mock.calls[0][0];
    // Manual painSolved should override brain-derived thesis
    expect(callArgs.concept.painSolved).toBe('My custom pain point');
    // Custom field should be preserved
    expect(callArgs.concept.customField).toBe('preserved');
    // Brain-derived fields should still be present where manual doesn't exist
    expect(callArgs.concept.key_takeaways).toEqual(MOCK_POSITION.key_arguments);
  });

  it('falls back to raw entries when position synthesis fails', async () => {
    (client.synthesizePosition as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Position not found')
    );

    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      { title: 'Cold Email Checklist', archetype: 'focused-toolkit', use_brain: true },
      client
    );

    // Should still create lead magnet with entry-based enrichment
    const callArgs = (client.createLeadMagnet as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.concept.key_takeaways).toBeDefined();

    const resultObj = result as Record<string, unknown>;
    expect(resultObj.position_used).toBe(false);
    expect(resultObj.brain_entries_used).toBe(3);
  });

  it('creates normally when brain search returns empty', async () => {
    (client.searchKnowledge as ReturnType<typeof vi.fn>).mockResolvedValue({ entries: [] });

    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      { title: 'Cold Email Checklist', archetype: 'focused-toolkit', use_brain: true },
      client
    );

    // Position synthesis should NOT be called (no entries = no topics)
    expect(client.synthesizePosition).not.toHaveBeenCalled();

    const resultObj = result as Record<string, unknown>;
    expect(resultObj.brain_entries_used).toBe(0);
    expect(resultObj.position_used).toBe(false);
  });

  it('does not call brain when use_brain is false', async () => {
    await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      { title: 'Cold Email Checklist', archetype: 'focused-toolkit' },
      client
    );

    expect(client.searchKnowledge).not.toHaveBeenCalled();
    expect(client.synthesizePosition).not.toHaveBeenCalled();
  });

  it('stores knowledge_entry_ids in concept metadata', async () => {
    await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'Cold Email Checklist',
        archetype: 'focused-toolkit',
        use_brain: true,
        knowledge_entry_ids: ['custom-1', 'custom-2'],
      },
      client
    );

    const callArgs = (client.createLeadMagnet as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(callArgs.concept._brain_entry_ids).toContain('custom-1');
    expect(callArgs.concept._brain_entry_ids).toContain('custom-2');
    // Should also include search result IDs
    expect(callArgs.concept._brain_entry_ids).toContain('e1');
  });

  it('includes brain metadata when funnel_config is also provided', async () => {
    const result = await handleLeadMagnetTools(
      'magnetlab_create_lead_magnet',
      {
        title: 'Cold Email Checklist',
        archetype: 'focused-toolkit',
        use_brain: true,
        funnel_config: { slug: 'cold-email-checklist' },
      },
      client
    );

    const resultObj = result as Record<string, unknown>;
    expect(resultObj.lead_magnet).toEqual(MOCK_LEAD_MAGNET);
    expect(resultObj.funnel).toEqual(MOCK_FUNNEL);
    expect(resultObj.brain_entries_used).toBe(3);
    expect(resultObj.position_used).toBe(true);
  });
});
