/**
 * Funnel Actions.
 * Copilot actions for listing, viewing, and publishing funnel pages.
 * Uses repos with DataScope — never raw Supabase queries.
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import {
  findAllFunnels,
  findFunnelById,
  assertFunnelAccess,
  updateFunnel,
} from '@/server/repositories/funnels.repo';

// ─── List Funnels ──────────────────────────────────────────────

registerAction({
  name: 'list_funnels',
  description:
    'List funnel pages for the current user (excludes A/B test variants). Returns slug, title, status, and timestamps. Optionally filter by status.',
  parameters: {
    properties: {
      status: {
        type: 'string',
        description: 'Filter by funnel status',
      },
      limit: { type: 'number', description: 'Max results (default 10)' },
    },
  },
  handler: async (
    ctx: ActionContext,
    params: { status?: string; limit?: number }
  ): Promise<ActionResult> => {
    const all = await findAllFunnels(ctx.scope);

    let filtered = all;
    if (params.status) {
      // findAllFunnels returns is_published (boolean) — map status string
      if (params.status === 'published') {
        filtered = all.filter((f: Record<string, unknown>) => f.is_published === true);
      } else if (params.status === 'draft') {
        filtered = all.filter((f: Record<string, unknown>) => f.is_published === false);
      }
    }

    const limited = filtered.slice(0, params.limit || 10);

    return {
      success: true,
      data: limited,
      displayHint: 'text',
    };
  },
});

// ─── Get Funnel ────────────────────────────────────────────────

registerAction({
  name: 'get_funnel',
  description:
    'Get full details of a specific funnel page by ID, including theme and sections configuration.',
  parameters: {
    properties: {
      id: { type: 'string', description: 'The funnel page ID' },
    },
    required: ['id'],
  },
  handler: async (ctx: ActionContext, params: { id: string }): Promise<ActionResult> => {
    const funnel = await findFunnelById(ctx.scope, params.id);

    if (!funnel) {
      return { success: false, error: 'Funnel not found' };
    }

    return {
      success: true,
      data: funnel,
      displayHint: 'text',
    };
  },
});

// ─── Publish Funnel ────────────────────────────────────────────

registerAction({
  name: 'publish_funnel',
  description:
    'Publish a funnel page by setting its status to "published". The funnel will become publicly accessible at its slug URL.',
  parameters: {
    properties: {
      id: { type: 'string', description: 'The funnel page ID to publish' },
    },
    required: ['id'],
  },
  requiresConfirmation: true,
  handler: async (ctx: ActionContext, params: { id: string }): Promise<ActionResult> => {
    // Verify the funnel exists and belongs to the scope before updating
    const existingId = await assertFunnelAccess(ctx.scope, params.id);

    if (!existingId) {
      return { success: false, error: 'Funnel not found' };
    }

    try {
      await updateFunnel(ctx.scope, params.id, {
        is_published: true,
        published_at: new Date().toISOString(),
      });
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to publish funnel',
      };
    }

    return {
      success: true,
      data: { id: params.id, status: 'published' },
      displayHint: 'text',
    };
  },
});
