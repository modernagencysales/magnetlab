/** Program State Actions.
 *  Shared actions for the GTM Accelerator orchestrator and sub-agents.
 *  Called via executeAction() from the copilot chat route.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { registerAction } from './registry';
import {
  getProgramState,
  updateModuleStatus,
  createDeliverable,
  updateDeliverableStatus,
  getSopsByModule,
  updateEnrollmentIntake,
} from '@/lib/services/accelerator-program';
import { validateDeliverable } from '@/lib/services/accelerator-validation';
import { trackUsageEvent } from '@/lib/services/accelerator-usage';
import type {
  ModuleId,
  ModuleStatus,
  DeliverableType,
  DeliverableStatus,
} from '@/lib/types/accelerator';

// ─── Read Actions ────────────────────────────────────────

registerAction({
  name: 'get_program_state',
  description:
    "Get the user's complete program state: enrollment, module progress, deliverables, review queue, and usage.",
  parameters: { properties: {} },
  handler: async (ctx) => {
    const state = await getProgramState(ctx.userId);
    if (!state) return { success: false, error: 'No active enrollment found.' };
    return { success: true, data: state, displayHint: 'text' };
  },
});

registerAction({
  name: 'get_module_sops',
  description:
    'Load SOPs for a specific module with quality bars, deliverables, and tool requirements.',
  parameters: {
    properties: {
      module_id: {
        type: 'string',
        description: 'Module ID (m0, m1, m7)',
        enum: ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'],
      },
    },
    required: ['module_id'],
  },
  handler: async (_ctx, params: { module_id: ModuleId }) => {
    const sops = await getSopsByModule(params.module_id);
    if (sops.length === 0)
      return { success: false, error: `No SOPs found for module ${params.module_id}.` };
    return { success: true, data: sops, displayHint: 'text' };
  },
});

registerAction({
  name: 'get_review_queue',
  description: 'Get pending items from scheduled tasks or previous sessions awaiting user review.',
  parameters: { properties: {} },
  handler: async (ctx) => {
    const state = await getProgramState(ctx.userId);
    if (!state) return { success: false, error: 'No active enrollment found.' };
    return { success: true, data: state.reviewQueue, displayHint: 'text' };
  },
});

registerAction({
  name: 'get_next_recommendation',
  description:
    'Based on current progress, intake data, and deliverable status, recommend the best next action.',
  parameters: { properties: {} },
  handler: async (ctx) => {
    const state = await getProgramState(ctx.userId);
    if (!state) return { success: false, error: 'No active enrollment found.' };

    // Simple recommendation logic: find first non-completed selected module
    const nextModule = state.modules.find(
      (m) => m.status !== 'completed' && m.status !== 'skipped'
    );

    // Check for pending reviews first
    if (state.reviewQueue.length > 0) {
      return {
        success: true,
        data: {
          action: 'review_pending',
          message: `You have ${state.reviewQueue.length} item(s) waiting for your review.`,
          items: state.reviewQueue,
        },
        displayHint: 'text',
      };
    }

    if (!nextModule) {
      return {
        success: true,
        data: { action: 'all_complete', message: 'All selected modules are complete!' },
        displayHint: 'text',
      };
    }

    const sops = await getSopsByModule(nextModule.module_id as ModuleId);
    return {
      success: true,
      data: {
        action: 'continue_module',
        module: nextModule,
        current_step: nextModule.current_step,
        sop_count: sops.length,
        message: `Continue with ${nextModule.module_id}: ${nextModule.current_step || 'ready to start'}.`,
      },
      displayHint: 'text',
    };
  },
});

// ─── Write Actions ───────────────────────────────────────

registerAction({
  name: 'update_module_progress',
  description:
    "Update a module's status and current step. Use when starting, completing, or advancing through a module.",
  parameters: {
    properties: {
      module_id: { type: 'string', description: 'The program_modules row ID (UUID)' },
      status: {
        type: 'string',
        enum: ['not_started', 'active', 'blocked', 'completed', 'skipped'],
      },
      current_step: { type: 'string', description: 'Current SOP step identifier' },
    },
    required: ['module_id', 'status'],
  },
  handler: async (
    _ctx,
    params: { module_id: string; status: ModuleStatus; current_step?: string }
  ) => {
    const result = await updateModuleStatus(params.module_id, params.status, params.current_step);
    if (!result) return { success: false, error: 'Failed to update module status.' };
    return { success: true, data: result, displayHint: 'text' };
  },
});

registerAction({
  name: 'create_deliverable',
  description:
    'Register a new deliverable and optionally link to a MagnetLab entity (lead magnet, funnel, etc.).',
  parameters: {
    properties: {
      enrollment_id: { type: 'string', description: 'Enrollment UUID' },
      module_id: { type: 'string', enum: ['m0', 'm1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'] },
      deliverable_type: {
        type: 'string',
        enum: [
          'icp_definition',
          'lead_magnet',
          'funnel',
          'email_sequence',
          'content_plan',
          'post_drafts',
        ],
      },
      entity_id: { type: 'string', description: 'Optional linked entity UUID' },
      entity_type: {
        type: 'string',
        description: 'Optional entity type (lead_magnet, funnel_page, etc.)',
      },
    },
    required: ['enrollment_id', 'module_id', 'deliverable_type'],
  },
  handler: async (_ctx, params) => {
    const result = await createDeliverable({
      enrollment_id: params.enrollment_id,
      module_id: params.module_id as ModuleId,
      deliverable_type: params.deliverable_type as DeliverableType,
      entity_id: params.entity_id,
      entity_type: params.entity_type,
    });
    if (!result) return { success: false, error: 'Failed to create deliverable.' };

    await trackUsageEvent(params.enrollment_id, 'deliverable_created', {
      type: params.deliverable_type,
      module: params.module_id,
    });

    return { success: true, data: result, displayHint: 'deliverable_card' };
  },
});

registerAction({
  name: 'validate_deliverable',
  description:
    'Run quality checks against SOP criteria for a deliverable. Returns pass/fail with specific feedback.',
  parameters: {
    properties: {
      deliverable_id: { type: 'string', description: 'Deliverable UUID' },
      content: { type: 'string', description: 'The content to validate' },
      quality_bars: {
        type: 'array',
        description: 'Quality checks to run',
        items: {
          type: 'object',
          properties: {
            check: { type: 'string' },
            severity: { type: 'string', enum: ['critical', 'warning', 'info'] },
          },
        },
      },
    },
    required: ['deliverable_id', 'content', 'quality_bars'],
  },
  handler: async (
    _ctx,
    params: {
      deliverable_id: string;
      content: string;
      quality_bars: Array<{ check: string; severity: 'critical' | 'warning' | 'info' }>;
    }
  ) => {
    const result = await validateDeliverable(params.content, params.quality_bars);
    const status = result.passed ? 'approved' : 'rejected';

    await updateDeliverableStatus(params.deliverable_id, status as DeliverableStatus, result);

    return { success: true, data: result, displayHint: 'quality_check' };
  },
});

registerAction({
  name: 'save_intake_data',
  description: 'Save onboarding intake answers to the enrollment.',
  parameters: {
    properties: {
      enrollment_id: { type: 'string' },
      intake_data: {
        type: 'object',
        properties: {
          business_description: { type: 'string' },
          target_audience: { type: 'string' },
          revenue_range: { type: 'string', enum: ['under_5k', '5k_10k', '10k_20k'] },
          linkedin_frequency: {
            type: 'string',
            enum: ['never', 'occasionally', 'weekly', 'daily'],
          },
          channels_of_interest: { type: 'array', items: { type: 'string' } },
          primary_goal: { type: 'string' },
        },
      },
    },
    required: ['enrollment_id', 'intake_data'],
  },
  handler: async (_ctx, params) => {
    const success = await updateEnrollmentIntake(params.enrollment_id, params.intake_data);
    if (!success) return { success: false, error: 'Failed to save intake data.' };
    return { success: true, data: { saved: true }, displayHint: 'text' };
  },
});
