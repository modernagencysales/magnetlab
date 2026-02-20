/**
 * @jest-environment node
 */

jest.mock('@/lib/services/knowledge-brain', () => ({
  searchKnowledgeV2: jest.fn(),
}));

const mockMessagesCreate = jest.fn();

jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: () => ({ messages: { create: mockMessagesCreate } }),
  parseJsonResponse: (text: string) => JSON.parse(text),
}));

jest.mock('@/lib/ai/content-pipeline/model-config', () => ({
  CLAUDE_SONNET_MODEL: 'claude-sonnet-test',
}));

jest.mock('@/lib/utils/logger', () => ({
  logWarn: jest.fn(),
}));

import { buildContentBrief, buildContentBriefForIdea } from '@/lib/ai/content-pipeline/briefing-agent';
import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';

const mockSearchKnowledgeV2 = searchKnowledgeV2 as jest.Mock;

function makeEntry(overrides: Partial<{
  id: string; category: string; knowledge_type: string; quality_score: number;
  content: string; context: string | null; tags: string[]; speaker: string;
  similarity: number;
}> = {}) {
  return {
    id: overrides.id || 'entry-1',
    category: overrides.category || 'insight',
    knowledge_type: overrides.knowledge_type || 'insight',
    quality_score: overrides.quality_score ?? 3,
    content: overrides.content || 'Test entry content',
    context: overrides.context ?? null,
    tags: overrides.tags || [],
    speaker: overrides.speaker || 'host',
    similarity: overrides.similarity || 0.8,
    topics: [],
    specificity: false,
    actionability: null,
    source_date: null,
    speaker_company: null,
    transcript_type: null,
    transcript_id: null,
    user_id: 'user-1',
    team_id: null,
    source_profile_id: null,
    superseded_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };
}

