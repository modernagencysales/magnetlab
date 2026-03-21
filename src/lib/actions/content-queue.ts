/**
 * Content Queue Actions.
 * Copilot actions for editing posts in the cross-team content queue.
 * Uses team-scoped access validation via contentQueueService.
 */

import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { updateQueuePost } from '@/server/services/content-queue.service';

// ─── Actions ──────────────────────────────────────────────────────────────

registerAction({
  name: 'update_queue_post_content',
  description:
    'Update the content of a post in the content queue. Use this when editing team posts in the content queue — it validates team membership. Do NOT use update_post_content for queue posts.',
  parameters: {
    properties: {
      post_id: { type: 'string', description: 'The queue post ID to update' },
      content: { type: 'string', description: 'The new post content (full replacement)' },
    },
    required: ['post_id', 'content'],
  },
  requiresConfirmation: true,
  handler: async (
    ctx: ActionContext,
    params: { post_id: string; content: string }
  ): Promise<ActionResult> => {
    try {
      await updateQueuePost(ctx.scope.userId, params.post_id, {
        draft_content: params.content,
      });
      return {
        success: true,
        data: { post_id: params.post_id, updated: true },
        displayHint: 'text',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Update failed';
      return { success: false, error: message };
    }
  },
});
