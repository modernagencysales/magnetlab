import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

/**
 * Update template engagement scores. Runs nightly after engagement scraping.
 * Aggregates post engagement data back to cp_post_templates.avg_engagement_score
 * with exponential recency decay (90-day window).
 *
 * Formula: AVG(engagement_count * EXP(-0.1 * days_since_post))
 * - Posts from today weight ~1x, 7 days ago ~0.5x, 30 days ago ~0.05x
 * - NULL avg_engagement_score is left as-is for templates with no data
 */
export const updateTemplateScores = schedules.task({
  id: 'update-template-scores',
  cron: '0 3 * * *', // 3 AM UTC — after engagement scraping (scrape-engagement runs at 2 AM)
  maxDuration: 120,
  run: async () => {
    const supabase = createSupabaseAdminClient();
    const windowStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    logger.info('Starting template score update', { windowStart });

    // ─── 1. Fetch posts with engagement counts (90-day window) ────────────────
    const { data: postsWithEngagement, error: fetchError } = await supabase
      .from('cp_pipeline_posts')
      .select(
        'template_id, created_at, cp_post_engagements(id)'
      )
      .not('template_id', 'is', null)
      .gte('created_at', windowStart);

    if (fetchError) {
      logError('update-template-scores:fetch', fetchError);
      throw new Error(`Failed to fetch posts: ${fetchError.message}`);
    }

    if (!postsWithEngagement || postsWithEngagement.length === 0) {
      logger.info('No posts with template assignments found in 90-day window');
      return { updated: 0, total: 0, skipped: true };
    }

    logger.info('Fetched posts for scoring', { count: postsWithEngagement.length });

    // ─── 2. Compute exponentially decayed score per template ─────────────────
    // Score = weighted average where weight = EXP(-0.1 * days_since_post)
    // This mirrors the SQL: AVG(e.engagement_count * EXP(-0.1 * EXTRACT(EPOCH FROM NOW() - p.created_at) / 86400))
    const scoreMap = new Map<string, { weightedSum: number; weightTotal: number }>();

    for (const post of postsWithEngagement) {
      const templateId = post.template_id as string;
      const engagementCount = Array.isArray(post.cp_post_engagements)
        ? post.cp_post_engagements.length
        : 0;
      const daysSincePost =
        (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const weight = Math.exp(-0.1 * daysSincePost);

      const existing = scoreMap.get(templateId) ?? { weightedSum: 0, weightTotal: 0 };
      existing.weightedSum += engagementCount * weight;
      existing.weightTotal += weight;
      scoreMap.set(templateId, existing);
    }

    logger.info('Computed scores for templates', { templateCount: scoreMap.size });

    // ─── 3. Update each template's avg_engagement_score ──────────────────────
    let updated = 0;
    const updateErrors: string[] = [];

    for (const [templateId, { weightedSum, weightTotal }] of scoreMap) {
      const score = weightTotal > 0 ? weightedSum / weightTotal : 0;

      const { error: updateError } = await supabase
        .from('cp_post_templates')
        .update({ avg_engagement_score: score })
        .eq('id', templateId);

      if (updateError) {
        logError('update-template-scores:update', updateError, { templateId });
        updateErrors.push(`template ${templateId}: ${updateError.message}`);
      } else {
        updated++;
      }
    }

    const summary = {
      updated,
      total: scoreMap.size,
      errors: updateErrors.length,
    };

    if (updateErrors.length > 0) {
      logger.warn('Some template score updates failed', {
        ...summary,
        firstError: updateErrors[0],
      });
    } else {
      logger.info('Template score update complete', summary);
    }

    return summary;
  },
});
