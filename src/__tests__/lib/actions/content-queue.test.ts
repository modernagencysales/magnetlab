/**
 * @jest-environment node
 */
/**
 * Content Queue Action Tests.
 * Tests the update_queue_post_content action registered in
 * src/lib/actions/content-queue.ts. Validates registration metadata,
 * service delegation, error handling, and response shape.
 */
import { executeAction, actionRequiresConfirmation } from '@/lib/actions/executor';
import { getAction } from '@/lib/actions/registry';
import type { ActionContext } from '@/lib/actions/types';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockUpdateQueuePost = jest.fn();
jest.mock('@/server/services/content-queue.service', () => ({
  updateQueuePost: (...args: unknown[]) => mockUpdateQueuePost(...args),
}));

// Import AFTER mocks so registration picks up the mock
import '@/lib/actions/content-queue';

// ─── Helpers ────────────────────────────────────────────────────────────────

const userScope: DataScope = { type: 'user', userId: 'user-1' };
const ctx: ActionContext = { scope: userScope };

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('update_queue_post_content action', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is registered and has requiresConfirmation=true', () => {
    const action = getAction('update_queue_post_content');
    expect(action).toBeDefined();
    expect(action!.requiresConfirmation).toBe(true);
    expect(actionRequiresConfirmation('update_queue_post_content')).toBe(true);
  });

  it('successfully updates content via service', async () => {
    mockUpdateQueuePost.mockResolvedValue(undefined);
    const result = await executeAction(ctx, 'update_queue_post_content', {
      post_id: 'post-1',
      content: 'New content',
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ post_id: 'post-1', updated: true });
  });

  it('calls updateQueuePost with correct userId, postId, and content', async () => {
    mockUpdateQueuePost.mockResolvedValue(undefined);
    await executeAction(ctx, 'update_queue_post_content', {
      post_id: 'post-42',
      content: 'Rewritten post',
    });
    expect(mockUpdateQueuePost).toHaveBeenCalledTimes(1);
    expect(mockUpdateQueuePost).toHaveBeenCalledWith('user-1', 'post-42', {
      draft_content: 'Rewritten post',
    });
  });

  it('returns error when service throws', async () => {
    mockUpdateQueuePost.mockRejectedValue(new Error('Post not accessible'));
    const result = await executeAction(ctx, 'update_queue_post_content', {
      post_id: 'post-1',
      content: 'anything',
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Post not accessible');
  });

  it('returns displayHint "text" on success', async () => {
    mockUpdateQueuePost.mockResolvedValue(undefined);
    const result = await executeAction(ctx, 'update_queue_post_content', {
      post_id: 'post-1',
      content: 'Updated',
    });
    expect(result.displayHint).toBe('text');
  });
});