describe('buildContentBrief', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchKnowledgeV2.mockResolvedValue({ entries: [] });
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '["Angle 1", "Angle 2", "Angle 3"]' }],
    });
  });

  it('calls searchKnowledgeV2 with correct params', async () => {
    await buildContentBrief('user-1', 'sales tips', {
      maxEntries: 20,
      teamId: 'team-abc',
      profileId: 'profile-xyz',
    });

    expect(mockSearchKnowledgeV2).toHaveBeenCalledWith('user-1', {
      query: 'sales tips',
      limit: 20,
      threshold: 0.5,
      minQuality: 2,
      teamId: 'team-abc',
      profileId: 'profile-xyz',
    });
  });

  it('uses default maxEntries of 15 when not specified', async () => {
    await buildContentBrief('user-1', 'topic');

    expect(mockSearchKnowledgeV2).toHaveBeenCalledWith('user-1', expect.objectContaining({
      limit: 15,
    }));
  });

  it('returns entries sorted by quality_score descending', async () => {
    const entries = [
      makeEntry({ id: 'low', quality_score: 1 }),
      makeEntry({ id: 'high', quality_score: 5 }),
      makeEntry({ id: 'mid', quality_score: 3 }),
    ];
    mockSearchKnowledgeV2.mockResolvedValue({ entries });

    const brief = await buildContentBrief('user-1', 'topic');

    // All entries end up in relevantInsights since they all have category='insight'
    const ids = brief.relevantInsights.map((e: { id: string }) => e.id);
    expect(ids).toEqual(['high', 'mid', 'low']);
  });

  it('groups entries by knowledge_type in compiledContext with correct labels', async () => {
    const entries = [
      makeEntry({ id: '1', knowledge_type: 'how_to', content: 'Step one process' }),
      makeEntry({ id: '2', knowledge_type: 'insight', content: 'Key insight here' }),
      makeEntry({ id: '3', knowledge_type: 'story', content: 'My real story' }),
      makeEntry({ id: '4', knowledge_type: 'question', content: 'What about X' }),
      makeEntry({ id: '5', knowledge_type: 'objection', content: 'Too expensive' }),
      makeEntry({ id: '6', knowledge_type: 'mistake', content: 'Common error' }),
      makeEntry({ id: '7', knowledge_type: 'decision', content: 'Choose framework' }),
      makeEntry({ id: '8', knowledge_type: 'market_intel', content: 'Market data' }),
    ];
    mockSearchKnowledgeV2.mockResolvedValue({ entries });

    const brief = await buildContentBrief('user-1', 'topic');

    expect(brief.compiledContext).toContain('STEP-BY-STEP PROCESSES:');
    expect(brief.compiledContext).toContain('KEY INSIGHTS:');
    expect(brief.compiledContext).toContain('REAL STORIES FROM YOUR EXPERIENCE:');
    expect(brief.compiledContext).toContain('QUESTIONS YOUR AUDIENCE ASKS:');
    expect(brief.compiledContext).toContain('OBJECTIONS YOUR AUDIENCE HAS:');
    expect(brief.compiledContext).toContain('MISTAKES TO WARN ABOUT:');
    expect(brief.compiledContext).toContain('DECISIONS & FRAMEWORKS:');
    expect(brief.compiledContext).toContain('MARKET INTELLIGENCE:');

    expect(brief.compiledContext).toContain('Step one process');
    expect(brief.compiledContext).toContain('Key insight here');
    expect(brief.compiledContext).toContain('My real story');
  });

  it('tags high quality entries with [HIGH QUALITY] when quality_score >= 4', async () => {
    const entries = [
      makeEntry({ id: '1', quality_score: 4, content: 'Quality four' }),
      makeEntry({ id: '2', quality_score: 5, content: 'Quality five' }),
    ];
    mockSearchKnowledgeV2.mockResolvedValue({ entries });

    const brief = await buildContentBrief('user-1', 'topic');

    expect(brief.compiledContext).toContain('Quality four [HIGH QUALITY]');
    expect(brief.compiledContext).toContain('Quality five [HIGH QUALITY]');
  });

  it('does NOT tag entries with quality_score < 4', async () => {
    const entries = [
      makeEntry({ id: '1', quality_score: 3, content: 'Quality three' }),
      makeEntry({ id: '2', quality_score: 1, content: 'Quality one' }),
    ];
    mockSearchKnowledgeV2.mockResolvedValue({ entries });

    const brief = await buildContentBrief('user-1', 'topic');

    expect(brief.compiledContext).toContain('- Quality three\n');
    expect(brief.compiledContext).toContain('- Quality one\n');
    expect(brief.compiledContext).not.toContain('Quality three [HIGH QUALITY]');
    expect(brief.compiledContext).not.toContain('Quality one [HIGH QUALITY]');
  });

  it('computes topicReadiness correctly for known inputs', async () => {
    // 15 entries, 5 unique types, avg quality = 4
    // readiness = min(1, (15/15)*0.5 + (5/5)*0.3 + (4/5)*0.2) = min(1, 0.5+0.3+0.16) = 0.96
    const types = ['how_to', 'insight', 'story', 'question', 'objection'];
    const entries = [];
    for (let i = 0; i < 15; i++) {
      entries.push(makeEntry({
        id: `e-${i}`,
        knowledge_type: types[i % 5],
        quality_score: 4,
      }));
    }
    mockSearchKnowledgeV2.mockResolvedValue({ entries });

    const brief = await buildContentBrief('user-1', 'topic');

    expect(brief.topicReadiness).toBeCloseTo(0.96, 2);
  });

  it('returns topicReadiness = 0 when no entries', async () => {
    mockSearchKnowledgeV2.mockResolvedValue({ entries: [] });

    const brief = await buildContentBrief('user-1', 'topic');

    expect(brief.topicReadiness).toBe(0);
  });

  it('caps topicReadiness at 1', async () => {
    // 30 entries, 8 unique types, avg quality = 5
    // readiness = min(1, (30/15)*0.5 + (8/5)*0.3 + (5/5)*0.2) = min(1, 1.0+0.48+0.2) = 1
    const types = ['how_to', 'insight', 'story', 'question', 'objection', 'mistake', 'decision', 'market_intel'];
    const entries = [];
    for (let i = 0; i < 30; i++) {
      entries.push(makeEntry({
        id: `e-${i}`,
        knowledge_type: types[i % 8],
        quality_score: 5,
      }));
    }
    mockSearchKnowledgeV2.mockResolvedValue({ entries });

    const brief = await buildContentBrief('user-1', 'topic');

    expect(brief.topicReadiness).toBe(1);
  });

  it('returns topKnowledgeTypes from entry knowledge types', async () => {
    const entries = [
      makeEntry({ id: '1', knowledge_type: 'how_to' }),
      makeEntry({ id: '2', knowledge_type: 'insight' }),
      makeEntry({ id: '3', knowledge_type: 'story' }),
      makeEntry({ id: '4', knowledge_type: 'insight' }),
    ];
    mockSearchKnowledgeV2.mockResolvedValue({ entries });

    const brief = await buildContentBrief('user-1', 'topic');

    expect(brief.topKnowledgeTypes).toEqual(expect.arrayContaining(['how_to', 'insight', 'story']));
    expect(brief.topKnowledgeTypes).toHaveLength(3);
  });

  it('calls generateSuggestedAngles when >= 3 entries', async () => {
    const entries = [
      makeEntry({ id: '1' }),
      makeEntry({ id: '2' }),
      makeEntry({ id: '3' }),
    ];
    mockSearchKnowledgeV2.mockResolvedValue({ entries });
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '["Angle A", "Angle B"]' }],
    });

    const brief = await buildContentBrief('user-1', 'topic');

    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    expect(brief.suggestedAngles).toEqual(['Angle A', 'Angle B']);
  });

  it('does NOT call generateSuggestedAngles when < 3 entries', async () => {
    const entries = [
      makeEntry({ id: '1' }),
      makeEntry({ id: '2' }),
    ];
    mockSearchKnowledgeV2.mockResolvedValue({ entries });

    const brief = await buildContentBrief('user-1', 'topic');

    expect(mockMessagesCreate).not.toHaveBeenCalled();
    expect(brief.suggestedAngles).toEqual([]);
  });

  it('populates backward-compat fields from category field', async () => {
    const entries = [
      makeEntry({ id: '1', category: 'insight', knowledge_type: 'insight' }),
      makeEntry({ id: '2', category: 'question', knowledge_type: 'question' }),
      makeEntry({ id: '3', category: 'product_intel', knowledge_type: 'market_intel' }),
      makeEntry({ id: '4', category: 'insight', knowledge_type: 'story' }),
    ];
    mockSearchKnowledgeV2.mockResolvedValue({ entries });

    const brief = await buildContentBrief('user-1', 'topic');

    // relevantInsights filters by category === 'insight'
    expect(brief.relevantInsights).toHaveLength(2);
    expect(brief.relevantInsights.map((e: { id: string }) => e.id)).toEqual(
      expect.arrayContaining(['1', '4'])
    );

    // relevantQuestions filters by category === 'question'
    expect(brief.relevantQuestions).toHaveLength(1);
    expect(brief.relevantQuestions[0].id).toBe('2');

    // relevantProductIntel filters by category === 'product_intel'
    expect(brief.relevantProductIntel).toHaveLength(1);
    expect(brief.relevantProductIntel[0].id).toBe('3');
  });

  it('includes context in compiledContext when present', async () => {
    const entries = [
      makeEntry({ id: '1', content: 'Main point', context: 'Said during sales call' }),
    ];
    mockSearchKnowledgeV2.mockResolvedValue({ entries });

    const brief = await buildContentBrief('user-1', 'topic');

    expect(brief.compiledContext).toContain('Main point (Context: Said during sales call)');
  });

  it('uses knowledge_type fallback to category for unknown types', async () => {
    const entries = [
      makeEntry({ id: '1', knowledge_type: undefined as unknown as string, category: 'insight', content: 'Fallback entry' }),
    ];
    mockSearchKnowledgeV2.mockResolvedValue({ entries });

    const brief = await buildContentBrief('user-1', 'topic');

    // category 'insight' is in KNOWLEDGE_TYPE_LABELS, so label is used
    expect(brief.compiledContext).toContain('KEY INSIGHTS:');
    expect(brief.compiledContext).toContain('Fallback entry');
  });

  it('returns empty suggestedAngles when AI call fails', async () => {
    const entries = [
      makeEntry({ id: '1' }),
      makeEntry({ id: '2' }),
      makeEntry({ id: '3' }),
    ];
    mockSearchKnowledgeV2.mockResolvedValue({ entries });
    mockMessagesCreate.mockRejectedValue(new Error('API error'));

    const brief = await buildContentBrief('user-1', 'topic');

    expect(brief.suggestedAngles).toEqual([]);
  });
});

