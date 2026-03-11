/** Accelerator Metrics Collection.
 *  Collects performance metrics from configured providers and MagnetLab internal data.
 *  Triggered by the accelerator-scheduler or on-demand. */

import { task, logger } from '@trigger.dev/sdk/v3';
import { getSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { recordMetrics, type MetricInput } from '@/lib/services/accelerator-metrics';
import { resolveProvider } from '@/lib/providers/registry';
import type { EmailCampaignStats, DmCampaignStats } from '@/lib/providers/types';

interface CollectMetricsPayload {
  enrollmentId: string;
  config: Record<string, unknown>;
}

export const acceleratorCollectMetrics = task({
  id: 'accelerator-collect-metrics',
  maxDuration: 120,
  retry: { maxAttempts: 2 },
  run: async (payload: CollectMetricsPayload) => {
    const { enrollmentId, config: _config } = payload;
    logger.info('Collecting metrics', { enrollmentId });

    const supabase = getSupabaseAdminClient();

    // Get enrollment to find user_id
    const { data: enrollment } = await supabase
      .from('program_enrollments')
      .select('id, user_id, selected_modules')
      .eq('id', enrollmentId)
      .single();

    if (!enrollment) {
      logger.error('Enrollment not found', { enrollmentId });
      return { collected: 0 };
    }

    const metrics: MetricInput[] = [];

    // ─── Email Outreach Metrics (M4) ────────────────────
    if (enrollment.selected_modules.includes('m4')) {
      try {
        const emailProvider = await resolveProvider(enrollment.user_id, 'email_outreach');
        if (emailProvider && 'getCampaignStats' in emailProvider) {
          const campaigns = await emailProvider.listCampaigns();
          for (const campaign of campaigns.slice(0, 3)) {
            const stats = (await emailProvider.getCampaignStats(campaign.id)) as EmailCampaignStats;
            if (stats.sent > 0) {
              metrics.push(
                {
                  module_id: 'm4',
                  metric_key: 'email_sent',
                  value: stats.sent,
                  source: 'plusvibe',
                },
                {
                  module_id: 'm4',
                  metric_key: 'email_open_rate',
                  value: stats.sent > 0 ? (stats.opened / stats.sent) * 100 : 0,
                  source: 'plusvibe',
                },
                {
                  module_id: 'm4',
                  metric_key: 'email_reply_rate',
                  value: stats.sent > 0 ? (stats.replied / stats.sent) * 100 : 0,
                  source: 'plusvibe',
                },
                {
                  module_id: 'm4',
                  metric_key: 'email_bounce_rate',
                  value: stats.sent > 0 ? (stats.bounced / stats.sent) * 100 : 0,
                  source: 'plusvibe',
                }
              );
            }
          }
        }
      } catch (err) {
        logger.error('Failed to collect email metrics', {
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    // ─── DM Outreach Metrics (M3) ───────────────────────
    if (enrollment.selected_modules.includes('m3')) {
      try {
        const dmProvider = await resolveProvider(enrollment.user_id, 'dm_outreach');
        if (dmProvider && 'getCampaignStats' in dmProvider) {
          const campaigns = await dmProvider.listCampaigns();
          for (const campaign of campaigns.slice(0, 3)) {
            const rawStats = await dmProvider.getCampaignStats(campaign.id);
            const stats: DmCampaignStats = rawStats as DmCampaignStats;
            metrics.push(
              { module_id: 'm3', metric_key: 'dm_sent', value: stats.sent, source: 'heyreach' },
              {
                module_id: 'm3',
                metric_key: 'dm_acceptance_rate',
                value: stats.sent > 0 ? (stats.accepted / stats.sent) * 100 : 0,
                source: 'heyreach',
              },
              {
                module_id: 'm3',
                metric_key: 'dm_reply_rate',
                value: stats.sent > 0 ? (stats.replied / stats.sent) * 100 : 0,
                source: 'heyreach',
              }
            );
          }
        }
      } catch (err) {
        logger.error('Failed to collect DM metrics', {
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    // ─── Content Metrics (M7) ───────────────────────────
    if (enrollment.selected_modules.includes('m7')) {
      try {
        const { data: posts } = await supabase
          .from('cp_pipeline_posts')
          .select('engagement_stats, published_at')
          .eq('user_id', enrollment.user_id)
          .not('published_at', 'is', null)
          .gte('published_at', new Date(Date.now() - 30 * 86400000).toISOString())
          .order('published_at', { ascending: false });

        if (posts && posts.length > 0) {
          metrics.push({
            module_id: 'm7',
            metric_key: 'content_posts_published',
            value: posts.length,
            source: 'magnetlab',
          });

          const withStats = posts.filter((p: Record<string, unknown>) => p.engagement_stats);
          if (withStats.length > 0) {
            const avgImpressions =
              withStats.reduce(
                (sum: number, p: Record<string, unknown>) =>
                  sum + ((p.engagement_stats as Record<string, number>)?.impressions || 0),
                0
              ) / withStats.length;
            metrics.push({
              module_id: 'm7',
              metric_key: 'content_avg_impressions',
              value: Math.round(avgImpressions),
              source: 'magnetlab',
            });
          }
        }
      } catch (err) {
        logger.error('Failed to collect content metrics', {
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    // ─── Funnel Metrics (M1) ────────────────────────────
    if (enrollment.selected_modules.includes('m1')) {
      try {
        const { data: funnels } = await supabase
          .from('funnel_pages')
          .select('id, views, conversions')
          .eq('user_id', enrollment.user_id)
          .not('published_at', 'is', null);

        if (funnels && funnels.length > 0) {
          const totalViews = funnels.reduce(
            (sum: number, f: Record<string, number>) => sum + (f.views || 0),
            0
          );
          const totalConversions = funnels.reduce(
            (sum: number, f: Record<string, number>) => sum + (f.conversions || 0),
            0
          );

          metrics.push(
            {
              module_id: 'm1',
              metric_key: 'funnel_page_views',
              value: totalViews,
              source: 'magnetlab',
            },
            {
              module_id: 'm1',
              metric_key: 'funnel_opt_in_rate',
              value: totalViews > 0 ? (totalConversions / totalViews) * 100 : 0,
              source: 'magnetlab',
            }
          );
        }
      } catch (err) {
        logger.error('Failed to collect funnel metrics', {
          error: err instanceof Error ? err.message : 'Unknown',
        });
      }
    }

    // ─── Record All Collected Metrics ───────────────────
    if (metrics.length > 0) {
      await recordMetrics(enrollmentId, metrics);
    }

    logger.info('Metrics collection complete', { enrollmentId, collected: metrics.length });
    return { collected: metrics.length };
  },
});
