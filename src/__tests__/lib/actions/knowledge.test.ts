/**
 * @jest-environment node
 */
import { executeAction } from '@/lib/actions/executor';
import '@/lib/actions/knowledge'; // registers actions on import
import type { ActionContext } from '@/lib/actions/types';

// Mock the underlying services
jest.mock('@/lib/services/knowledge-brain', () => ({
  searchKnowledgeV2: jest.fn().mockResolvedValue([
    { id: 'k1', content: 'Pricing insight', knowledge_type: 'insight', quality_score: 4 },
  ]),
  listKnowledgeTopics: jest.fn().mockResolvedValue([
    { slug: 'pricing', display_name: 'Pricing', entry_count: 12, avg_quality: 3.8 },
  ]),
}));

jest.mock('@/lib/ai/content-pipeline/briefing-agent', () => ({
  buildContentBrief: jest.fn().mockResolvedValue({
    topic: 'pricing',
    compiledContext: 'Context...',
    suggestedAngles: ['Angle 1'],
    topicReadiness: 0.85,
  }),
}));

const ctx: ActionContext = { userId: 'user-1' };

describe('Knowledge Actions', () => {
  it('search_knowledge returns results', async () => {
    const result = await executeAction(ctx, 'search_knowledge', { query: 'pricing' });
    expect(result.success).toBe(true);
    expect(result.displayHint).toBe('knowledge_list');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('list_topics returns topics', async () => {
    const result = await executeAction(ctx, 'list_topics', {});
    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('build_content_brief returns brief', async () => {
    const result = await executeAction(ctx, 'build_content_brief', { topic: 'pricing' });
    expect(result.success).toBe(true);
    expect((result.data as { topicReadiness: number }).topicReadiness).toBe(0.85);
  });
});
