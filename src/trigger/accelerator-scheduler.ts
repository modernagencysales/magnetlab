/** Accelerator Scheduler.
 *  Polls program_schedules every 15 minutes and dispatches due tasks.
 *  Each task type maps to a specific Trigger.dev task or inline handler. */

import { schedules, logger, tasks } from '@trigger.dev/sdk/v3';
import { getDueSchedules, markScheduleRun } from '@/lib/services/accelerator-scheduler';

// Type imports for task payload validation — uncomment when tasks are created:
// import type { acceleratorCollectMetrics } from './accelerator-collect-metrics';
// import type { acceleratorDigest } from './accelerator-digest';

export const acceleratorScheduler = schedules.task({
  id: 'accelerator-scheduler',
  cron: '*/15 * * * *', // Every 15 minutes
  maxDuration: 120,
  run: async () => {
    logger.info('Accelerator scheduler: checking for due tasks');

    const dueSchedules = await getDueSchedules();

    if (dueSchedules.length === 0) {
      logger.info('No due schedules');
      return { processed: 0 };
    }

    logger.info('Processing due schedules', { count: dueSchedules.length });

    let processed = 0;
    let errors = 0;

    for (const schedule of dueSchedules) {
      try {
        switch (schedule.task_type) {
          case 'collect_metrics':
            await tasks.trigger('accelerator-collect-metrics', {
              enrollmentId: schedule.enrollment_id,
              config: schedule.config,
            });
            break;

          case 'weekly_digest':
            await tasks.trigger('accelerator-digest', {
              enrollmentId: schedule.enrollment_id,
              config: schedule.config,
            });
            break;

          case 'warmup_check':
            await tasks.trigger('accelerator-collect-metrics', {
              enrollmentId: schedule.enrollment_id,
              config: { ...schedule.config, metricsOnly: ['email_warmup'] },
            });
            break;

          case 'tam_decay_check':
          case 'morning_briefing':
            // These task types are handled by metrics collection
            // Morning briefing data is generated on-demand via chat action
            logger.info('Skipping task type (handled elsewhere)', { taskType: schedule.task_type });
            break;

          default:
            logger.warn('Unknown task type', { taskType: schedule.task_type });
        }

        await markScheduleRun(schedule.id, schedule.cron_expression);
        processed++;
      } catch (err) {
        errors++;
        logger.error('Failed to process schedule', {
          scheduleId: schedule.id,
          taskType: schedule.task_type,
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    return { processed, errors, total: dueSchedules.length };
  },
});
