import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

registerAction({
  name: 'list_funnels',
  description: 'List funnel pages for the current user (excludes A/B test variants). Returns slug, title, status, and timestamps. Optionally filter by status.',
  parameters: {
    properties: {
      status: {
        type: 'string',
        description: 'Filter by funnel status',
      },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
  },
  handler: async (ctx: ActionContext, params: { status?: string; limit?: number }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('funnel_pages')
      .select('id, slug, title, status, created_at, updated_at')
      .eq('user_id', ctx.userId)
      .eq('is_variant', false)
      .order('updated_at', { ascending: false })
      .limit(params.limit || 10);

    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: data || [],
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'get_funnel',
  description: 'Get full details of a specific funnel page by ID, including theme and sections configuration.',
  parameters: {
    properties: {
      id: { type: 'string', description: 'The funnel page ID' },
    },
    required: ['id'],
  },
  handler: async (ctx: ActionContext, params: { id: string }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('funnel_pages')
      .select('id, slug, title, status, theme, sections')
      .eq('id', params.id)
      .eq('user_id', ctx.userId)
      .single();

    if (error || !data) {
      return { success: false, error: 'Funnel not found' };
    }

    return {
      success: true,
      data,
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'publish_funnel',
  description: 'Publish a funnel page by setting its status to "published". The funnel will become publicly accessible at its slug URL.',
  parameters: {
    properties: {
      id: { type: 'string', description: 'The funnel page ID to publish' },
    },
    required: ['id'],
  },
  requiresConfirmation: true,
  handler: async (ctx: ActionContext, params: { id: string }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    // Verify the funnel exists and belongs to the user before updating
    const { data: existing } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('id', params.id)
      .eq('user_id', ctx.userId)
      .single();

    if (!existing) {
      return { success: false, error: 'Funnel not found' };
    }

    const { error } = await supabase
      .from('funnel_pages')
      .update({ status: 'published' })
      .eq('id', params.id)
      .eq('user_id', ctx.userId);

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: { id: params.id, status: 'published' },
      displayHint: 'text',
    };
  },
});
