import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

registerAction({
  name: 'list_templates',
  description: 'List available post templates. Returns template names, descriptions, content types, and example posts.',
  parameters: {
    properties: {
      limit: { type: 'number', description: 'Max templates to return (default 20)' },
    },
  },
  handler: async (ctx: ActionContext, params: { limit?: number }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { data: templates, error } = await supabase
      .from('cp_post_templates')
      .select('id, name, description, content_type, example_post')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(params.limit || 20);

    if (error) return { success: false, error: error.message };

    return { success: true, data: templates || [], displayHint: 'text' };
  },
});

registerAction({
  name: 'list_writing_styles',
  description: 'List the user\'s saved writing styles. Returns style names, descriptions, and tone keywords.',
  parameters: {
    properties: {
      limit: { type: 'number', description: 'Max styles to return (default 20)' },
    },
  },
  handler: async (ctx: ActionContext, params: { limit?: number }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { data: styles, error } = await supabase
      .from('cp_writing_styles')
      .select('id, name, description, tone_keywords')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
      .limit(params.limit || 20);

    if (error) return { success: false, error: error.message };

    return { success: true, data: styles || [], displayHint: 'text' };
  },
});
