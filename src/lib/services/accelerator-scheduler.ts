/** Accelerator Scheduler Service.
 *  CRUD for program_schedules. Computes next run times from cron expressions.
 *  Uses a simple cron parser (no external dependency).
 *  Never imports NextRequest, NextResponse, or cookies. */

import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import type { ProgramSchedule, ScheduleTaskType } from '@/lib/types/accelerator';
import { SCHEDULE_COLUMNS } from '@/lib/types/accelerator';

const LOG_CTX = 'accelerator-scheduler';

// ─── Cron Helpers ────────────────────────────────────────

/** Simple cron next-run calculator. Supports standard 5-field cron (min hour dom month dow). */
export function computeNextRun(cronExpression: string, from: Date = new Date()): Date {
  const [minStr, hourStr, , , dowStr] = cronExpression.split(' ');
  const minute = parseInt(minStr, 10);
  const hour = parseInt(hourStr, 10);
  const targetDow = dowStr === '*' ? null : parseInt(dowStr, 10);

  const next = new Date(from);
  next.setUTCSeconds(0, 0);

  // Start from next minute
  next.setUTCMinutes(next.getUTCMinutes() + 1);

  // Set target hour and minute
  next.setUTCHours(hour, minute, 0, 0);

  // If we're past that time today, go to tomorrow
  if (next <= from) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  // If specific day-of-week, advance to it
  if (targetDow !== null) {
    while (next.getUTCDay() !== targetDow) {
      next.setUTCDate(next.getUTCDate() + 1);
    }
  }

  return next;
}

// ─── Read ───────────────────────────────────────────────

export async function getDueSchedules(): Promise<ProgramSchedule[]> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('program_schedules')
    .select(SCHEDULE_COLUMNS)
    .eq('is_active', true)
    .lte('next_run_at', now)
    .order('next_run_at', { ascending: true });

  if (error) {
    logError(LOG_CTX, error, { context: 'getDueSchedules' });
    return [];
  }
  return data || [];
}

export async function getSchedulesByEnrollment(enrollmentId: string): Promise<ProgramSchedule[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('program_schedules')
    .select(SCHEDULE_COLUMNS)
    .eq('enrollment_id', enrollmentId)
    .order('task_type');

  if (error) {
    logError(LOG_CTX, error, { enrollmentId });
    return [];
  }
  return data || [];
}

// ─── Write ──────────────────────────────────────────────

export async function createSchedule(
  enrollmentId: string,
  taskType: ScheduleTaskType,
  cronExpression: string,
  config: Record<string, unknown> = {},
  isSystem: boolean = false
): Promise<ProgramSchedule | null> {
  const supabase = getSupabaseAdminClient();
  const nextRunAt = computeNextRun(cronExpression);

  const { data, error } = await supabase
    .from('program_schedules')
    .insert({
      enrollment_id: enrollmentId,
      task_type: taskType,
      cron_expression: cronExpression,
      config,
      is_system: isSystem,
      next_run_at: nextRunAt.toISOString(),
    })
    .select(SCHEDULE_COLUMNS)
    .single();

  if (error) {
    logError(LOG_CTX, error, { enrollmentId, taskType });
    return null;
  }
  return data;
}

export async function markScheduleRun(scheduleId: string, cronExpression: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const now = new Date();
  const nextRunAt = computeNextRun(cronExpression, now);

  const { error } = await supabase
    .from('program_schedules')
    .update({
      last_run_at: now.toISOString(),
      next_run_at: nextRunAt.toISOString(),
    })
    .eq('id', scheduleId);

  if (error) {
    logError(LOG_CTX, error, { scheduleId });
  }
}

export async function toggleSchedule(scheduleId: string, isActive: boolean): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from('program_schedules')
    .update({ is_active: isActive })
    .eq('id', scheduleId);

  if (error) {
    logError(LOG_CTX, error, { scheduleId, isActive });
    return false;
  }
  return true;
}

// ─── System Schedule Initialization ──────────────────────

/** Create default system schedules for a new enrollment. */
export async function initializeSystemSchedules(enrollmentId: string): Promise<void> {
  const defaults: Array<{ taskType: ScheduleTaskType; cron: string }> = [
    { taskType: 'collect_metrics', cron: '0 6 * * *' },
    { taskType: 'weekly_digest', cron: '0 9 * * 1' },
    { taskType: 'warmup_check', cron: '0 7 * * *' },
  ];

  for (const { taskType, cron } of defaults) {
    await createSchedule(enrollmentId, taskType, cron, {}, true);
  }
}
