/**
 * Scheduling copilot actions.
 * All data access goes through repos — no raw Supabase queries.
 */

import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { findPosts, updatePost } from '@/server/repositories/posts.repo';
import { listSlots } from '@/server/repositories/cp-schedule-slots.repo';
import { getActiveProfiles, getSlots } from '@/server/repositories/cp-team-schedule.repo';

registerAction({
  name: 'schedule_post',
  description: 'Schedule a draft post for publishing at a specific time. Updates the post status to "scheduled" and sets the scheduled time.',
  parameters: {
    properties: {
      post_id: { type: 'string', description: 'The post ID to schedule' },
      scheduled_time: { type: 'string', description: 'ISO 8601 datetime string for when to publish' },
    },
    required: ['post_id', 'scheduled_time'],
  },
  requiresConfirmation: true,
  handler: async (ctx: ActionContext, params: { post_id: string; scheduled_time: string }): Promise<ActionResult> => {
    try {
      await updatePost(ctx.scope.userId, params.post_id, {
        scheduled_time: params.scheduled_time,
        status: 'scheduled',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Schedule failed';
      return { success: false, error: message };
    }

    return {
      success: true,
      data: { post_id: params.post_id, scheduled_time: params.scheduled_time, status: 'scheduled' },
      displayHint: 'calendar',
    };
  },
});

registerAction({
  name: 'get_autopilot_status',
  description: 'Check the autopilot buffer status — how many posts are queued in the buffer and what posting slots are configured.',
  parameters: {
    properties: {},
  },
  handler: async (ctx: ActionContext): Promise<ActionResult> => {
    const { scope } = ctx;

    // Count buffer posts via repo (handles team scope correctly)
    const bufferPosts = await findPosts(scope, { isBuffer: true });

    // Fetch posting slots — team scope uses profile-level slots; user scope uses user-level slots
    let slots: Array<{ id: string; day_of_week?: number | null; time_of_day?: string; is_active?: boolean | null }> = [];

    if (scope.type === 'team' && scope.teamId) {
      const { data: profiles } = await getActiveProfiles(scope.teamId);
      const profileIds = (profiles ?? []).map((p) => p.id);
      if (profileIds.length > 0) {
        const { data: teamSlots } = await getSlots(profileIds);
        slots = teamSlots ?? [];
      }
    } else {
      const { data: userSlots } = await listSlots(scope.userId);
      slots = userSlots ?? [];
    }

    return {
      success: true,
      data: {
        buffer_count: bufferPosts.length,
        slots,
      },
      displayHint: 'text',
    };
  },
});
