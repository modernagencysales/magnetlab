/**
 * Email Actions.
 * Copilot actions for listing email sequences, getting subscriber counts,
 * and generating newsletter email briefs.
 * Uses repos/services with DataScope — never raw Supabase queries.
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { applyScope } from '@/lib/utils/team-context';
import { searchKnowledgeV2 } from '@/lib/services/knowledge-brain';

// ─── Column sets ────────────────────────────────────────────────

const SEQ_LIST_COLUMNS = 'id, name, status, created_at';

// ─── List Email Sequences ──────────────────────────────────────

registerAction({
  name: 'list_email_sequences',
  description:
    'List email sequences for the current user. Returns name, status, and creation date. Optionally filter by status.',
  parameters: {
    properties: {
      status: {
        type: 'string',
        description: 'Filter by sequence status',
      },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
  },
  handler: async (
    ctx: ActionContext,
    params: { status?: string; limit?: number }
  ): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    let query = applyScope(
      supabase
        .from('email_sequences')
        .select(SEQ_LIST_COLUMNS)
        .order('created_at', { ascending: false })
        .limit(params.limit || 10),
      ctx.scope
    );

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

// ─── Get Subscriber Count ──────────────────────────────────────

registerAction({
  name: 'get_subscriber_count',
  description: 'Get the count of active email subscribers for the current team.',
  parameters: {
    properties: {},
  },
  handler: async (ctx: ActionContext): Promise<ActionResult> => {
    // email_subscribers is team-scoped only — requires a team context
    if (!ctx.scope.teamId) {
      return {
        success: true,
        data: { count: 0, note: 'Subscriber counts require a team context.' },
        displayHint: 'text',
      };
    }

    const supabase = createSupabaseAdminClient();

    const { count, error } = await supabase
      .from('email_subscribers')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', ctx.scope.teamId)
      .eq('status', 'active');

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: { count: count || 0 },
      displayHint: 'text',
    };
  },
});

// ─── Generate Newsletter Email ─────────────────────────────────

registerAction({
  name: 'generate_newsletter_email',
  description:
    'Search the knowledge base for relevant context on a topic to prepare a newsletter email brief. Returns knowledge entries that can inform the email content.',
  parameters: {
    properties: {
      topic: { type: 'string', description: 'The topic to write the newsletter about' },
    },
    required: ['topic'],
  },
  handler: async (ctx: ActionContext, params: { topic: string }): Promise<ActionResult> => {
    const results = await searchKnowledgeV2(ctx.scope.userId, {
      query: params.topic,
      teamId: ctx.scope.teamId,
    });

    return {
      success: true,
      data: {
        topic: params.topic,
        knowledge_results: results,
        brief: `Found ${Array.isArray(results.entries) ? results.entries.length : 0} relevant knowledge entries for topic: "${params.topic}". Use these to draft a newsletter email.`,
      },
      displayHint: 'text',
    };
  },
});
