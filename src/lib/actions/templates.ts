/**
 * Templates & Writing Styles Actions.
 * Copilot actions for listing post templates and writing styles.
 * Uses repos with DataScope — never raw Supabase queries.
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { listTemplates } from '@/server/repositories/cp-templates.repo';
import { findStylesByUserId } from '@/server/repositories/styles.repo';

// ─── Templates ────────────────────────────────────────────────

registerAction({
  name: 'list_templates',
  description:
    'List available post templates. Returns template names, descriptions, categories, and example posts.',
  parameters: {
    properties: {
      limit: { type: 'number', description: 'Max templates to return (default 20)' },
    },
  },
  handler: async (ctx: ActionContext, params: { limit?: number }): Promise<ActionResult> => {
    const { data, error } = await listTemplates(ctx.scope, null);

    if (error) return { success: false, error: error.message };

    const limited = (data || []).slice(0, params.limit || 20);

    return { success: true, data: limited, displayHint: 'text' };
  },
});

// ─── Writing Styles ────────────────────────────────────────────

registerAction({
  name: 'list_writing_styles',
  description:
    "List the user's saved writing styles. Returns style names, descriptions, and tone keywords.",
  parameters: {
    properties: {
      limit: { type: 'number', description: 'Max styles to return (default 20)' },
    },
  },
  handler: async (ctx: ActionContext, params: { limit?: number }): Promise<ActionResult> => {
    const styles = await findStylesByUserId(ctx.scope.userId, true);

    const limited = (styles || []).slice(0, params.limit || 20);

    return { success: true, data: limited, displayHint: 'text' };
  },
});
