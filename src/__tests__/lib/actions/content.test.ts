/**
 * @jest-environment node
 */
import { executeAction } from '@/lib/actions/executor';
import '@/lib/actions/content';
import type { ActionContext } from '@/lib/actions/types';

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'post-1', draft_content: 'Test content', status: 'draft', voice_profile: null, full_name: 'Tim', title: 'CEO' },
        error: null,
      }),
    })),
  })),
}));

jest.mock('@/lib/ai/content-pipeline/post-writer', () => ({
  writePost: jest.fn().mockResolvedValue({
    content: 'Written post content',
    variations: [{ content: 'Variation 1' }],
    dm_template: 'DM template',
    cta_word: 'comment',
  }),
}));

jest.mock('@/lib/ai/content-pipeline/post-polish', () => ({
  polishPost: jest.fn().mockResolvedValue({
    original: 'Original', polished: 'Polished', changes: ['Fixed hook'], hookScore: 8,
  }),
}));

jest.mock('@/lib/ai/content-pipeline/briefing-agent', () => ({
  buildContentBrief: jest.fn().mockResolvedValue({
    topic: 'pricing', compiledContext: 'Context', suggestedAngles: [], topicReadiness: 0.8,
  }),
}));

const ctx: ActionContext = { userId: 'user-1' };

describe('Content Actions', () => {
  it('write_post generates and persists a post', async () => {
    const result = await executeAction(ctx, 'write_post', { topic: 'pricing objections' });
    expect(result.success).toBe(true);
    expect(result.displayHint).toBe('post_preview');
  });

  it('polish_post polishes existing post', async () => {
    const result = await executeAction(ctx, 'polish_post', { post_id: 'post-1' });
    expect(result.success).toBe(true);
    expect((result.data as { polished: string }).polished).toBe('Polished');
  });

  it('list_posts returns posts', async () => {
    const result = await executeAction(ctx, 'list_posts', { status: 'draft' });
    expect(result.success).toBe(true);
  });

  it('update_post_content updates content', async () => {
    const result = await executeAction(ctx, 'update_post_content', { post_id: 'post-1', content: 'New content' });
    expect(result.success).toBe(true);
  });
});
