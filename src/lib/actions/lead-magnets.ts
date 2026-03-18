/**
 * Lead Magnet Actions.
 *
 * Copilot actions for listing, viewing, and creating lead magnets
 * through the Brain-aware creation pipeline. Read actions delegate to
 * repos with DataScope; creation actions delegate to the lead-magnet-creation
 * orchestrator.
 *
 * Never imports NextRequest, NextResponse, or cookies.
 */

import { registerAction } from './registry';
import {
  findLeadMagnets,
  findLeadMagnetById,
  createLeadMagnet,
} from '@/server/repositories/lead-magnets.repo';
import { analyzeContextGaps, generateContent, generatePosts } from '@/lib/ai/copilot/lead-magnet-creation';
import type { ActionContext, ActionResult } from './types';
import type { LeadMagnetArchetype, LeadMagnetConcept } from '@/lib/types/lead-magnet';

// ─── Read Actions ─────────────────────────────────────────────

registerAction({
  name: 'list_lead_magnets',
  description:
    'List lead magnets for the current user. Returns title, status, archetype, and timestamps. Optionally filter by status.',
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
  handler: async (
    ctx: ActionContext,
    params: { status?: string; limit?: number }
  ): Promise<ActionResult> => {
    const { data, count } = await findLeadMagnets(ctx.scope, {
      status: params.status || null,
      limit: params.limit || 10,
      offset: 0,
    });

    return {
      success: true,
      data: data || [],
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'get_lead_magnet',
  description:
    'Get full details of a specific lead magnet by ID, including content blocks and extraction data.',
  parameters: {
    properties: {
      id: { type: 'string', description: 'The lead magnet ID' },
    },
    required: ['id'],
  },
  handler: async (ctx: ActionContext, params: { id: string }): Promise<ActionResult> => {
    const data = await findLeadMagnetById(ctx.scope, params.id);

    if (!data) {
      return { success: false, error: 'Lead magnet not found' };
    }

    return {
      success: true,
      data,
      displayHint: 'text',
    };
  },
});

// ─── Creation Actions ─────────────────────────────────────────

registerAction({
  name: 'start_lead_magnet_creation',
  description:
    'Start the lead magnet creation pipeline. Analyzes AI Brain context to determine which ' +
    'extraction questions still need answers. Present the returned questions conversationally — ' +
    'ask the user each one and collect their answers. Once all answers are gathered, call ' +
    'submit_extraction_answers with the answers object. If the user pasted content (article, ' +
    'transcript, notes), pass it as pasted_content so the Brain can pre-answer more questions.',
  parameters: {
    properties: {
      topic: {
        type: 'string',
        description: 'The topic or title for the lead magnet',
      },
      archetype: {
        type: 'string',
        description:
          'Lead magnet archetype (e.g. guide, single-breakdown, focused-toolkit). Defaults to guide.',
      },
      target_audience: {
        type: 'string',
        description: 'Target audience description (optional, enriches gap analysis)',
      },
      pasted_content: {
        type: 'string',
        description:
          'User-pasted content (article, transcript, notes) to pre-answer extraction questions',
      },
    },
    required: ['topic'],
  },
  handler: async (
    ctx: ActionContext,
    params: {
      topic: string;
      archetype?: string;
      target_audience?: string;
      pasted_content?: string;
    }
  ): Promise<ActionResult> => {
    const archetype = (params.archetype || 'single-system') as LeadMagnetArchetype;

    const concept: LeadMagnetConcept = {
      archetype,
      archetypeName: archetype,
      title: params.topic,
      painSolved: params.target_audience || params.topic,
      whyNowHook: '',
      deliveryFormat: 'PDF',
      contents: params.topic,
      viralCheck: {
        highValue: false,
        urgentPain: false,
        actionableUnder1h: false,
        simple: false,
        authorityBoosting: false,
      },
      creationTimeEstimate: '',
      bundlePotential: [],
    };

    const result = await analyzeContextGaps({
      userId: ctx.scope.userId,
      teamId: ctx.scope.teamId,
      archetype,
      concept,
      pastedContent: params.pasted_content,
    });

    return {
      success: true,
      data: {
        questions: result.questions,
        preAnsweredCount: result.preAnsweredCount,
        gapSummary: result.gapSummary,
        knowledgeContext: result.knowledgeContext,
        archetype,
        concept,
      },
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'submit_extraction_answers',
  description:
    'Submit collected extraction answers to generate lead magnet content. Call this after ' +
    'gathering answers from start_lead_magnet_creation questions. Returns the extracted content ' +
    'for review before saving.',
  parameters: {
    properties: {
      archetype: {
        type: 'string',
        description: 'Lead magnet archetype (must match the one from start_lead_magnet_creation)',
      },
      concept_title: {
        type: 'string',
        description: 'The lead magnet title/topic',
      },
      concept_pain: {
        type: 'string',
        description: 'The pain point or problem this lead magnet solves',
      },
      answers: {
        type: 'object',
        description:
          'Object mapping question IDs to user answers (e.g. { "q1": "answer text" })',
      },
    },
    required: ['archetype', 'answers'],
  },
  handler: async (
    ctx: ActionContext,
    params: {
      archetype: string;
      concept_title?: string;
      concept_pain?: string;
      answers: Record<string, string>;
    }
  ): Promise<ActionResult> => {
    const archetype = params.archetype as LeadMagnetArchetype;

    const concept: LeadMagnetConcept = {
      archetype,
      archetypeName: archetype,
      title: params.concept_title || 'Untitled Lead Magnet',
      painSolved: params.concept_pain || '',
      whyNowHook: '',
      deliveryFormat: 'PDF',
      contents: params.concept_title || 'Untitled Lead Magnet',
      viralCheck: {
        highValue: false,
        urgentPain: false,
        actionableUnder1h: false,
        simple: false,
        authorityBoosting: false,
      },
      creationTimeEstimate: '',
      bundlePotential: [],
    };

    const extractedContent = await generateContent(
      { archetype, concept, userId: ctx.scope.userId },
      params.answers
    );

    return {
      success: true,
      data: extractedContent,
      displayHint: 'content_review',
    };
  },
});

registerAction({
  name: 'save_lead_magnet',
  description:
    'Save a lead magnet to the database. Call after reviewing content from submit_extraction_answers. ' +
    'Creates a new lead magnet record with draft status.',
  parameters: {
    properties: {
      title: {
        type: 'string',
        description: 'Title for the lead magnet',
      },
      archetype: {
        type: 'string',
        description: 'Lead magnet archetype',
      },
      content_blocks: {
        type: 'object',
        description: 'The content blocks from submit_extraction_answers result',
      },
      extraction_data: {
        type: 'object',
        description: 'Optional extraction metadata to store alongside the lead magnet',
      },
    },
    required: ['title', 'archetype', 'content_blocks'],
  },
  requiresConfirmation: true,
  handler: async (
    ctx: ActionContext,
    params: {
      title: string;
      archetype: string;
      content_blocks: Record<string, unknown>;
      extraction_data?: Record<string, unknown>;
    }
  ): Promise<ActionResult> => {
    try {
      const data = await createLeadMagnet(
        ctx.scope.userId,
        ctx.scope.teamId ?? null,
        {
          title: params.title,
          archetype: params.archetype,
          status: 'draft',
          content_blocks: params.content_blocks,
          extraction_data: params.extraction_data || null,
        }
      );

      return {
        success: true,
        data,
        displayHint: 'text',
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to save lead magnet',
      };
    }
  },
});

registerAction({
  name: 'generate_lead_magnet_posts',
  description:
    'Generate LinkedIn post variations for an existing lead magnet. The lead magnet must have ' +
    'concept and extracted content already saved. Returns multiple post options for the user to choose from.',
  parameters: {
    properties: {
      lead_magnet_id: {
        type: 'string',
        description: 'The ID of the lead magnet to generate posts for',
      },
    },
    required: ['lead_magnet_id'],
  },
  handler: async (
    ctx: ActionContext,
    params: { lead_magnet_id: string }
  ): Promise<ActionResult> => {
    const result = await generatePosts(ctx.scope.userId, params.lead_magnet_id);

    return {
      success: true,
      data: result,
      displayHint: 'post_preview',
    };
  },
});
