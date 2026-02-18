import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// --- Statistical helpers ---

/** Standard normal CDF using Abramowitz & Stegun approximation (formula 26.2.17) */
function normalCDF(x: number): number {
  if (x < -8) return 0;
  if (x > 8) return 1;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

/**
 * Two-proportion z-test.
 * n1, n2 = total observations per group; x1, x2 = successes per group.
 * Returns z-score and two-tailed p-value.
 */
function zTestTwoProportions(
  n1: number,
  x1: number,
  n2: number,
  x2: number,
): { zScore: number; pValue: number } {
  const p1 = x1 / n1;
  const p2 = x2 / n2;
  const pPool = (x1 + x2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));

  if (se === 0) return { zScore: 0, pValue: 1 };

  const zScore = (p1 - p2) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

  return { zScore, pValue };
}

// --- Field mapping: test_field value -> funnel_pages column ---
const FIELD_COLUMN_MAP: Record<string, string> = {
  headline: 'thankyou_headline',
  subline: 'thankyou_subline',
  vsl_url: 'vsl_url',
  pass_message: 'qualification_pass_message',
};

export const checkAbExperiments = schedules.task({
  id: 'check-ab-experiments',
  cron: '0 */6 * * *', // every 6 hours
  maxDuration: 300,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    logger.info('Starting A/B experiment check');

    // Fetch all running experiments
    const { data: experiments, error: expError } = await supabase
      .from('ab_experiments')
      .select('id, funnel_page_id, test_field, min_sample_size')
      .eq('status', 'running');

    if (expError) {
      logger.error('Failed to fetch experiments', { error: expError.message });
      return { checked: 0, completed: 0 };
    }

    if (!experiments || experiments.length === 0) {
      logger.info('No running experiments');
      return { checked: 0, completed: 0 };
    }

    logger.info('Found running experiments', { count: experiments.length });

    let completed = 0;

    for (const experiment of experiments) {
      try {
        // Get all variant funnel_page_ids (control + variants)
        const { data: variantPages } = await supabase
          .from('funnel_pages')
          .select('id, is_variant')
          .or(`id.eq.${experiment.funnel_page_id},experiment_id.eq.${experiment.id}`)
          .eq('is_published', true);

        if (!variantPages || variantPages.length < 2) {
          logger.info('Experiment has fewer than 2 published variants, skipping', {
            experimentId: experiment.id,
            variantCount: variantPages?.length ?? 0,
          });
          continue;
        }

        const variantIds = variantPages.map((v) => v.id);

        // Count page_views per variant (thankyou page type)
        const { data: viewCounts } = await supabase
          .from('page_views')
          .select('funnel_page_id')
          .in('funnel_page_id', variantIds)
          .eq('page_type', 'thankyou');

        // Count funnel_leads with qualification_answers IS NOT NULL per variant
        const { data: leadCounts } = await supabase
          .from('funnel_leads')
          .select('funnel_page_id, qualification_answers')
          .in('funnel_page_id', variantIds)
          .not('qualification_answers', 'is', null);

        // Aggregate counts per variant
        const stats: Record<string, { views: number; completions: number; isVariant: boolean }> = {};
        for (const vp of variantPages) {
          stats[vp.id] = { views: 0, completions: 0, isVariant: vp.is_variant };
        }

        for (const v of viewCounts || []) {
          if (stats[v.funnel_page_id]) {
            stats[v.funnel_page_id].views++;
          }
        }

        for (const l of leadCounts || []) {
          if (stats[l.funnel_page_id]) {
            stats[l.funnel_page_id].completions++;
          }
        }

        logger.info('Experiment stats', {
          experimentId: experiment.id,
          stats: Object.entries(stats).map(([id, s]) => ({
            id,
            views: s.views,
            completions: s.completions,
            rate: s.views > 0 ? (s.completions / s.views).toFixed(4) : '0',
            isVariant: s.isVariant,
          })),
        });

        // Check if all variants meet minimum sample size
        const minSample = experiment.min_sample_size || 100;
        const belowMin = Object.entries(stats).filter(([, s]) => s.views < minSample);
        if (belowMin.length > 0) {
          logger.info('Not enough data yet', {
            experimentId: experiment.id,
            minSample,
            belowMin: belowMin.map(([id, s]) => ({ id, views: s.views })),
          });
          continue;
        }

        // Sort variants by completion rate (descending)
        const sorted = Object.entries(stats)
          .map(([id, s]) => ({
            id,
            ...s,
            rate: s.views > 0 ? s.completions / s.views : 0,
          }))
          .sort((a, b) => b.rate - a.rate);

        const best = sorted[0];
        const secondBest = sorted[1];

        // Two-proportion z-test between best and second-best
        const { pValue } = zTestTwoProportions(
          best.views,
          best.completions,
          secondBest.views,
          secondBest.completions,
        );

        logger.info('Statistical test result', {
          experimentId: experiment.id,
          bestId: best.id,
          bestRate: best.rate.toFixed(4),
          secondBestId: secondBest.id,
          secondBestRate: secondBest.rate.toFixed(4),
          pValue: pValue.toFixed(6),
        });

        if (pValue >= 0.05) {
          logger.info('Not yet significant', { experimentId: experiment.id, pValue });
          continue;
        }

        // Winner declared!
        const winnerId = best.id;
        const significance = pValue;
        const controlId = experiment.funnel_page_id;

        logger.info('Winner declared', {
          experimentId: experiment.id,
          winnerId,
          significance,
          isVariant: best.isVariant,
        });

        // If winner is not the control, copy winning field value to control
        if (winnerId !== controlId) {
          const column = FIELD_COLUMN_MAP[experiment.test_field];
          if (column) {
            // Fetch the winning variant's value
            const { data: winnerRow } = await supabase
              .from('funnel_pages')
              .select(column)
              .eq('id', winnerId)
              .single();

            if (winnerRow) {
              const winningValue = (winnerRow as unknown as Record<string, unknown>)[column];
              await supabase
                .from('funnel_pages')
                .update({ [column]: winningValue })
                .eq('id', controlId);

              logger.info('Copied winning value to control', {
                experimentId: experiment.id,
                column,
                controlId,
                winnerId,
              });
            }
          }
        }

        // Mark experiment as completed
        await supabase
          .from('ab_experiments')
          .update({
            status: 'completed',
            winner_id: winnerId,
            significance,
            completed_at: new Date().toISOString(),
          })
          .eq('id', experiment.id);

        // Unpublish variant rows and clear experiment_id links
        const variantRowIds = variantPages
          .filter((v) => v.is_variant && v.id !== controlId)
          .map((v) => v.id);

        if (variantRowIds.length > 0) {
          await supabase
            .from('funnel_pages')
            .update({ is_published: false, experiment_id: null })
            .in('id', variantRowIds);

          logger.info('Unpublished variant rows', {
            experimentId: experiment.id,
            variantIds: variantRowIds,
          });
        }

        // Clear control's experiment_id
        await supabase
          .from('funnel_pages')
          .update({ experiment_id: null })
          .eq('id', controlId);

        completed++;
      } catch (err) {
        logger.error('Error processing experiment', {
          experimentId: experiment.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('A/B experiment check complete', {
      checked: experiments.length,
      completed,
    });

    return { checked: experiments.length, completed };
  },
});
