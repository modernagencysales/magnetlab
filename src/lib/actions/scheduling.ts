import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

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
    const supabase = createSupabaseAdminClient();

    const { error } = await supabase
      .from('cp_pipeline_posts')
      .update({
        scheduled_time: params.scheduled_time,
        status: 'scheduled',
      })
      .eq('id', params.post_id)
      .eq('user_id', ctx.userId);

    if (error) return { success: false, error: error.message };

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
    const supabase = createSupabaseAdminClient();

    // Count buffer posts
    const { data: bufferPosts, error: bufferError } = await supabase
      .from('cp_pipeline_posts')
      .select('id')
      .eq('user_id', ctx.userId)
      .eq('is_buffer', true);

    if (bufferError) return { success: false, error: bufferError.message };

    // Get posting slots
    const { data: slots, error: slotsError } = await supabase
      .from('cp_posting_slots')
      .select('id, day_of_week, time_utc, is_active')
      .eq('user_id', ctx.userId)
      .order('day_of_week', { ascending: true });

    if (slotsError) return { success: false, error: slotsError.message };

    return {
      success: true,
      data: {
        buffer_count: (bufferPosts || []).length,
        slots: slots || [],
      },
      displayHint: 'text',
    };
  },
});
