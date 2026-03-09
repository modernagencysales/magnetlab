import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';

registerAction({
  name: 'list_email_sequences',
  description: 'List email sequences for the current user. Returns name, status, and creation date. Optionally filter by status.',
  parameters: {
    properties: {
      status: {
        type: 'string',
        description: 'Filter by sequence status',
      },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
  },
  handler: async (ctx: ActionContext, params: { status?: string; limit?: number }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('email_sequences')
      .select('id, name, status, created_at')
      .eq('user_id', ctx.userId)
      .order('created_at', { ascending: false })
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
  name: 'get_subscriber_count',
  description: 'Get the count of active email subscribers for the current user.',
  parameters: {
    properties: {},
  },
  handler: async (ctx: ActionContext): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { count, error } = await supabase
      .from('email_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', ctx.userId)
      .eq('status', 'active');

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: { count: count || 0 },
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'generate_newsletter_email',
  description: 'Search the knowledge base for relevant context on a topic to prepare a newsletter email brief. Returns knowledge entries that can inform the email content.',
  parameters: {
    properties: {
      topic: { type: 'string', description: 'The topic to write the newsletter about' },
    },
    required: ['topic'],
  },
  handler: async (ctx: ActionContext, params: { topic: string }): Promise<ActionResult> => {
    const results = await searchKnowledgeV2(ctx.userId, {
      query: params.topic,
    });

    return {
      success: true,
      data: {
        topic: params.topic,
        knowledge_results: results,
        brief: `Found ${Array.isArray(results) ? results.length : 0} relevant knowledge entries for topic: "${params.topic}". Use these to draft a newsletter email.`,
      },
      displayHint: 'text',
    };
  },
});
