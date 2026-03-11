/** Schedule Actions.
 *  Actions for agents to manage recurring automation schedules.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { registerAction } from './registry';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import {
  getSchedulesByEnrollment,
  createSchedule,
  toggleSchedule,
} from '@/lib/services/accelerator-scheduler';
import type { ScheduleTaskType } from '@/lib/types/accelerator';

// ─── Read Actions ────────────────────────────────────────

registerAction({
  name: 'list_schedules',
  description:
    'List all active and inactive automation schedules — metrics collection, weekly digest, warmup checks, etc.',
  parameters: { properties: {} },
  handler: async (ctx) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const schedules = await getSchedulesByEnrollment(enrollment.id);
    return { success: true, data: { schedules }, displayHint: 'task_board' };
  },
});

// ─── Write Actions ───────────────────────────────────────

registerAction({
  name: 'create_schedule',
  description:
    'Create a new recurring schedule. Use standard cron format (min hour dom month dow).',
  parameters: {
    properties: {
      task_type: {
        type: 'string',
        enum: [
          'collect_metrics',
          'weekly_digest',
          'warmup_check',
          'tam_decay_check',
          'morning_briefing',
        ],
      },
      cron_expression: {
        type: 'string',
        description: 'Standard 5-field cron expression, e.g. "0 9 * * 1" for Monday 9AM UTC',
      },
      config: {
        type: 'object',
        description: 'Optional task-specific config',
      },
    },
    required: ['task_type', 'cron_expression'],
  },
  handler: async (
    ctx,
    params: {
      task_type: ScheduleTaskType;
      cron_expression: string;
      config?: Record<string, unknown>;
    }
  ) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const schedule = await createSchedule(
      enrollment.id,
      params.task_type,
      params.cron_expression,
      params.config || {},
      false
    );
    if (!schedule) return { success: false, error: 'Failed to create schedule.' };
    return { success: true, data: schedule, displayHint: 'text' };
  },
});

registerAction({
  name: 'toggle_schedule',
  description: 'Enable or disable an automation schedule.',
  parameters: {
    properties: {
      schedule_id: { type: 'string', description: 'Schedule UUID' },
      is_active: { type: 'boolean', description: 'true to enable, false to disable' },
    },
    required: ['schedule_id', 'is_active'],
  },
  handler: async (ctx, params: { schedule_id: string; is_active: boolean }) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const schedules = await getSchedulesByEnrollment(enrollment.id);
    const ownsSchedule = schedules.some((s) => s.id === params.schedule_id);
    if (!ownsSchedule) return { success: false, error: 'Schedule not found.' };

    const success = await toggleSchedule(params.schedule_id, params.is_active);
    if (!success) return { success: false, error: 'Failed to update schedule.' };
    return { success: true, data: { toggled: true }, displayHint: 'text' };
  },
});
