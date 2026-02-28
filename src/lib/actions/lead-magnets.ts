import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

registerAction({
  name: 'list_lead_magnets',
  description: 'List lead magnets for the current user. Returns title, status, archetype, and timestamps. Optionally filter by status.',
  parameters: {
    properties: {
      status: {
        type: 'string',
        enum: ['draft', 'published', 'scheduled', 'archived'],
        description: 'Filter by lead magnet status',
      },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
  },
  handler: async (ctx: ActionContext, params: { status?: string; limit?: number }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('lead_magnets')
      .select('id, title, status, archetype, created_at, updated_at')
      .eq('user_id', ctx.userId)
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
  name: 'get_lead_magnet',
  description: 'Get full details of a specific lead magnet by ID, including content blocks and extraction data.',
  parameters: {
    properties: {
      id: { type: 'string', description: 'The lead magnet ID' },
    },
    required: ['id'],
  },
  handler: async (ctx: ActionContext, params: { id: string }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('lead_magnets')
      .select('id, title, archetype, status, content_blocks, extraction_data, created_at')
      .eq('id', params.id)
      .eq('user_id', ctx.userId)
      .single();

    if (error || !data) {
      return { success: false, error: 'Lead magnet not found' };
    }

    return {
      success: true,
      data,
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'create_lead_magnet',
  description: 'Create a new lead magnet with a title and archetype. Returns the created lead magnet details.',
  parameters: {
    properties: {
      title: { type: 'string', description: 'Title for the lead magnet' },
      archetype: {
        type: 'string',
        description: 'Lead magnet archetype (default: guide)',
      },
    },
    required: ['title'],
  },
  requiresConfirmation: true,
  handler: async (ctx: ActionContext, params: { title: string; archetype?: string }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from('lead_magnets')
      .insert({
        user_id: ctx.userId,
        title: params.title,
        archetype: params.archetype || 'guide',
        status: 'draft',
      })
      .select('id, title, archetype, status')
      .single();

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data,
      displayHint: 'text',
    };
  },
});
