/** Metrics Actions.
 *  Actions for agents to query performance metrics, trends, and summaries.
 *  Never imports NextRequest, NextResponse, or cookies. */

import { registerAction } from './registry';
import { getEnrollmentByUserId } from '@/lib/services/accelerator-program';
import {
  getLatestMetrics,
  getMetricsSummary,
  getMetricHistory,
} from '@/lib/services/accelerator-metrics';
import type { MetricKey } from '@/lib/types/accelerator';

// ─── Read Actions ────────────────────────────────────────

registerAction({
  name: 'get_metrics',
  description:
    'Get the latest performance metrics across all modules — email stats, DM stats, TAM size, content engagement, funnel conversion.',
  parameters: { properties: {} },
  handler: async (ctx) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const metrics = await getLatestMetrics(enrollment.id);
    return { success: true, data: { metrics }, displayHint: 'metrics_card' };
  },
});

registerAction({
  name: 'get_metrics_summary',
  description:
    'Get a high-level metrics summary grouped by module with below-benchmark counts. Good for quick health checks.',
  parameters: { properties: {} },
  handler: async (ctx) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const summary = await getMetricsSummary(enrollment.id);
    return { success: true, data: summary, displayHint: 'metrics_card' };
  },
});

registerAction({
  name: 'get_metric_history',
  description:
    'Get historical trend data for a specific metric over time. Use for spotting improvements or regressions.',
  parameters: {
    properties: {
      metric_key: {
        type: 'string',
        enum: [
          'email_sent',
          'email_open_rate',
          'email_reply_rate',
          'email_bounce_rate',
          'dm_sent',
          'dm_acceptance_rate',
          'dm_reply_rate',
          'tam_size',
          'tam_email_coverage',
          'content_posts_published',
          'content_avg_impressions',
          'content_avg_engagement',
          'funnel_opt_in_rate',
          'funnel_page_views',
        ],
      },
      days: { type: 'number', description: 'Lookback period in days (default 30)' },
    },
    required: ['metric_key'],
  },
  handler: async (ctx, params: { metric_key: MetricKey; days?: number }) => {
    const enrollment = await getEnrollmentByUserId(ctx.userId);
    if (!enrollment) return { success: false, error: 'No active enrollment found.' };

    const history = await getMetricHistory(enrollment.id, params.metric_key, params.days || 30);
    return {
      success: true,
      data: { metric_key: params.metric_key, history },
      displayHint: 'metrics_card',
    };
  },
});