describe('buildContentBriefForIdea', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchKnowledgeV2.mockResolvedValue({ entries: [] });
  });

  it('combines idea.title and idea.core_insight as search query', async () => {
    await buildContentBriefForIdea('user-1', {
      title: 'Cold Email Tips',
      core_insight: 'Personalization matters',
      content_type: 'how_to',
    });

    expect(mockSearchKnowledgeV2).toHaveBeenCalledWith('user-1', expect.objectContaining({
      query: 'Cold Email Tips Personalization matters',
    }));
  });

  it('uses only title when core_insight is null', async () => {
    await buildContentBriefForIdea('user-1', {
      title: 'Sales Strategies',
      core_insight: null,
      content_type: null,
    });

    expect(mockSearchKnowledgeV2).toHaveBeenCalledWith('user-1', expect.objectContaining({
      query: 'Sales Strategies',
    }));
  });

  it('passes teamId and profileId through', async () => {
    await buildContentBriefForIdea(
      'user-1',
      { title: 'Topic', core_insight: null, content_type: null },
      { teamId: 'team-1', profileId: 'profile-1' }
    );

    expect(mockSearchKnowledgeV2).toHaveBeenCalledWith('user-1', expect.objectContaining({
      teamId: 'team-1',
      profileId: 'profile-1',
    }));
  });
});
