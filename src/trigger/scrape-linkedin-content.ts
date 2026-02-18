import { schedules, logger, tasks } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  isBrightDataConfigured,
  scrapeCreatorPostsBatch,
  computeEngagementScore,
  filterWinners,
  type LinkedInPost,
} from '@/lib/integrations/bright-data-linkedin';

/**
 * How many creators to scrape per daily run.
 * With ~480 creators and 70/day, each creator gets scraped roughly weekly.
 * Bright Data charges per record, so this keeps costs predictable.
 */
const DAILY_BATCH_SIZE = 70;

export const scrapeLinkedinContent = schedules.task({
  id: 'scrape-linkedin-content',
  cron: '0 4 * * *', // 4 AM UTC daily
  maxDuration: 600,
  retry: { maxAttempts: 1 },
  run: async () => {
    const runStartedAt = new Date().toISOString();

    if (!isBrightDataConfigured()) {
      logger.warn('Bright Data not configured, skipping scrape');
      return { skipped: true, reason: 'BRIGHT_DATA_API_KEY not set' };
    }

    const supabase = createSupabaseAdminClient();

    // ─── 1. Pick creators to scrape (oldest-scraped first) ───────────────────
    const { data: creators, error: creatorsError } = await supabase
      .from('cp_tracked_creators')
      .select('id, linkedin_url, name')
      .eq('is_active', true)
      .order('last_scraped_at', { ascending: true, nullsFirst: true })
      .limit(DAILY_BATCH_SIZE);

    if (creatorsError) {
      logger.error('Failed to fetch tracked creators', { error: creatorsError.message });
      throw new Error(`Failed to fetch creators: ${creatorsError.message}`);
    }

    if (!creators || creators.length === 0) {
      logger.info('No active creators to scrape');
      return { skipped: true, reason: 'No active creators' };
    }

    logger.info('Scrape batch selected', {
      batchSize: creators.length,
      dailyLimit: DAILY_BATCH_SIZE,
    });

    let totalPostsSaved = 0;
    let totalNewPosts = 0;
    let totalWinners = 0;
    const errors: string[] = [];

    // ─── 2. Batch scrape creator posts via Bright Data ───────────────────────
    let allCreatorPosts: LinkedInPost[] = [];
    const profileUrls = creators.map((c) => c.linkedin_url);

    try {
      allCreatorPosts = await scrapeCreatorPostsBatch(profileUrls);
      logger.info('Batch scrape complete', { postCount: allCreatorPosts.length });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      logger.error('Batch scrape failed', { error: msg });
      errors.push(`Batch scrape: ${msg}`);
    }

    // ─── 3. Group posts by creator and upsert ────────────────────────────────
    if (allCreatorPosts.length > 0) {
      const creatorByUrl = new Map<string, (typeof creators)[0]>();
      for (const creator of creators) {
        creatorByUrl.set(normalizeUrl(creator.linkedin_url), creator);
      }

      const postsByCreator = new Map<string, LinkedInPost[]>();
      for (const post of allCreatorPosts) {
        const key = normalizeUrl(post.author.profile_url);
        const arr = postsByCreator.get(key) || [];
        arr.push(post);
        postsByCreator.set(key, arr);
      }

      for (const [normalizedUrl, posts] of postsByCreator) {
        const creator = creatorByUrl.get(normalizedUrl);
        if (!creator) {
          logger.warn('Unmatched posts', { authorUrl: normalizedUrl, count: posts.length });
          continue;
        }

        const winners = filterWinners(posts, { minLikes: 100, topPercentile: 30 });
        const winnerUrls = new Set(winners.map((w) => w.url));

        const postRows = posts.map((post) => ({
          bright_data_id: post.url,
          user_id: null,
          author_name: post.author.name,
          author_headline: post.author.headline,
          author_url: post.author.profile_url,
          content: post.content,
          likes: post.engagement.likes,
          comments: post.engagement.comments,
          shares: post.engagement.shares,
          engagement_score: computeEngagementScore(post),
          creator_id: creator.id,
          source_search_id: null,
          is_winner: winnerUrls.has(post.url),
        }));

        // Upsert — dupes (same bright_data_id) get updated with latest engagement
        if (postRows.length > 0) {
          const { data: upsertedRows, error: upsertError } = await supabase
            .from('cp_viral_posts')
            .upsert(postRows, { onConflict: 'bright_data_id', count: 'exact' })
            .select('id');

          if (upsertError) {
            logger.error('Upsert failed', { creator: creator.name, error: upsertError.message });
            errors.push(`Upsert ${creator.name}: ${upsertError.message}`);
          } else {
            totalPostsSaved += postRows.length;
            totalWinners += winners.length;
          }
        }

        // Update creator stats
        const avgEngagement =
          posts.reduce((sum, p) => sum + computeEngagementScore(p), 0) / posts.length;

        await supabase
          .from('cp_tracked_creators')
          .update({
            last_scraped_at: new Date().toISOString(),
            avg_engagement: Math.round(avgEngagement),
            post_count: posts.length,
          })
          .eq('id', creator.id);
      }
    }

    // ─── 4. Log the scrape run ───────────────────────────────────────────────
    await supabase.from('cp_pipeline_scrape_runs').insert({
      run_type: 'creator',
      started_at: runStartedAt,
      completed_at: new Date().toISOString(),
      posts_found: totalPostsSaved,
      winners_found: totalWinners,
      error_log: errors.length > 0 ? errors.join('; ') : null,
    });

    // ─── 5. Trigger template extraction if new winners found ─────────────────
    if (totalWinners > 0) {
      try {
        await tasks.trigger('extract-winning-templates', {});
        logger.info('Triggered extract-winning-templates', { winnersCount: totalWinners });
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.warn('extract-winning-templates trigger failed', { error: msg });
      }
    }

    const summary = {
      creatorsScraped: creators.length,
      totalPostsSaved,
      totalWinners,
      errors: errors.length,
      errorMessages: errors.slice(0, 5),
    };

    logger.info('Scrape run complete', summary);
    return summary;
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeUrl(url: string): string {
  return url.toLowerCase().replace(/\/+$/, '');
}
