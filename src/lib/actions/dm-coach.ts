/** DM Coach Actions.
 * Copilot actions for coaching DM replies and saving conversations.
 * Delegates all AI + persistence to dm-coach.service. Never imports AI SDK directly.
 * Never imports NextRequest, NextResponse, or cookies. */

import { registerAction } from './registry';
import * as dmCoachService from '@/server/services/dm-coach.service';
import { logError } from '@/lib/utils/logger';
import type { ActionContext, ActionResult } from './types';
import type { ConversationGoal, QualificationStage } from '@/lib/types/dm-coach';

// ─── Suggest ──────────────────────────────────────────────────────────────────

registerAction({
  name: 'dm_coach_suggest',
  description:
    'Get AI-coached reply suggestions for a LinkedIn DM conversation. Provide inline messages for one-off coaching, or a contact_id for an existing tracked conversation.',
  parameters: {
    properties: {
      contact_id: {
        type: 'string',
        description: 'Existing DM Coach contact ID for tracked conversation coaching',
      },
      messages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['them', 'me'], description: 'Who sent this message' },
            content: { type: 'string', description: 'Message text' },
          },
          required: ['role', 'content'],
        },
        description: 'Conversation messages for one-off coaching (if no contact_id)',
      },
      their_name: { type: 'string', description: 'Contact name (for one-off coaching)' },
      their_headline: { type: 'string', description: 'Contact headline (for one-off coaching)' },
      goal: {
        type: 'string',
        enum: [
          'book_meeting',
          'build_relationship',
          'promote_content',
          'explore_partnership',
          'nurture_lead',
          'close_deal',
        ],
        description: 'Conversation goal (default: book_meeting)',
      },
    },
  },
  handler: async (
    ctx: ActionContext,
    params: {
      contact_id?: string;
      messages?: Array<{ role: 'them' | 'me'; content: string }>;
      their_name?: string;
      their_headline?: string;
      goal?: ConversationGoal;
    }
  ): Promise<ActionResult> => {
    try {
      // ── Tracked contact path ────────────────────────────────────────────
      if (params.contact_id) {
        const suggestion = await dmCoachService.getSuggestion(ctx.scope.userId, params.contact_id);
        return {
          success: true,
          data: {
            suggestedResponse: suggestion.suggested_response,
            reasoning: suggestion.reasoning,
            stageBefore: suggestion.stage_before,
            stageAfter: suggestion.stage_after,
          },
          displayHint: 'dm_coach_suggestion',
        };
      }

      // ── One-off coaching path ───────────────────────────────────────────
      if (!params.messages || params.messages.length === 0) {
        return {
          success: false,
          error: 'Provide either a contact_id or messages for coaching.',
        };
      }

      const goal: ConversationGoal = params.goal || 'book_meeting';
      const parsed = await dmCoachService.generateCoaching({
        contactName: params.their_name || 'Contact',
        contactHeadline: params.their_headline || '',
        contactCompany: '',
        contactLocation: '',
        conversationHistory: params.messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: new Date().toISOString(),
        })),
        conversationGoal: goal,
        currentStage: 'unknown' as QualificationStage,
      });

      return {
        success: true,
        data: {
          suggestedResponse: parsed.suggestedResponse,
          reasoning: parsed.reasoning,
          stageBefore: parsed.qualificationStageBefore,
          stageAfter: parsed.qualificationStageAfter,
        },
        displayHint: 'dm_coach_suggestion',
      };
    } catch (err) {
      logError('dm-coach-action/suggest', err, { userId: ctx.scope.userId });
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to get suggestion',
      };
    }
  },
});

// ─── Save ─────────────────────────────────────────────────────────────────────

registerAction({
  name: 'dm_coach_save',
  description:
    'Save a DM conversation to the DM Coach as a tracked contact. Creates a new contact and adds messages.',
  parameters: {
    properties: {
      name: { type: 'string', description: 'Contact name (required)' },
      messages: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            role: { type: 'string', enum: ['them', 'me'] },
            content: { type: 'string' },
          },
          required: ['role', 'content'],
        },
        description: 'Conversation messages to save',
      },
      linkedin_url: { type: 'string', description: 'Contact LinkedIn URL' },
      headline: { type: 'string', description: 'Contact headline' },
      company: { type: 'string', description: 'Contact company' },
      goal: {
        type: 'string',
        enum: [
          'book_meeting',
          'build_relationship',
          'promote_content',
          'explore_partnership',
          'nurture_lead',
          'close_deal',
        ],
      },
    },
    required: ['name', 'messages'],
  },
  requiresConfirmation: true,
  handler: async (
    ctx: ActionContext,
    params: {
      name: string;
      messages: Array<{ role: 'them' | 'me'; content: string }>;
      linkedin_url?: string;
      headline?: string;
      company?: string;
      goal?: ConversationGoal;
    }
  ): Promise<ActionResult> => {
    try {
      // 1. Create contact
      const contact = await dmCoachService.createContact(
        ctx.scope.userId,
        ctx.scope.teamId ?? null,
        {
          name: params.name,
          linkedin_url: params.linkedin_url,
          headline: params.headline,
          company: params.company,
          conversation_goal: params.goal,
        }
      );

      // 2. Add messages
      const messages = await dmCoachService.addMessages(ctx.scope.userId, contact.id, {
        messages: params.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      });

      return {
        success: true,
        data: {
          contactId: contact.id,
          messagesAdded: messages.length,
        },
        displayHint: 'text',
      };
    } catch (err) {
      logError('dm-coach-action/save', err, { userId: ctx.scope.userId });
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to save conversation',
      };
    }
  },
});
